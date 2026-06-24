// api/marcaciones.js — Registro de marcaciones y adherencia
import { SUPA_URL, SUPA_KEY, cors } from './_supabase.js';

const H = { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY, 'Content-Type': 'application/json' };

function timeToMins(t) {
  if (!t) return -1;
  const [h, m] = String(t).split(':').map(Number);
  return h * 60 + m;
}

function calcAdherencia(marcada, programada) {
  if (!programada) return { diferencia: null, adherente: null };
  const diff = timeToMins(marcada) - timeToMins(programada);
  return { diferencia: diff, adherente: Math.abs(diff) <= 5 };
}

async function getTurno(agente_id, fecha) {
  const r = await fetch(
    `${SUPA_URL}/rest/v1/turnos?agente_id=eq.${agente_id}&fecha=eq.${fecha}&select=id,turno_inicio,turno_fin,break_inicio,lunch_inicio`,
    { headers: H }
  );
  const data = await r.json();
  return Array.isArray(data) && data.length ? data[0] : null;
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // GET — historial de marcaciones
    if (req.method === 'GET') {
      const { agente_id, fecha, desde, hasta } = req.query;
      let url = `${SUPA_URL}/rest/v1/marcaciones?select=*,agentes(nombre,apellido,email,linea_atencion)&order=created_at.desc`;
      if (agente_id) url += `&agente_id=eq.${agente_id}`;
      if (fecha)     url += `&fecha=eq.${fecha}`;
      if (desde)     url += `&fecha=gte.${desde}`;
      if (hasta)     url += `&fecha=lte.${hasta}`;

      const r = await fetch(url, { headers: H });
      const data = await r.json();
      const marcaciones = Array.isArray(data) ? data.map(m => ({
        ...m,
        nombre_completo: m.agentes ? m.agentes.nombre + ' ' + m.agentes.apellido : ''
      })) : [];
      return res.json({ ok: true, marcaciones });
    }

    // POST — registrar marcación
    if (req.method === 'POST') {
      const { agente_id, tipo, hora_marcada, fecha, notas } = req.body || {};
      if (!agente_id || !tipo || !hora_marcada) {
        return res.status(400).json({ ok: false, error: 'agente_id, tipo y hora_marcada son requeridos' });
      }

      const fechaUso = fecha || new Date().toISOString().split('T')[0];
      const turno = await getTurno(agente_id, fechaUso);

      // Mapear tipo → hora programada
      const horaMap = turno ? {
        'inicio_turno':       turno.turno_inicio,
        'descanso_corto':     turno.break_inicio,
        'fin_descanso_corto': turno.break_inicio,
        'descanso_largo':     turno.lunch_inicio,
        'fin_descanso_largo': turno.lunch_inicio,
        'continuar_turno':    turno.turno_inicio,
        'otros':              null,
        'fin_turno':          turno.turno_fin,
      } : {};

      const horaProg = horaMap[tipo] || null;
      const { diferencia, adherente } = calcAdherencia(hora_marcada, horaProg);

      const record = {
        agente_id,
        fecha:           fechaUso,
        tipo,
        hora_marcada,
        hora_programada: horaProg,
        diferencia_min:  diferencia,
        adherente,
        notas:           notas || null,
        turno_id:        turno?.id || null,
      };

      const r = await fetch(`${SUPA_URL}/rest/v1/marcaciones`, {
        method: 'POST',
        headers: { ...H, 'Prefer': 'return=representation' },
        body: JSON.stringify(record)
      });
      const data = await r.json();
      return res.json({ ok: true, marcacion: Array.isArray(data) ? data[0] : data, diferencia, adherente });
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch(e) {
    console.error('marcaciones error:', e.message);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
