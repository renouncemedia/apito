// /api/live.js
// Função serverless (Vercel). A chave fica só aqui no servidor, nunca no browser.
// Configurar no painel do Vercel: Settings > Environment Variables > APIFOOTBALL_KEY

export default async function handler(req, res) {
  const key = process.env.APIFOOTBALL_KEY;

  if (!key) {
    return res.status(500).json({ error: 'APIFOOTBALL_KEY não está configurada no Vercel.' });
  }

  // ?date=2026-08-10  (opcional, default = hoje)
  // ?league=94        (opcional, ex: 94 = Liga Portugal, 39 = Premier League)
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const league = req.query.league;

  let url = `https://v3.football.api-sports.io/fixtures?date=${date}`;
  if (league) url += `&league=${league}&season=2025`;

  try {
    const response = await fetch(url, {
      headers: { 'x-apisports-key': key }
    });

    if (!response.ok) {
      const corpo = await response.text();
      return res.status(response.status).json({ error: `Erro ${response.status} da API-Football: ${corpo.slice(0,300)}` });
    }

    const data = await response.json();

    // A API-Football às vezes devolve status 200 mas com erros no corpo
    // (ex: chave inválida, plano sem acesso à liga, limite diário atingido)
    if (data.errors && Object.keys(data.errors).length){
      return res.status(200).json({ error: `API-Football: ${JSON.stringify(data.errors)}` });
    }

    // Simplifica a resposta para o que o frontend precisa
    const jogos = (data.response || []).map(f => ({
      id: f.fixture.id,
      liga: f.league.name,
      pais: f.league.country,
      ligaLogo: f.league.logo,
      estado: f.fixture.status.short,       // "NS" agendado, "1H"/"2H" ao vivo, "FT" terminado
      minuto: f.fixture.status.elapsed,
      hora: f.fixture.date,
      casa: { nome: f.teams.home.name, logo: f.teams.home.logo, golos: f.goals.home },
      fora: { nome: f.teams.away.name, logo: f.teams.away.logo, golos: f.goals.away }
    }));

    // Cache de 60s para não gastar o limite diário de pedidos
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    return res.status(200).json({ jogos });

  } catch (err) {
    return res.status(500).json({ error: 'Falha de rede ao contactar a API-Football.' });
  }
}
