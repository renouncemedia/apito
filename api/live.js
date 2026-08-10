// /api/live.js
// Usa a Bzzoiro Sports Data (BSD) API: https://sports.bzzoiro.com/docs/football/
// A chave fica só aqui no servidor, nunca no browser.
// Configurar no painel do Vercel: Settings > Environment Variables > APIFOOTBALL_KEY

const BASE = 'https://sports.bzzoiro.com/api/v2';

function mapEstado(status){
  if (status === 'live') return '1H';
  if (status === 'finished') return 'FT';
  if (status === 'upcoming') return 'NS';
  return status || 'NS';
}

export default async function handler(req, res) {
  const key = process.env.APIFOOTBALL_KEY;
  if (!key) return res.status(500).json({ error: 'APIFOOTBALL_KEY não está configurada no Vercel.' });

  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const league = req.query.league;
  const headers = { Authorization: `Token ${key}` };

  try {
    let url = `${BASE}/events/?date_from=${date}&date_to=${date}&limit=100`;
    if (league) url += `&league_id=${league}`;

    const response = await fetch(url, { headers });
    const corpo = await response.text();

    if (!response.ok) {
      return res.status(response.status).json({ error: `Erro ${response.status} da BSD: ${corpo.slice(0,300)}` });
    }

    const data = JSON.parse(corpo);
    const lista = data.results || data.events || data || [];

    const jogos = lista.map(e => {
      const home = e.home_team || e.home || {};
      const away = e.away_team || e.away || {};
      const liga = e.league || {};
      return {
        id: e.id,
        liga: liga.name || e.league_name || 'Liga',
        pais: liga.country || e.country || '',
        estado: mapEstado(e.status),
        minuto: e.current_minute ?? e.minute ?? null,
        hora: e.kickoff || e.date || e.start_time,
        casa: { nome: home.name || e.home_team_name || 'Casa', golos: e.home_score ?? null },
        fora: { nome: away.name || e.away_team_name || 'Fora', golos: e.away_score ?? null }
      };
    });

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    return res.status(200).json({ jogos });

  } catch (err) {
    return res.status(500).json({ error: `Falha de rede/parse: ${err.message}` });
  }
}
