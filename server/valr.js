'use strict';

const crypto = require('crypto');
const axios = require('axios');
const db = require('./db');

const BASE_URL = 'https://api.valr.com';
const PAPER_TRADING = process.env.PAPER_TRADING === 'true';

// ─── HMAC-SHA512 Signature ────────────────────────────────────────────────────

function buildSignature(apiSecret, timestamp, method, path, body = '') {
  const payload = `${timestamp}${method.toUpperCase()}${path}${body}`;
  return crypto.createHmac('sha512', apiSecret).update(payload).digest('hex');
}

// ─── Authenticated Request Headers ───────────────────────────────────────────

function buildHeaders(method, path, body = '') {
  const apiKey = process.env.VALR_API_KEY;
  const apiSecret = process.env.VALR_API_SECRET;
  const timestamp = Date.now();
  const signature = buildSignature(apiSecret, timestamp, method, path, body);

  return {
    'X-VALR-API-KEY': apiKey,
    'X-VALR-SIGNATURE': signature,
    'X-VALR-TIMESTAMP': timestamp.toString(),
    'Content-Type': 'application/json',
  };
}

// ─── Generic Authenticated Request ───────────────────────────────────────────

async function valrRequest(method, path, bodyObj = null) {
  const bodyStr = bodyObj ? JSON.stringify(bodyObj) : '';
  const headers = buildHeaders(method, path, bodyStr);
  const url = `${BASE_URL}${path}`;

  const config = {
    method: method.toLowerCase(),
    url,
    headers,
    timeout: 15000,
  };

  if (bodyStr) {
    config.data = bodyStr;
  }

  const { data } = await axios(config);
  return data;
}

// ─── Sleep Helper ─────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Public: Get Balance ──────────────────────────────────────────────────────

async function getBalance() {
  try {
    if (PAPER_TRADING) {
      db.logAgent('INFO', 'valr', 'PAPER MODE: getBalance returning simulated balances');
      return [
        { currency: 'ZAR', available: '300.00', reserved: '0.00' },
        { currency: 'BTC', available: '0.00', reserved: '0.00' },
        { currency: 'ETH', available: '0.00', reserved: '0.00' },
      ];
    }
    const data = await valrRequest('GET', '/v1/account/balances');
    return data;
  } catch (err) {
    db.logAgent('ERROR', 'valr', 'getBalance failed', { error: err.message });
    return { success: false, error: err.message };
  }
}

// ─── Public: Get Order Book ───────────────────────────────────────────────────

async function getOrderBook(pair) {
  try {
    const { data } = await axios.get(`${BASE_URL}/v1/public/${pair}/orderbook`, { timeout: 8000 });
    return data;
  } catch (err) {
    db.logAgent('ERROR', 'valr', `getOrderBook failed for ${pair}`, { error: err.message });
    throw err;
  }
}

// ─── Place Limit Order ────────────────────────────────────────────────────────

async function placeLimitOrder(pair, side, quantity, price) {
  const body = {
    side,
    quantity: quantity.toString(),
    price: price.toString(),
    pair,
    postOnly: false,
    timeInForce: 'GTC',
  };

  const data = await valrRequest('POST', '/v1/orders/limit', body);
  return data;
}

// ─── Place Market Order ───────────────────────────────────────────────────────

async function placeMarketOrder(pair, side, baseAmount) {
  const body = {
    side,
    baseAmount: baseAmount.toString(),
    pair,
  };

  const data = await valrRequest('POST', '/v1/orders/market', body);
  return data;
}

// ─── Get Open Orders ──────────────────────────────────────────────────────────

async function getOpenOrders() {
  try {
    const data = await valrRequest('GET', '/v1/orders/open');
    return data;
  } catch (err) {
    db.logAgent('ERROR', 'valr', 'getOpenOrders failed', { error: err.message });
    return { success: false, error: err.message };
  }
}

// ─── Cancel Order ─────────────────────────────────────────────────────────────

async function cancelOrder(orderId, pair) {
  try {
    const body = { orderId, pair };
    const data = await valrRequest('DELETE', '/v1/orders/order', body);
    return data;
  } catch (err) {
    db.logAgent('ERROR', 'valr', `cancelOrder failed for ${orderId}`, { error: err.message });
    return { success: false, error: err.message };
  }
}

// ─── Get Order Status ─────────────────────────────────────────────────────────

async function getOrderStatus(orderId, pair) {
  try {
    const data = await valrRequest('GET', `/v1/orders/${pair}/orderid/${orderId}`);
    return data;
  } catch (err) {
    db.logAgent('ERROR', 'valr', `getOrderStatus failed for ${orderId}`, { error: err.message });
    throw err;
  }
}

// ─── Execute Crypto Buy ───────────────────────────────────────────────────────

async function executeCryptoBuy(pair, zarAmount) {
  try {
    if (PAPER_TRADING) {
      // In paper mode, simulate order book fetch for realistic price
      let simulatedPrice = 1000000; // fallback
      try {
        const orderBook = await getOrderBook(pair);
        if (orderBook && orderBook.Asks && orderBook.Asks.length > 0) {
          simulatedPrice = parseFloat(orderBook.Asks[0].price) * 1.002;
        }
      } catch (_) {
        // ignore, use fallback
      }
      const price = Math.round(simulatedPrice * 100) / 100;
      const quantity = Math.round((zarAmount / price) * 1e6) / 1e6;
      const orderId = `PAPER-${Date.now()}`;
      db.logAgent('INFO', 'valr', `PAPER TRADE BUY: ${pair} qty=${quantity} @ R${price}`, {
        pair, zarAmount, price, quantity, orderId,
      });
      return { success: true, orderId, quantity, price, zarAmount, status: 'SIMULATED' };
    }

    // 1. Get order book
    const orderBook = await getOrderBook(pair);
    if (!orderBook || !orderBook.Asks || orderBook.Asks.length === 0) {
      return { success: false, reason: 'Order book unavailable or empty' };
    }

    // 2. Best ask price
    const bestAsk = parseFloat(orderBook.Asks[0].price);

    // 3. Limit price = ask * 1.002, rounded to 2dp
    const limitPrice = Math.round(bestAsk * 1.002 * 100) / 100;

    // 4. Quantity = zarAmount / limitPrice, rounded to 6dp
    const quantity = Math.round((zarAmount / limitPrice) * 1e6) / 1e6;

    // 5. Place limit order
    let orderResponse;
    try {
      orderResponse = await placeLimitOrder(pair, 'BUY', quantity, limitPrice);
    } catch (err) {
      db.logAgent('ERROR', 'valr', `placeLimitOrder failed for ${pair}`, { error: err.message });
      return { success: false, error: err.message };
    }

    const orderId = orderResponse.id || orderResponse.orderId;

    // 6. Poll for up to 5 minutes (10 polls × 30s)
    const maxPolls = 10;
    for (let i = 0; i < maxPolls; i++) {
      await sleep(30000);
      try {
        const status = await getOrderStatus(orderId, pair);
        const orderStatus = (status.orderStatusType || status.status || '').toUpperCase();
        if (orderStatus === 'FILLED' || orderStatus === 'COMPLETED' || orderStatus === 'COMPLETE') {
          db.logAgent('INFO', 'valr', `Order FILLED: ${orderId}`, { pair, quantity, price: limitPrice });
          return { success: true, orderId, quantity, price: limitPrice, zarAmount, status: 'FILLED' };
        }
        if (orderStatus === 'CANCELLED' || orderStatus === 'FAILED') {
          return { success: false, reason: `Order ${orderStatus}`, orderId };
        }
      } catch (pollErr) {
        db.logAgent('WARN', 'valr', `Poll ${i + 1} failed for ${orderId}`, { error: pollErr.message });
      }
    }

    // 7. Not filled after 5 minutes — cancel
    await cancelOrder(orderId, pair);
    db.logAgent('WARN', 'valr', `Order not filled, cancelled: ${orderId}`, { pair });
    return { success: false, reason: 'Order not filled within 5 minutes', orderId };

  } catch (err) {
    db.logAgent('ERROR', 'valr', `executeCryptoBuy failed for ${pair}`, { error: err.message });
    return { success: false, error: err.message };
  }
}

// ─── Execute Crypto Sell ──────────────────────────────────────────────────────

async function executeCryptoSell(pair, quantity) {
  try {
    if (PAPER_TRADING) {
      const orderId = `PAPER-${Date.now()}`;
      db.logAgent('INFO', 'valr', `PAPER TRADE SELL: ${pair} qty=${quantity}`, {
        pair, quantity, orderId,
      });
      return { success: true, orderId, quantity, status: 'SIMULATED' };
    }

    let orderResponse;
    try {
      orderResponse = await placeMarketOrder(pair, 'SELL', quantity);
    } catch (err) {
      db.logAgent('ERROR', 'valr', `placeMarketOrder SELL failed for ${pair}`, { error: err.message });
      return { success: false, error: err.message };
    }

    const orderId = orderResponse.id || orderResponse.orderId;
    db.logAgent('INFO', 'valr', `Market SELL executed: ${orderId}`, { pair, quantity });
    return { success: true, orderId, quantity, status: 'EXECUTED' };

  } catch (err) {
    db.logAgent('ERROR', 'valr', `executeCryptoSell failed for ${pair}`, { error: err.message });
    return { success: false, error: err.message };
  }
}

module.exports = {
  getBalance,
  getOrderBook,
  placeLimitOrder,
  placeMarketOrder,
  getOpenOrders,
  cancelOrder,
  getOrderStatus,
  executeCryptoBuy,
  executeCryptoSell,
};
