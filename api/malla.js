// api/malla.js — Malla de turnos en Supabase
import { SUPA_URL, SUPA_KEY, cors } from './_supabase.js';

function H(extra = {}) {
  return { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY, 'Content-Type': 'application/json', ...extra };
}

function sliceTime(t) { return t ? String(t).slice(0, 5) : ''; }

function calcTurno(h) {
  const hr = parseInt((h || '0').split(':')[0]);
  if (hr >= 6  && hr < 12) return 'Mañana';
  if (hr >= 12 && hr < 18) return 'Tarde';
  return 'Noche';
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // GET — leer malla completa
    if (req.method === 'GET') {
      const url = `${SUPA_URL}/rest/v1/turnos?select=id,fecha,dia_semana,turno,turno_inicio,turno_fin,break_inicio,break_fin,lunch_inicio,lunch_fin,linea_atencion,conexion,agente_id,agentes(nombre,apellido,email,linea_atencion,nivel)&order=fecha.asc,turno_inicio.asc`;
      const r = await fetch(url, { headers: H() });
      const data = await r.json();
      if (!Array.isArray(data)) return res.json({ ok: false, error: data?.message || 'Error leyendo turnos' });

      const malla = data.map(t => ({
        id:           t.id,
        fecha:        t.fecha,
        dia_semana:   t.dia_semana || '',
        turno:        t.turno || '',
        turno_inicio: sliceTime(t.turno_inicio),
        turno_fin:    sliceTime(t.turno_fin),
        break_inicio: sliceTime(t.break_inicio),
        break_fin:    sliceTime(t.break_fin),
        lunch_inicio: sliceTime(t.lunch_inicio),
        lunch_fin:    sliceTime(t.lunch_fin),
        linea_atencion: t.linea_atencion || (t.agentes?.linea_atencion) || '',
        agente_id:    t.agente_id,
        nombre:       t.agentes ? t.agentes.nombre + ' ' + t.agentes.apellido : '',
        email:        t.agentes?.email || '',
        cola:         t.agentes?.linea_atencion || '',
        nivel:        t.agentes?.nivel || '',
      }));

      return res.json({ ok: true, malla });
    }

    // POST — guardar turnos en bulk
    if (req.method === 'POST') {
      const { malla } = req.body || {};
      if (!Array.isArray(malla)) return res.status(400).json({ ok: false, error: 'malla debe ser un array' });

      let insertados = 0;
      const errores = [];

      for (const t of malla) {
        if (!t.agente_id || !t.fecha || !t.turno_inicio || !t.turno_fin) {
          errores.push({ turno: t.nombre || '?', error: 'Faltan: agente_id, fecha, turno_inicio, turno_fin' });
          continue;
        }
        const record = {
          agente_id:    t.agente_id,
          fecha:        t.fecha,
          dia_semana:   t.dia_semana || null,
          turno:        t.turno || calcTurno(t.turno_inicio),
          turno_inicio: t.turno_inicio,
          turno_fin:    t.turno_fin,
          break_inicio: t.break_inicio || null,
          break_fin:    t.break_fin || null,
          lunch_inicio: t.lunch_inicio || null,
          lunch_fin:    t.lunch_fin || null,
          linea_atencion: t.linea_atencion || t.cola || null,
        };

        // Check si existe → PATCH, si no → POST
        const chk = await fetch(`${SUPA_URL}/rest/v1/turnos?agente_id=eq.${t.agente_id}&fecha=eq.${t.fecha}`, { headers: H() });
        const existing = await chk.json();

        let resp;
        if (Array.isArray(existing) && existing.length > 0) {
          resp = await fetch(`${SUPA_URL}/rest/v1/turnos?agente_id=eq.${t.agente_id}&fecha=eq.${t.fecha}`,
            { method: 'PATCH', headers: H({ 'Prefer': 'return=minimal' }), body: JSON.stringify(record) });
        } else {
          resp = await fetch(`${SUPA_URL}/rest/v1/turnos`,
            { method: 'POST', headers: H({ 'Prefer': 'return=minimal' }), body: JSON.stringify(record) });
        }

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          errores.push({ turno: t.nombre || '?', error: err.message || resp.statusText });
        } else {
          insertados++;
        }
      }
      return res.json({ ok: true, insertados, errores: errores.length ? errores : undefined });
    }

    // DELETE — eliminar turno
    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ ok: false, error: 'id requerido' });
      const r = await fetch(`${SUPA_URL}/rest/v1/turnos?id=eq.${id}`, { method: 'DELETE', headers: H() });
      if (!r.ok) return res.json({ ok: false, error: r.statusText });
      return res.json({ ok: true });
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch(e) {
    console.error('malla error:', e.message);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
