// /api/fixture.js
// ?id=123456  → eventos + escalações de um jogo específico

export default async function handler(req, res) {
  const key = process.env.APIFOOTBALL_KEY;
  if (!key) return res.status(500).json({ error: 'APIFOOTBALL_KEY não está configurada no Vercel.' });

  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'Falta o parâmetro id.' });

  const headers = { 'x-apisports-key': key };

  try {
    const [eventsResp, lineupsResp, fixtureResp] = await Promise.all([
      fetch(`https://v3.football.api-sports.io/fixtures/events?fixture=${id}`, { headers }),
      fetch(`https://v3.football.api-sports.io/fixtures/lineups?fixture=${id}`, { headers }),
      fetch(`https://v3.football.api-sports.io/fixtures?id=${id}`, { headers })
    ]);

    const eventsData = await eventsResp.json();
    const lineupsData = await lineupsResp.json();
    const fixtureData = await fixtureResp.json();

    const fixture = fixtureData.response?.[0];

    const eventos = (eventsData.response || []).map(e => ({
      minuto: e.time.elapsed,
      tipo: e.type,          // Goal, Card, subst
      detalhe: e.detail,
      equipa: e.team.name,
      jogador: e.player.name,
      assistencia: e.assist?.name || null
    }));

    const escalacoes = (lineupsData.response || []).map(l => ({
      equipa: l.team.name,
      formacao: l.formation,
      titulares: (l.startXI || []).map(p => ({ nome: p.player.name, numero: p.player.number, posicao: p.player.pos })),
      suplentes: (l.substitutes || []).map(p => ({ nome: p.player.name, numero: p.player.number, posicao: p.player.pos }))
    }));

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    return res.status(200).json({
      jogo: fixture ? {
        estado: fixture.fixture.status.short,
        minuto: fixture.fixture.status.elapsed,
        liga: fixture.league.name,
        casa: { nome: fixture.teams.home.name, logo: fixture.teams.home.logo, golos: fixture.goals.home },
        fora: { nome: fixture.teams.away.name, logo: fixture.teams.away.logo, golos: fixture.goals.away }
      } : null,
      eventos,
      escalacoes
    });

  } catch (err) {
    return res.status(500).json({ error: 'Falha de rede ao contactar a API-Football.' });
  }
}
