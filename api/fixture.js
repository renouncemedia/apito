// /api/fixture.js — Bzzoiro Sports Data (BSD)
// Formatos de incidents/lineups confirmados com dados reais em 2026-08-11.
const BASE = 'https://sports.bzzoiro.com/api/v2';

function mapEstado(status){
  if (status === 'notstarted' || status === 'upcoming') return 'NS';
  if (status === 'finished') return 'FT';
  return '1H';
}

function nomeTipoEvento(inc){
  if (inc.type === 'goal') return 'Golo';
  if (inc.type === 'card') return inc.card_type === 'red' ? 'Cartão vermelho' : 'Cartão amarelo';
  if (inc.type === 'substitution') return 'Substituição';
  return null; // "period", "injuryTime" não são eventos visíveis
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

    const [incidentsRaw, lineupsRaw] = await Promise.allSettled([
      fetch(`${BASE}/events/${id}/incidents/`, { headers }).then(r => r.ok ? r.json() : null),
      fetch(`${BASE}/events/${id}/lineups/`, { headers }).then(r => r.ok ? r.json() : null)
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

    // ---- Eventos (formato 100% confirmado) ----
    const incidentsBody = incidentsRaw.status === 'fulfilled' ? incidentsRaw.value : null;
    const listaIncidentes = incidentsBody?.incidents || [];
    const eventos = listaIncidentes
      .map(inc => {
        const tipo = nomeTipoEvento(inc);
        if (!tipo) return null;
        const equipa = inc.is_home === true ? detail.home_team : (inc.is_home === false ? detail.away_team : '');
        let jogador, extra = null;
        if (inc.type === 'substitution'){
          jogador = `${inc.player_out} ⇄ ${inc.player_in}`;
        } else {
          jogador = inc.player;
          if (inc.type === 'goal' && inc.assist) extra = `assist: ${inc.assist}`;
        }
        return { minuto: inc.minute, tipo, equipa, jogador, extra };
      })
      .filter(Boolean)
      .sort((a, b) => (b.minuto ?? 0) - (a.minuto ?? 0)); // mais recente primeiro

    // ---- Escalações (formato 100% confirmado) ----
    const lineupsBody = lineupsRaw.status === 'fulfilled' ? lineupsRaw.value : null;
    const lineupsStatus = lineupsBody?.lineup_status || 'unavailable';
    const bloco = lineupsBody?.lineups || {};
    function mapTime(t){
      if (!t) return null;
      return {
        equipa: t.team_name,
        formacao: t.formation,
        titulares: (t.players || []).map(p => ({ nome: p.name, numero: p.jersey_number, posicao: p.position, capitao: !!p.captain })),
        suplentes: (t.substitutes || []).map(p => ({ nome: p.name, numero: p.jersey_number, posicao: p.position }))
      };
    }
    const escalacoes = [mapTime(bloco.home), mapTime(bloco.away)].filter(Boolean);

    // ---- Jogadores em falta (lesões/suspensões) ----
    const emFalta = lineupsBody?.unavailable_players ? {
      casa: (lineupsBody.unavailable_players.home || []).map(p => ({ nome: p.name, motivo: p.reason || p.status })),
      fora: (lineupsBody.unavailable_players.away || []).map(p => ({ nome: p.name, motivo: p.reason || p.status }))
    } : null;

    // ---- Estatísticas + momentum + posições médias (formato confirmado com dados reais) ----
    const statsResp = await fetch(`${BASE}/events/${id}/stats/`, { headers }).then(r => r.ok ? r.json() : null).catch(() => null);
    const statsHome = statsResp?.stats?.home;
    const statsAway = statsResp?.stats?.away;
    let estatisticas = [];
    if (statsHome && statsAway){
      const chaves = [
        ['ball_possession', 'Posse de bola', '%'],
        ['total_shots', 'Remates', ''],
        ['shots_on_target', 'Remates à baliza', ''],
        ['corner_kicks', 'Cantos', ''],
        ['fouls', 'Faltas', ''],
        ['yellow_cards', 'Cartões amarelos', ''],
        ['red_cards', 'Cartões vermelhos', ''],
        ['offsides', 'Fora de jogo', ''],
        ['pass_accuracy_pct', 'Precisão de passe', '%']
      ];
      chaves.forEach(([chave, label, sufixo]) => {
        const c = statsHome[chave], f = statsAway[chave];
        if (c !== undefined && f !== undefined){
          estatisticas.push({ label, casa: typeof c === 'number' ? Math.round(c*10)/10 : c, fora: typeof f === 'number' ? Math.round(f*10)/10 : f, sufixo });
        }
      });
      if (statsHome.xg?.actual !== undefined){
        estatisticas.push({ label: 'xG (golos esperados)', casa: statsHome.xg.actual.toFixed(2), fora: statsAway.xg.actual.toFixed(2), sufixo: '' });
      }
    }

    const momentum = Array.isArray(statsResp?.momentum) ? statsResp.momentum.map(m => ({ minuto: m.m, valor: m.v })) : [];

    const posicoesMedias = statsResp?.average_positions ? {
      casa: (statsResp.average_positions.home || []).map(p => ({ nome: p.name, x: p.x, y: p.y, posicao: p.pos, numero: p.n })),
      fora: (statsResp.average_positions.away || []).map(p => ({ nome: p.name, x: p.x, y: p.y, posicao: p.pos, numero: p.n }))
    } : null;

    res.setHeader('Cache-Control', 's-maxage=20, stale-while-revalidate=40');
    return res.status(200).json({ jogo, eventos, escalacoes, lineupsStatus, h2h, emFalta, estatisticas, momentum, posicoesMedias });

  } catch (err) {
    return res.status(500).json({ error: `Falha de rede/parse: ${err.message}` });
  }
}
