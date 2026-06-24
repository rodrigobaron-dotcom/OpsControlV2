// api/agentes.js — CRUD agentes
import { SUPA_URL, SUPA_KEY, cors } from './_supabase.js';

const H = { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY, 'Content-Type': 'application/json' };

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const r = await fetch(`${SUPA_URL}/rest/v1/agentes?activo=eq.true&order=nombre.asc&select=id,nombre,apellido,email,linea_atencion,nivel,rol,activo,fecha_ingreso`, { headers: H });
      const data = await r.json();
      return res.json({ ok: true, agentes: data });
    }
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch(e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
