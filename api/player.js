// /api/player.js — Bzzoiro Sports Data (BSD)
// ?id=9832  (id do jogador)

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

  const profileData = await safeJson(`${BASE}/players/${id}/`, headers);
  if (!profileData) return res.status(404).json({ error: 'Jogador não encontrado.' });

  const jogador = {
    id: profileData.id,
    nome: profileData.name || profileData.full_name,
    posicao: profileData.position || null,
    nacionalidade: profileData.nationality || profileData.country || null,
    dataNascimento: profileData.date_of_birth || profileData.birth_date || null,
    altura: profileData.height || null,
    pe: profileData.foot || profileData.preferred_foot || null,
    valorMercado: profileData.market_value || null,
    equipaAtual: profileData.current_team || profileData.team || null,
    equipaAtualId: profileData.current_team_id || profileData.team_id || null,
    numero: profileData.number || profileData.shirt_number || null
  };

  // tentativas defensivas — endpoints não confirmados pela documentação pública
  const statsData = await safeJson(`${BASE}/players/${id}/stats/`, headers);
  const listaStats = statsData?.results || statsData?.stats || [];
  const estatisticas = Array.isArray(listaStats) ? listaStats.map(s => ({
    competicao: s.league_name || s.competition || null,
    jogos: s.matches ?? s.appearances ?? null,
    golos: s.goals ?? null,
    assistencias: s.assists ?? null,
    rating: s.rating ?? s.average_rating ?? null
  })) : [];

  const transfersData = await safeJson(`${BASE}/players/${id}/transfers/`, headers);
  const listaTransfers = transfersData?.results || transfersData?.transfers || [];
  const transferencias = Array.isArray(listaTransfers) ? listaTransfers.map(t => ({
    data: t.date || t.transfer_date || null,
    de: t.from_team || t.from || null,
    para: t.to_team || t.to || null,
    valor: t.fee || t.value || null
  })) : [];

  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
  return res.status(200).json({ jogador, estatisticas, transferencias });
}
