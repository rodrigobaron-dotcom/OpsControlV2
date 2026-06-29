// api/cambios_turno.js — Cambios de turno entre agentes
import { SUPA_URL, SUPA_KEY, cors } from './_supabase.js';

const H = { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY, 'Content-Type': 'application/json' };

async function intercambiarTurnos(turnoSolId, turnoRecId) {
  // Leer ambos turnos en paralelo correctamente
  const [r1, r2] = await Promise.all([
    fetch(`${SUPA_URL}/rest/v1/turnos?id=eq.${turnoSolId}&select=*`, { headers: H }),
    fetch(`${SUPA_URL}/rest/v1/turnos?id=eq.${turnoRecId}&select=*`, { headers: H })
  ]);
  const [t1arr, t2arr] = await Promise.all([r1.json(), r2.json()]);
  const t1 = t1arr[0], t2 = t2arr[0];
  if (!t1 || !t2) throw new Error('No se encontraron los turnos');

  // Intercambiar agente_id entre los dos turnos
  await Promise.all([
    fetch(`${SUPA_URL}/rest/v1/turnos?id=eq.${t1.id}`,
      { method: 'PATCH', headers: { ...H, 'Prefer': 'return=minimal' }, body: JSON.stringify({ agente_id: t2.agente_id }) }),
    fetch(`${SUPA_URL}/rest/v1/turnos?id=eq.${t2.id}`,
      { method: 'PATCH', headers: { ...H, 'Prefer': 'return=minimal' }, body: JSON.stringify({ agente_id: t1.agente_id }) })
  ]);
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // GET — listar solicitudes
    if (req.method === 'GET') {
      const { agente_id, estado } = req.query;
      let url = `${SUPA_URL}/rest/v1/cambios_turno?select=*,solicitante:agentes!cambios_turno_solicitante_id_fkey(nombre,apellido,email),receptor:agentes!cambios_turno_receptor_id_fkey(nombre,apellido,email)&order=created_at.desc`;
      if (agente_id) url += `&or=(solicitante_id.eq.${agente_id},receptor_id.eq.${agente_id})`;
      if (estado) url += `&estado=eq.${estado}`;
      const r = await fetch(url, { headers: H });
      const data = await r.json();
      return res.json({ ok: true, cambios: Array.isArray(data) ? data : [] });
    }

    // POST — crear solicitud
    if (req.method === 'POST') {
      const { solicitante_id, receptor_id, turno_solicitante, turno_receptor, motivo } = req.body || {};
      if (!solicitante_id || !receptor_id || !turno_solicitante || !turno_receptor) {
        return res.status(400).json({ ok: false, error: 'Faltan campos requeridos' });
      }
      const r = await fetch(`${SUPA_URL}/rest/v1/cambios_turno`, {
        method: 'POST',
        headers: { ...H, 'Prefer': 'return=representation' },
        body: JSON.stringify({ solicitante_id, receptor_id, turno_solicitante, turno_receptor, motivo: motivo || null, estado: 'pendiente' })
      });
      const data = await r.json();
      return res.json({ ok: true, cambio: Array.isArray(data) ? data[0] : data });
    }

    // PATCH — aprobar/rechazar
    if (req.method === 'PATCH') {
      const { id } = req.query;
      const { estado, aprobado_por } = req.body || {};
      if (!id || !estado) return res.status(400).json({ ok: false, error: 'id y estado requeridos' });

      // Si se aprueba, intercambiar turnos en Supabase
      if (estado === 'aprobado') {
        // Leer el cambio para obtener los IDs de turnos
        const rc = await fetch(`${SUPA_URL}/rest/v1/cambios_turno?id=eq.${id}&select=turno_solicitante,turno_receptor`, { headers: H });
        const cambios = await rc.json();
        if (Array.isArray(cambios) && cambios.length) {
          try {
            await intercambiarTurnos(cambios[0].turno_solicitante, cambios[0].turno_receptor);
          } catch(eSwap) {
            console.error('intercambiarTurnos falló:', eSwap.message);
            return res.status(500).json({ ok: false, error: 'intercambiarTurnos: ' + eSwap.message });
          }
        }

      // Actualizar estado
      const r = await fetch(`${SUPA_URL}/rest/v1/cambios_turno?id=eq.${id}`, {
        method: 'PATCH',
        headers: { ...H, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ estado, aprobado_por: aprobado_por || null })
      });
      if (!r.ok) return res.json({ ok: false, error: r.statusText });
      return res.json({ ok: true });
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch(e) {
    console.error('cambios_turno error:', e.message);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
