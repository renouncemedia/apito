// /api/team.js — Bzzoiro Sports Data (BSD)
// ?id=267  (id da equipa)

const BASE = 'https://sports.bzzoiro.com/api/v2';

export default async function handler(req, res) {
  const key = process.env.APIFOOTBALL_KEY;
  if (!key) return res.status(500).json({ error: 'APIFOOTBALL_KEY não está configurada no Vercel.' });

  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'Falta o parâmetro id.' });

  const headers = { Authorization: `Token ${key}` };

  try {
    const [teamResp, squadResp] = await Promise.allSettled([
      fetch(`${BASE}/teams/${id}/`, { headers }).then(r => r.ok ? r.json() : null),
      fetch(`${BASE}/teams/${id}/squad/`, { headers }).then(r => r.ok ? r.json() : null)
    ]);

    const team = teamResp.status === 'fulfilled' ? teamResp.value : null;
    if (!team) return res.status(404).json({ error: 'Equipa não encontrada.' });

    const squadBody = squadResp.status === 'fulfilled' ? squadResp.value : null;
    const listaSquad = squadBody?.results || squadBody?.squad || squadBody?.players || [];
    const plantel = Array.isArray(listaSquad) ? listaSquad.map(p => ({
      id: p.player_id || p.id,
      nome: p.player_name || p.name,
      posicao: p.position || p.pos || null,
      numero: p.number ?? p.shirt_number ?? null
    })) : [];

    // últimos e próximos jogos desta equipa
    const hoje = new Date().toISOString().slice(0,10);
    const [recentesResp, proximosResp] = await Promise.allSettled([
      fetch(`${BASE}/events/?team_id=${id}&status=finished&limit=5`, { headers }).then(r => r.ok ? r.json() : null),
      fetch(`${BASE}/events/?team_id=${id}&status=notstarted&limit=5`, { headers }).then(r => r.ok ? r.json() : null)
    ]);

    function mapaJogos(raw){
      const lista = raw?.results || [];
      return lista.map(e => ({
        id: e.id, data: e.event_date,
        casa: e.home_team, fora: e.away_team,
        golosCasa: e.home_score, golosFora: e.away_score
      }));
    }

    const recentes = recentesResp.status === 'fulfilled' ? mapaJogos(recentesResp.value) : [];
    const proximos = proximosResp.status === 'fulfilled' ? mapaJogos(proximosResp.value) : [];

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
    return res.status(200).json({
      equipa: { id: team.id, nome: team.name, nomeCurto: team.short_name, pais: team.country },
      plantel, recentes, proximos
    });

  } catch (err) {
    return res.status(500).json({ error: `Falha de rede/parse: ${err.message}` });
  }
}
