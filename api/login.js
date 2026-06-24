// api/login.js — Autenticación con Supabase
import { SUPA_URL, SUPA_KEY, cors } from './_supabase.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ ok: false, error: 'Email y contraseña requeridos' });

    // Buscar agente por email
    const r = await fetch(
      `${SUPA_URL}/rest/v1/agentes?email=eq.${encodeURIComponent(email.toLowerCase())}&activo=eq.true&select=*`,
      { headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY } }
    );
    const agentes = await r.json();
    if (!agentes?.length) return res.status(401).json({ ok: false, error: 'Credenciales incorrectas' });

    const agente = agentes[0];
    // Contraseña = número de documento
    if (agente.documento !== password) return res.status(401).json({ ok: false, error: 'Credenciales incorrectas' });

    // Crear sesión
    const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    await fetch(`${SUPA_URL}/rest/v1/sesiones`, {
      method: 'POST',
      headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ agente_id: agente.id, token })
    });

    return res.json({
      ok: true,
      token,
      agente: {
        id: agente.id, nombre: agente.nombre, apellido: agente.apellido,
        email: agente.email, rol: agente.rol || 'agente',
        linea_atencion: agente.linea_atencion, nivel: agente.nivel
      }
    });
  } catch(e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
