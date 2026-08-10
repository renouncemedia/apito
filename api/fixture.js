// /api/fixture.js — Bzzoiro Sports Data (BSD)
// ?id=223510

const BASE = 'https://sports.bzzoiro.com/api/v2';

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
      liga: detail.league?.name || 'Liga',
      estado: detail.status,
      minuto: detail.current_minute ?? null,
      casa: { nome: detail.home_team?.name || 'Casa', golos: detail.home_score ?? null },
      fora: { nome: detail.away_team?.name || 'Fora', golos: detail.away_score ?? null }
    };

    const eventosBrutos = incidentsData.results || incidentsData.incidents || incidentsData || [];
    const eventos = eventosBrutos.map(e => ({
      minuto: e.minute,
      tipo: e.type,
      equipa: e.team_name || e.team?.name || '',
      jogador: e.player_name || e.player?.name || '',
      assistencia: e.assist_player_name || null
    }));

    const escalacoesBrutas = lineupsData.results || lineupsData.lineups || lineupsData || [];
    const escalacoes = (Array.isArray(escalacoesBrutas) ? escalacoesBrutas : []).map(l => ({
      equipa: l.team_name || l.team?.name || '',
      formacao: l.formation || null,
      titulares: (l.starting_xi || l.startXI || []).map(p => ({ nome: p.player_name || p.name, numero: p.number }))
    }));

    res.setHeader('Cache-Control', 's-maxage=20, stale-while-revalidate=40');
    return res.status(200).json({ jogo, eventos, escalacoes });

  } catch (err) {
    return res.status(500).json({ error: `Falha de rede/parse: ${err.message}` });
  }
}
