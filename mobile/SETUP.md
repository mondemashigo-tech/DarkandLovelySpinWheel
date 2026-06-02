# R300 Trade Signal — Expo Go Setup

## Prerequisites
- Node.js installed on your computer
- Expo Go app on your phone (iOS App Store / Google Play)
- Both your computer and phone on the **same WiFi network**

---

## Step 1 — Start the backend API

In the project root:
```bash
npm run server
# API running at http://localhost:3001
```

---

## Step 2 — Find your computer's local IP

**Mac:**
```bash
ipconfig getifaddr en0
# e.g. 192.168.1.42
```

**Windows:**
```bash
ipconfig
# look for IPv4 Address under your WiFi adapter
```

**Linux:**
```bash
hostname -I | awk '{print $1}'
```

---

## Step 3 — Update the API URL

Open `mobile/src/api.js` and change `API_BASE`:

```js
// Real phone on same WiFi:
export const API_BASE = 'http://192.168.1.42:3001';  // ← your IP here

// Android emulator:
export const API_BASE = 'http://10.0.2.2:3001';

// iOS simulator:
export const API_BASE = 'http://localhost:3001';
```

---

## Step 4 — Install and start

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code with:
- **iOS**: Camera app
- **Android**: Expo Go app → "Scan QR code"

---

## Tabs

| Tab | What it does |
|-----|-------------|
| TODAY | AI buy signals for today (BUY NOW / LIMIT ORDER) |
| THIS WEEK | Weekly plan with target, stop-loss, ceiling per ticker |
| EXITS | HOLD / WATCH / TAKE PROFIT / EXIT NOW per position |
| PORTFOLIO | 17-week progress, allocation breakdown, projections |
| LOG | Log trades (BUY/SELL/EXIT) + history |
