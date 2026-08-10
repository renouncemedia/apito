// /api/live.js — Bzzoiro Sports Data (BSD)
const BASE = 'https://sports.bzzoiro.com/api/v2';

function mapEstado(status){
  if (status === 'notstarted' || status === 'upcoming') return 'NS';
  if (status === 'finished') return 'FT';
  if (status === 'postponed' || status === 'cancelled') return 'CANC';
  return '1H';
}

const nomesLiga = {};

async function nomeDaLiga(id, headers){
  if (nomesLiga[id]) return nomesLiga[id];
  try {
    const r = await fetch(`${BASE}/leagues/${id}/`, { headers });
    if (r.ok) {
      const d = await r.json();
      nomesLiga[id] = { nome: d.name, pais: d.country };
      return nomesLiga[id];
    }
  } catch (e) {}
  return { nome: `Liga #${id}`, pais: '' };
}

export default async function handler(req, res) {
  const key = process.env.APIFOOTBALL_KEY;
  if (!key) return res.status(500).json({ error: 'APIFOOTBALL_KEY não está configurada no Vercel.' });

  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const league = req.query.league;
  const headers = { Authorization: `Token ${key}` };

  try {
    let url = `${BASE}/events/?date_from=${date}&date_to=${date}&limit=150`;
    if (league) url += `&league_id=${league}`;

    const response = await fetch(url, { headers });
    const corpo = await response.text();
    if (!response.ok) return res.status(response.status).json({ error: `Erro ${response.status} da BSD: ${corpo.slice(0,300)}` });

    const data = JSON.parse(corpo);
    const lista = data.results || [];

    const idsUnicos = [...new Set(lista.map(e => e.league_id))];
    const mapaLigas = {};
    await Promise.all(idsUnicos.map(async id => { mapaLigas[id] = await nomeDaLiga(id, headers); }));

    const jogos = lista.map(e => ({
      id: e.id,
      ligaId: e.league_id,
      liga: mapaLigas[e.league_id]?.nome || `Liga #${e.league_id}`,
      pais: mapaLigas[e.league_id]?.pais || '',
      estado: mapEstado(e.status),
      minuto: e.current_minute,
      hora: e.event_date,
      casa: { id: e.home_team_id, nome: e.home_team, golos: e.home_score },
      fora: { id: e.away_team_id, nome: e.away_team, golos: e.away_score }
    }));

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    return res.status(200).json({ jogos });

  } catch (err) {
    return res.status(500).json({ error: `Falha de rede/parse: ${err.message}` });
  }
}
