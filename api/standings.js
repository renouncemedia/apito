// /api/standings.js
// ?league=94&season=2025  (94 = Liga Portugal)

export default async function handler(req, res) {
  const key = process.env.APIFOOTBALL_KEY;
  if (!key) return res.status(500).json({ error: 'APIFOOTBALL_KEY não está configurada no Vercel.' });

  const league = req.query.league || '94';
  const season = req.query.season || '2025';
  const url = `https://v3.football.api-sports.io/standings?league=${league}&season=${season}`;

  try {
    const response = await fetch(url, { headers: { 'x-apisports-key': key } });
    if (!response.ok) {
      const corpo = await response.text();
      return res.status(response.status).json({ error: `Erro ${response.status} da API-Football: ${corpo.slice(0,300)}` });
    }

    const data = await response.json();
    if (data.errors && Object.keys(data.errors).length){
      return res.status(200).json({ error: `API-Football: ${JSON.stringify(data.errors)}` });
    }
    const tabela = data.response?.[0]?.league?.standings?.[0] || [];

    const classificacao = tabela.map(t => ({
      posicao: t.rank,
      equipa: t.team.name,
      logo: t.team.logo,
      jogos: t.all.played,
      vitorias: t.all.win,
      saldo: t.goalsDiff,
      pontos: t.points
    }));

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
    return res.status(200).json({ classificacao });

  } catch (err) {
    return res.status(500).json({ error: 'Falha de rede ao contactar a API-Football.' });
  }
}
