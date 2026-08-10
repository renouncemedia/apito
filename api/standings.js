// /api/standings.js — Bzzoiro Sports Data (BSD)
// ?league=2  (2 = Liga Portugal Betclic)

const BASE = 'https://sports.bzzoiro.com/api/v2';

export default async function handler(req, res) {
  const key = process.env.APIFOOTBALL_KEY;
  if (!key) return res.status(500).json({ error: 'APIFOOTBALL_KEY não está configurada no Vercel.' });

  const league = req.query.league || '2';
  const headers = { Authorization: `Token ${key}` };

  try {
    const seasonResp = await fetch(`${BASE}/leagues/${league}/season/`, { headers });
    const seasonBody = await seasonResp.text();
    if (!seasonResp.ok) return res.status(seasonResp.status).json({ error: `Erro ${seasonResp.status} (season): ${seasonBody.slice(0,300)}` });
    const season = JSON.parse(seasonBody);
    const seasonId = season.id;

    const url = `${BASE}/leagues/${league}/standings/?season_id=${seasonId}`;
    const response = await fetch(url, { headers });
    const corpo = await response.text();
    if (!response.ok) return res.status(response.status).json({ error: `Erro ${response.status} (standings): ${corpo.slice(0,300)}` });

    const data = JSON.parse(corpo);
    const tabela = data.standings || [];

    const classificacao = tabela.map(t => ({
      posicao: t.position,
      equipa: t.team_name,
      jogos: t.played,
      vitorias: t.won,
      saldo: t.gd,
      pontos: t.pts
    }));

    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');
    return res.status(200).json({ classificacao });

  } catch (err) {
    return res.status(500).json({ error: `Falha de rede/parse: ${err.message}` });
  }
}
