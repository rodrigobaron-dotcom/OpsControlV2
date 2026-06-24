// api/estados.js — Estados en tiempo real (almacenados en memoria por fecha)
import { cors } from './_supabase.js';

// Store simple en memoria (Vercel serverless - se reinicia)
// Para producción real usar Supabase tabla estados_realtime
let estadosHoy = {};
let fechaEstados = '';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const hoy = new Date().toISOString().split('T')[0];
  if (fechaEstados !== hoy) { estadosHoy = {}; fechaEstados = hoy; }

  if (req.method === 'GET') {
    const { fecha } = req.query;
    return res.json({ ok: true, estados: estadosHoy, fecha: hoy });
  }

  if (req.method === 'POST') {
    const { nombre, estado, hora } = req.body || {};
    if (!nombre || !estado) return res.status(400).json({ ok: false, error: 'nombre y estado requeridos' });
    estadosHoy[nombre] = { estado, hora, ts: Date.now() };
    return res.json({ ok: true });
  }

  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}
