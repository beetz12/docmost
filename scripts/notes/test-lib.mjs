// Shared helpers for the notes integration tests. DEV server only (port 3100, dev database).
// The account below is a throwaway test account in the dev database; it is created on first run.
export const BASE = process.env.NOTES_TEST_URL ?? 'http://localhost:3100';
const TEST_USER = {
  name: 'Notes Test',
  email: 'notes-test@example.test',
  password: 'notes-dev-test-only',
  workspaceName: 'Notes Dev',
};

if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) {
  throw new Error(`Refusing to run tests against non-local ${BASE}`);
}

function cookieFrom(res) {
  const raw = res.headers.getSetCookie?.() ?? [];
  const auth = raw.find((c) => c.startsWith('authToken='));
  return auth ? auth.split(';')[0] : null;
}

export async function login() {
  let res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: TEST_USER.email, password: TEST_USER.password }),
  });
  if (!res.ok) {
    // fresh dev database: create the workspace and test user
    res = await fetch(`${BASE}/api/auth/setup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(TEST_USER),
    });
  }
  const cookie = cookieFrom(res);
  if (!cookie) throw new Error(`login failed: ${res.status} ${await res.text()}`);
  return { cookie };
}

export async function api(session, path, body = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: session.cookie },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${text.slice(0, 300)}`);
  const json = text ? JSON.parse(text) : {};
  return json.data ?? json;
}

export function localDate(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function shiftDate(date, days) {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}
