import { useEffect, useRef, useState } from 'react';
export function useSSE(url) {
  const [lastEvent, setLastEvent] = useState(null);
  const [connected, setConnected] = useState(false);
  const esRef = useRef(null);
  useEffect(() => {
    const es = new EventSource(url);
    esRef.current = es;
    es.onopen = () => setConnected(true);
    es.onmessage = (e) => { try { setLastEvent(JSON.parse(e.data)); } catch {} };
    es.onerror = () => setConnected(false);
    return () => es.close();
  }, [url]);
  return { lastEvent, connected };
}
