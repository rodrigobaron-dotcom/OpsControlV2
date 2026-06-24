// api/_supabase.js — Helper compartido para todos los APIs
export const SUPA_URL = process.env.SUPABASE_URL;
export const SUPA_KEY = process.env.SUPABASE_SECRET_KEY;

export function headers(extra = {}) {
  return {
    'apikey': SUPA_KEY,
    'Authorization': 'Bearer ' + SUPA_KEY,
    'Content-Type': 'application/json',
    ...extra
  };
}

export async function supaFetch(path, opts = {}) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    headers: headers(opts.headers || {}),
    method: opts.method || 'GET',
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || data?.error || res.statusText);
  return data;
}

export function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}
