// /api/fixture.js — Bzzoiro Sports Data (BSD)
const BASE = 'https://sports.bzzoiro.com/api/v2';

function mapEstado(status){
  if (status === 'notstarted' || status === 'upcoming') return 'NS';
  if (status === 'finished') return 'FT';
  return '1H';
}

// Tenta várias formas prováveis de guardar jogadores dentro de uma escalação
function extrairJogadores(lista){
  if (!Array.isArray(lista)) return [];
  return lista.map(p => ({
    nome: p.player_name || p.name || p.player || 'Jogador',
    numero: p.number ?? p.shirt_number ?? p.jersey_number ?? null,
    posicao: p.position || p.pos || null
  }));
}

// Tenta várias formas prováveis da resposta de escalações (confirmed/predicted/unavailable)
function extrairEscalacoes(raw, homeId, homeName, awayId, awayName){
  if (!raw) return { status: 'unavailable', equipas: [] };
  const status = raw.status || (raw.lineups ? 'confirmed' : 'unavailable');
  let blocoLineups = raw.lineups;
  if (!blocoLineups) return { status: 'unavailable', equipas: [] };

  // formato A: { home: {...}, away: {...} }
  if (blocoLineups.home || blocoLineups.away){
    const equipas = [];
    if (blocoLineups.home) equipas.push({
      equipa: homeName, formacao: blocoLineups.home.formation || null,
      titulares: extrairJogadores(blocoLineups.home.starting_xi || blocoLineups.home.startXI || blocoLineups.home.starters)
    });
    if (blocoLineups.away) equipas.push({
      equipa: awayName, formacao: blocoLineups.away.formation || null,
      titulares: extrairJogadores(blocoLineups.away.starting_xi || blocoLineups.away.startXI || blocoLineups.away.starters)
    });
    return { status, equipas };
  }

  // formato B: array de 2 equipas
  if (Array.isArray(blocoLineups)){
    const equipas = blocoLineups.map(l => ({
      equipa: l.team_name || (l.team_id === homeId ? homeName : l.team_id === awayId ? awayName : 'Equipa'),
      formacao: l.formation || null,
      titulares: extrairJogadores(l.starting_xi || l.startXI || l.starters)
    }));
    return { status, equipas };
  }

  return { status, equipas: [] };
}

export default async function handler(req, res) {
  const key = process.env.APIFOOTBALL_KEY;
  if (!key) return res.status(500).json({ error: 'APIFOOTBALL_KEY não está configurada no Vercel.' });

  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'Falta o parâmetro id.' });

  const headers = { Authorization: `Token ${key}` };

  try {
    const detailResp = await fetch(`${BASE}/events/${id}/`, { headers });
    const detailBody = await detailResp.text();
    if (!detailResp.ok) return res.status(detailResp.status).json({ error: `Erro ${detailResp.status}: ${detailBody.slice(0,300)}` });
    const detail = JSON.parse(detailBody);

    // pedidos que podem falhar sem rebentar a página toda
    const [incidentsRaw, lineupsRaw, statsRaw] = await Promise.allSettled([
      fetch(`${BASE}/events/${id}/incidents/`, { headers }).then(r => r.ok ? r.json() : null),
      fetch(`${BASE}/events/${id}/lineups/`, { headers }).then(r => r.ok ? r.json() : null),
      fetch(`${BASE}/events/${id}/stats/`, { headers }).then(r => r.ok ? r.json() : null)
    ]);

    const jogo = {
      liga: detail.league_id === 2 ? 'Liga Portugal' : `Liga #${detail.league_id}`,
      estado: mapEstado(detail.status),
      minuto: detail.current_minute,
      casa: { id: detail.home_team_id, nome: detail.home_team, golos: detail.home_score },
      fora: { id: detail.away_team_id, nome: detail.away_team, golos: detail.away_score }
    };

    const h2h = detail.head_to_head ? {
      totalJogos: detail.head_to_head.total_matches,
      vitoriasCasa: detail.head_to_head.home_wins,
      empates: detail.head_to_head.draws,
      vitoriasFora: detail.head_to_head.away_wins,
      recentes: (detail.head_to_head.recent_matches || []).map(m => ({ casa: m.home, fora: m.away, resultado: m.score, data: m.date }))
    } : null;

    // ---- Previsões ML (só se vierem embutidas no evento; senão fica null e a UI ignora) ----
    const p = detail.predictions || detail.prediction || null;
    const previsao = p ? {
      vitoriaCasa: p.home_win ?? p.home ?? null,
      empate: p.draw ?? null,
      vitoriaFora: p.away_win ?? p.away ?? null
    } : null;

    // ---- Eventos (formato confirmado pela documentação oficial da BSD) ----
    const incidentsBody = incidentsRaw.status === 'fulfilled' ? incidentsRaw.value : null;
    const listaIncidentes = incidentsBody?.incidents || incidentsBody?.results || [];
    const eventos = listaIncidentes.map(e => {
      const equipa = e.is_home ? detail.home_team : (e.is_home === false ? detail.away_team : '');
      if (e.type === 'substitution'){
        return { minuto: e.minute, tipo: 'Substituição', equipa, jogador: `${e.player_out || ''} ⇄ ${e.player_in || ''}`, assistencia: null };
      }
      if (e.type === 'card'){
        return { minuto: e.minute, tipo: e.card_type === 'red' ? 'Cartão vermelho' : 'Cartão amarelo', equipa, jogador: e.player, assistencia: null };
      }
      return { minuto: e.minute, tipo: 'Golo', equipa, jogador: e.player, assistencia: null };
    });

    // ---- Escalações (formato defensivo, várias hipóteses) ----
    const lineupsBody = lineupsRaw.status === 'fulfilled' ? lineupsRaw.value : null;
    const { status: lineupsStatus, equipas: escalacoes } = extrairEscalacoes(lineupsBody, detail.home_team_id, detail.home_team, detail.away_team_id, detail.away_team);

    // ---- Estatísticas (formato defensivo) ----
    const statsBody = statsRaw.status === 'fulfilled' ? statsRaw.value : null;
    let estatisticas = [];
    if (statsBody){
      const bloco = statsBody.stats || statsBody;
      const chavesConhecidas = [
        ['possession', 'Posse de bola', '%'],
        ['shots', 'Remates', ''],
        ['shots_on_target', 'Remates à baliza', ''],
        ['corners', 'Cantos', ''],
        ['fouls', 'Faltas', ''],
        ['yellow_cards', 'Cartões amarelos', ''],
        ['red_cards', 'Cartões vermelhos', ''],
        ['offsides', 'Fora de jogo', '']
      ];
      chavesConhecidas.forEach(([chave, label, sufixo]) => {
        const v = bloco[chave];
        if (v && (v.home !== undefined || v.away !== undefined)){
          estatisticas.push({ label, casa: v.home ?? '-', fora: v.away ?? '-', sufixo });
        }
      });
    }

    res.setHeader('Cache-Control', 's-maxage=20, stale-while-revalidate=40');
    return res.status(200).json({ jogo, eventos, escalacoes, lineupsStatus, h2h, estatisticas, previsao });

  } catch (err) {
    return res.status(500).json({ error: `Falha de rede/parse: ${err.message}` });
  }
}
