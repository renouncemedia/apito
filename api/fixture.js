// /api/fixture.js — Bzzoiro Sports Data (BSD)
// ?id=223510

const BASE = 'https://sports.bzzoiro.com/api/v2';

function mapEstado(status){
  if (status === 'notstarted') return 'NS';
  if (status === 'finished') return 'FT';
  return '1H';
}

export default async function handler(req, res) {
  const key = process.env.APIFOOTBALL_KEY;
  if (!key) return res.status(500).json({ error: 'APIFOOTBALL_KEY não está configurada no Vercel.' });

  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'Falta o parâmetro id.' });

  const headers = { Authorization: `Token ${key}` };

  try {
    const [detailResp, incidentsResp, lineupsResp] = await Promise.all([
      fetch(`${BASE}/events/${id}/`, { headers }),
      fetch(`${BASE}/events/${id}/incidents/`, { headers }),
      fetch(`${BASE}/events/${id}/lineups/`, { headers })
    ]);

    const detailBody = await detailResp.text();
    if (!detailResp.ok) return res.status(detailResp.status).json({ error: `Erro ${detailResp.status}: ${detailBody.slice(0,300)}` });
    const detail = JSON.parse(detailBody);

    const incidentsData = incidentsResp.ok ? await incidentsResp.json() : { results: [] };
    const lineupsData = lineupsResp.ok ? await lineupsResp.json() : { results: [] };

    const jogo = {
      liga: detail.league_id === 2 ? 'Liga Portugal' : `Liga #${detail.league_id}`,
      estado: mapEstado(detail.status),
      minuto: detail.current_minute,
      casa: { nome: detail.home_team, golos: detail.home_score },
      fora: { nome: detail.away_team, golos: detail.away_score }
    };

    const eventosBrutos = incidentsData.results || [];
    const eventos = eventosBrutos.map(e => ({
      minuto: e.minute,
      tipo: e.type,
      equipa: e.team_name || '',
      jogador: e.player_name || '',
      assistencia: e.assist_player_name || null
    }));

    const escalacoesBrutas = lineupsData.results || [];
    const escalacoes = (Array.isArray(escalacoesBrutas) ? escalacoesBrutas : []).map(l => ({
      equipa: l.team_name || '',
      formacao: l.formation || null,
      titulares: (l.starting_xi || []).map(p => ({ nome: p.player_name, numero: p.number }))
    }));

    res.setHeader('Cache-Control', 's-maxage=20, stale-while-revalidate=40');
    return res.status(200).json({ jogo, eventos, escalacoes });

  } catch (err) {
    return res.status(500).json({ error: `Falha de rede/parse: ${err.message}` });
  }
}
