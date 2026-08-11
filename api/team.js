// /api/team.js — Bzzoiro Sports Data (BSD)
// ?id=267        (id da equipa, obrigatório)
// ?league=2      (id da liga, opcional — se não vier, tenta inferir pelos jogos recentes)

const BASE = 'https://sports.bzzoiro.com/api/v2';

const GRUPO_POSICAO = {
  'G': 'Guarda-redes', 'GK': 'Guarda-redes',
  'D': 'Defesas', 'DF': 'Defesas',
  'M': 'Médios', 'MF': 'Médios',
  'F': 'Avançados', 'FW': 'Avançados'
};

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
  let ligaId = req.query.league ? Number(req.query.league) : null;

  // ---- Info básica da equipa ----
  const teamData = await safeJson(`${BASE}/teams/${id}/`, headers);
  if (!teamData) return res.status(404).json({ error: 'Equipa não encontrada.' });

  const equipa = {
    id: teamData.id,
    nome: teamData.name,
    nomeCurto: teamData.short_name || teamData.name,
    pais: teamData.country || ''
  };

  // ---- Jogos recentes e próximos ----
  const [recentesRaw, proximosRaw] = await Promise.all([
    safeJson(`${BASE}/events/?team_id=${id}&status=finished&limit=10`, headers),
    safeJson(`${BASE}/events/?team_id=${id}&status=notstarted&limit=10`, headers)
  ]);

  function mapaJogos(raw){
    const lista = raw?.results || [];
    return lista.map(e => ({
      id: e.id, data: e.event_date, ligaId: e.league_id,
      casa: e.home_team, fora: e.away_team,
      golosCasa: e.home_score, golosFora: e.away_score
    }));
  }

  const recentes = mapaJogos(recentesRaw);
  const proximos = mapaJogos(proximosRaw);

  // se não veio liga por parâmetro, tenta inferir do jogo mais recente
  if (!ligaId){
    ligaId = recentes[0]?.ligaId || proximos[0]?.ligaId || null;
  }

  // ---- Classificação (se soubermos a liga) ----
  let classificacao = [];
  let nomeLiga = null;
  if (ligaId){
    const ligaInfo = await safeJson(`${BASE}/leagues/${ligaId}/`, headers);
    nomeLiga = ligaInfo?.name || null;
    const seasonInfo = await safeJson(`${BASE}/leagues/${ligaId}/season/`, headers);
    const seasonId0 = seasonInfo?.season?.id ?? seasonInfo?.id;
    if (seasonId0){
      const standingsData = await safeJson(`${BASE}/leagues/${ligaId}/standings/?season_id=${seasonId0}`, headers);
      const tabela = standingsData?.standings || [];
      classificacao = tabela.map(t => ({
        posicao: t.position, equipaId: t.team_id, equipa: t.team_name,
        jogos: t.played, vitorias: t.won, saldo: t.gd, pontos: t.pts
      }));
    }
  }

  // ---- Plantel ----
  const squadData = await safeJson(`${BASE}/teams/${id}/squad/`, headers);
  const listaSquad = squadData?.results || squadData?.squad || squadData?.players || [];
  const gruposPlantel = {};
  if (Array.isArray(listaSquad)){
    listaSquad.forEach(p => {
      const grupo = GRUPO_POSICAO[p.position] || 'Outros';
      if (!gruposPlantel[grupo]) gruposPlantel[grupo] = [];
      gruposPlantel[grupo].push({
        id: p.player_id || p.id,
        nome: p.player_name || p.name,
        numero: p.number ?? p.shirt_number ?? null,
        pais: p.nationality || p.country || null
      });
    });
  }

  // ---- Melhores jogadores da equipa (filtra os marcadores da liga por esta equipa) ----
  let melhoresJogadores = [];
  if (ligaId){
    const seasonInfo2 = await safeJson(`${BASE}/leagues/${ligaId}/season/`, headers);
    const seasonId2 = seasonInfo2?.season?.id ?? seasonInfo2?.id;
    if (seasonId2){
      const scorersData = await safeJson(`${BASE}/leagues/${ligaId}/top/scorers/?season_id=${seasonId2}&limit=50`, headers);
      const lista = scorersData?.leaders || [];
      melhoresJogadores = lista
        .filter(p => String(p.team_id) === String(id))
        .map(p => ({ jogador: p.player_name, golos: p.value, posicao: p.position }));
    }
  }

  // ---- Estatísticas simples derivadas dos jogos recentes obtidos ----
  const jogosComResultado = recentes.filter(j => j.golosCasa !== null && j.golosCasa !== undefined);
  let golosMarcados = 0, golosSofridos = 0;
  jogosComResultado.forEach(j => {
    const ehCasa = j.casa === equipa.nome;
    golosMarcados += ehCasa ? j.golosCasa : j.golosFora;
    golosSofridos += ehCasa ? j.golosFora : j.golosCasa;
  });

  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
  return res.status(200).json({
    equipa, ligaId, nomeLiga, recentes, proximos, classificacao,
    plantel: gruposPlantel, melhoresJogadores,
    estatisticas: {
      jogosAnalisados: jogosComResultado.length,
      golosMarcados, golosSofridos
    }
  });
}
