// ─── CHANGE THIS to your computer's local IP when testing on a real device ───
// Android emulator: http://10.0.2.2:3001
// iOS simulator:    http://localhost:3001
// Real phone:       http://192.168.x.x:3001  ← your machine's WiFi IP
export const API_BASE = 'http://10.0.2.2:3001';

export async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  if (json.error) throw new Error(json.error);
  return json;
}
