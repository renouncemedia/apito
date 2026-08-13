// /api/league.js — Bzzoiro Sports Data (BSD)
// ?id=2  (id da liga)

const BASE = 'https://sports.bzzoiro.com/api/v2';

async function safeJson(url, headers){
  try {
    const r = await fetch(url, { headers });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) { return null; }
}

export default async function handler(req, res) {
  const key = process.env.APIFOOTBALL_KEY;
  if (!key) return res.status(500).json({ error: 'APIFOOTBALL_KEY não está configurada no Vercel.' });

  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'Falta o parâmetro id.' });

  const headers = { Authorization: `Token ${key}` };

  const ligaInfo = await safeJson(`${BASE}/leagues/${id}/`, headers);
  if (!ligaInfo) return res.status(404).json({ error: 'Liga não encontrada.' });

  const seasonInfo = await safeJson(`${BASE}/leagues/${id}/season/`, headers);
  const seasonId = seasonInfo?.season?.id ?? seasonInfo?.id;
  const seasonObj = seasonInfo?.season ?? seasonInfo;

  let classificacao = [];
  if (seasonId){
    // "venue" tenta filtrar casa/fora (não confirmado pela documentação — melhor esforço)
    const venue = req.query.venue && req.query.venue !== 'all' ? `&venue=${req.query.venue}` : '';
    const standingsData = await safeJson(`${BASE}/leagues/${id}/standings/?season_id=${seasonId}${venue}`, headers);
    const tabela = standingsData?.standings || [];
    classificacao = tabela.map(t => ({
      posicao: t.position, equipaId: t.team_id, equipa: t.team_name,
      jogos: t.played, vitorias: t.won, saldo: t.gd, pontos: t.pts
    }));
  }

  // várias categorias de estatísticas (mesmo padrão confirmado para "scorers")
  const categorias = { scorers: 'Melhores marcadores', assists: 'Melhores assistentes', rating: 'Melhor avaliação' };
  const estatisticas = {};
  if (seasonId){
    await Promise.all(Object.keys(categorias).map(async cat => {
      const data = await safeJson(`${BASE}/leagues/${id}/top/${cat}/?season_id=${seasonId}&limit=5`, headers);
      const lista = data?.leaders || [];
      estatisticas[cat] = {
        titulo: categorias[cat],
        // ordena sempre do maior para o menor, independentemente da ordem devolvida pela API
        dados: lista.map(p => ({ jogador: p.player_name, equipa: p.team_name, valor: p.value }))
          .sort((a, b) => (b.valor ?? 0) - (a.valor ?? 0))
      };
    }));
  }

  // próximos jogos (para a tab "Jogos" e para saber a próxima jornada) + resultados recentes
  const hoje = new Date().toISOString().slice(0,10);
  const [proximosData, recentesData] = await Promise.all([
    safeJson(`${BASE}/events/?league_id=${id}&date_from=${hoje}&status=notstarted&limit=40`, headers),
    safeJson(`${BASE}/events/?league_id=${id}&status=finished&limit=20`, headers)
  ]);

  function mapaJogosLiga(raw){
    const lista = raw?.results || [];
    return lista.map(e => ({
      id: e.id, data: e.event_date, jornada: e.round_number ?? null,
      casa: e.home_team, fora: e.away_team,
      golosCasa: e.home_score, golosFora: e.away_score
    }));
  }

  const proximosJogos = mapaJogosLiga(proximosData);
  const recentesJogos = mapaJogosLiga(recentesData);
  const proximoJogo = proximosJogos[0] ? {
    id: proximosJogos[0].id, casa: proximosJogos[0].casa, fora: proximosJogos[0].fora, data: proximosJogos[0].data
  } : null;
  const proximaJornada = proximosJogos[0]?.jornada ?? null;

  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
  return res.status(200).json({
    liga: { id: ligaInfo.id, nome: ligaInfo.name, pais: ligaInfo.country },
    season: seasonObj ? { nome: seasonObj.name, inicio: seasonObj.start_date, fim: seasonObj.end_date } : null,
    classificacao, estatisticas, proximoJogo, proximaJornada, proximosJogos, recentesJogos
  });
}
