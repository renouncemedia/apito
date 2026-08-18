/* ============================================================
   APITO V2 — SHARED COMPONENTS (BEHAVIOR)
   Pass 3 of APITO_DESIGN_SYSTEM_V2.md, Section 16.

   Canonical, single-source markup + interaction for reusable
   content components, paired with assets/components.css.
   PASS 3A SCOPE: MatchRow only.

   Every page that shows a list of matches calls
   ApitoComponents.matchRow(match, { density }) to get one
   consistent HTML string instead of building its own markup —
   this is what "one canonical MatchRow system" means in
   practice for a static, no-build multi-page app.
   ============================================================ */

(function () {
  'use strict';

  /* ---------- Status classification ----------
     Canonical treatments: scheduled / live / half-time / finished
     / postponed / cancelled. Accepts the raw codes the existing
     API already sends ('1H','NS', …) plus a few common extras, so
     current data keeps working unchanged while the row can also
     represent states the feed doesn't emit yet. Unknown codes fall
     back to "finished", matching V1's existing behavior. */
  var LIVE_CODES = { '1H': 1, '2H': 1, 'ET': 1, 'LIVE': 1 };
  var HT_CODES = { 'HT': 1 };
  var SCHEDULED_CODES = { 'NS': 1, 'TBD': 1 };
  var POSTPONED_CODES = { 'PST': 1, 'POSTPONED': 1 };
  var CANCELLED_CODES = { 'CANC': 1, 'ABD': 1, 'CANCELLED': 1 };

  function classifyStatus(match) {
    var raw = (match.status || '').toUpperCase();
    if (LIVE_CODES[raw]) {
      return { key: 'live', label: (match.minute != null ? match.minute : '') + "'" };
    }
    if (HT_CODES[raw]) {
      return { key: 'ht', label: 'HT' };
    }
    if (SCHEDULED_CODES[raw]) {
      var label = '--:--';
      if (match.kickoff) {
        var d = new Date(match.kickoff);
        if (!isNaN(d)) label = d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
      }
      return { key: 'scheduled', label: label, isTime: true };
    }
    if (POSTPONED_CODES[raw]) {
      return { key: 'postponed', label: 'Adiado' };
    }
    if (CANCELLED_CODES[raw]) {
      return { key: 'cancelled', label: 'Cancelado' };
    }
    return { key: 'finished', label: 'FIM' };
  }

  /* ---------- Crest (image with graceful initials fallback) ---------- */
  function initials(name) {
    return (name || '?').slice(0, 2).toUpperCase();
  }
  function crestHTML(id, name) {
    if (id == null) {
      return '<span class="mr-crest">' + initials(name) + '</span>';
    }
    var fallback = 'this.outerHTML=&quot;<span class=&#39;mr-crest&#39;>' + initials(name) + '</span>&quot;';
    return (
      '<span class="mr-crest"><img src="https://sports.bzzoiro.com/img/team/' + id + '/?bg=transparent" ' +
      'alt="" loading="lazy" onerror="' + fallback + '"></span>'
    );
  }

  /* ---------- Score / fixture-time slot ----------
     For upcoming matches, fixture time replaces score hierarchy —
     Compact shows the kickoff time/date in the shared score slot;
     Standard/Expanded leave each team's score slot empty (reserved
     width, no placeholder digit) rather than showing a misleading
     dash where no score exists yet. */
  function compactScoreOrTime(match, statusInfo) {
    var hasScore = match.home.goals != null && match.away.goals != null;
    if (hasScore) return match.home.goals + '\u2013' + match.away.goals;
    if (statusInfo.isTime) return statusInfo.label;
    return '\u2013';
  }
  function rowScore(goals) {
    return goals == null ? '' : String(goals);
  }

  /* ---------- Compact variant ----------
     Favorite is a capability, not a density rule (design system Section
     5): Compact supports it exactly like Standard/Expanded when the
     calling context provides a favoriteKey. A native <a href> is used
     when there's no favorite control (best default: real link semantics,
     no extra JS needed) — a <button> can't validly nest inside an <a>,
     so when favoriting is enabled the row uses the same role="link"
     container pattern as Standard/Expanded instead. Either way the
     visual result and alignment are identical. */
  function compactRow(match, statusInfo) {
    var live = statusInfo.key === 'live' || statusInfo.key === 'ht';
    var perspClass = match.sidePerspective ? ' mr--persp-' + match.sidePerspective : '';
    var cls = 'mr mr--compact mr--' + statusInfo.key + perspClass;
    var inner = (
      '<span class="mr-status">' +
        (live ? '<span class="mr-status-dot" aria-hidden="true"></span>' : '') +
        '<span class="mr-status-text">' + statusInfo.label + '</span>' +
      '</span>' +
      '<span class="mr-side mr-side--home">' +
        crestHTML(match.home.id, match.home.name) +
        '<span class="mr-name">' + match.home.name + '</span>' +
      '</span>' +
      '<span class="mr-score">' + compactScoreOrTime(match, statusInfo) + '</span>' +
      '<span class="mr-side mr-side--away">' +
        '<span class="mr-name">' + match.away.name + '</span>' +
        crestHTML(match.away.id, match.away.name) +
      '</span>'
    );

    if (!match.favoriteKey) {
      return '<a class="' + cls + '" href="detail.html?id=' + match.id + '" data-match-id="' + match.id + '">' + inner + '</a>';
    }
    var label = 'Detalhes: ' + match.home.name + ' vs ' + match.away.name;
    return (
      '<div class="' + cls + '" role="link" tabindex="0" aria-label="' + label + '" ' +
        'data-match-id="' + match.id + '" data-teams="' + match.favoriteKey + '">' +
        inner + favHTML(match) +
      '</div>'
    );
  }

  /* ---------- Standard / Expanded variant ---------- */
  function teamSide(team, opponentGoals) {
    var winner = team.goals != null && opponentGoals != null && team.goals > opponentGoals;
    var loser = team.goals != null && opponentGoals != null && team.goals < opponentGoals;
    var cls = 'mr-team' + (winner ? ' mr-team--winner' : loser ? ' mr-team--loser' : '');
    var side = team.id != null
      ? '<a class="mr-side" href="team.html?id=' + team.id + '" onclick="event.stopPropagation()">' +
          crestHTML(team.id, team.name) + '<span class="mr-name">' + team.name + '</span></a>'
      : '<span class="mr-side">' + crestHTML(team.id, team.name) + '<span class="mr-name">' + team.name + '</span></span>';
    return '<div class="' + cls + '">' + side + '<span class="mr-score">' + rowScore(team.goals) + '</span></div>';
  }

  function metaHTML(match) {
    if (match.odds && (match.odds.casa || match.odds.empate || match.odds.fora)) {
      return (
        '<div class="mr-meta">' +
          '<span class="mr-odds">' + (match.odds.casa ?? '-') + '</span>' +
          '<span class="mr-odds">' + (match.odds.empate ?? '-') + '</span>' +
          '<span class="mr-odds">' + (match.odds.fora ?? '-') + '</span>' +
        '</div>'
      );
    }
    if (match.meta) {
      return '<div class="mr-meta">' + match.meta + '</div>';
    }
    return '';
  }

  function favHTML(match) {
    if (!match.favoriteKey) return '';
    return (
      '<button type="button" class="mr-fav" aria-label="Adicionar aos favoritos" aria-pressed="false">' +
        '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 17.3l-6.2 3.6 1.6-7-5.4-4.7 7.1-.6L12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7z"/></svg>' +
      '</button>'
    );
  }

  function standardOrExpandedRow(match, statusInfo, density) {
    var live = statusInfo.key === 'live' || statusInfo.key === 'ht';
    var timeClass = statusInfo.isTime ? ' mr-status-time' : '';
    var label = 'Detalhes: ' + match.home.name + ' vs ' + match.away.name;
    return (
      '<div class="mr mr--' + density + ' mr--' + statusInfo.key + '" role="link" tabindex="0" ' +
        'aria-label="' + label + '" data-match-id="' + match.id + '"' +
        (match.favoriteKey ? ' data-teams="' + match.favoriteKey + '"' : '') + '>' +
        '<div class="mr-status">' +
          (live ? '<span class="mr-status-dot" aria-hidden="true"></span>' : '') +
          '<span class="mr-status-text' + timeClass + '">' + statusInfo.label + '</span>' +
        '</div>' +
        '<div class="mr-teams">' +
          teamSide(match.home, match.away.goals) +
          teamSide(match.away, match.home.goals) +
          (density === 'expanded' ? metaHTML(match) : '') +
        '</div>' +
        favHTML(match) +
      '</div>'
    );
  }

  /* ---------- Public renderer ---------- */
  function matchRow(match, options) {
    var density = (options && options.density) || 'standard';
    var statusInfo = classifyStatus(match);
    if (density === 'compact') return compactRow(match, statusInfo);
    return standardOrExpandedRow(match, statusInfo, density);
  }

  /* ---------- FeaturedMatch (editorial context, NOT a MatchRow variant) ----------
     FeaturedMatch → editorial container/context → canonical Expanded
     MatchRow content. This wrapper is the only place in the system that
     may put a gradient around a match — MatchRow itself never owns one,
     at any density (design system Section 3/11). The Expanded row
     rendered inside is 100% unmodified: same markup, same alignment,
     same favorite/status behavior as any other Expanded MatchRow.
     Editorial emphasis is added purely by the wrapper's own surface and
     a scoped color override in components.css — see ".featured-match". */
  function featuredMatch(match) {
    return '<div class="featured-match">' + matchRow(match, { density: 'expanded' }) + '</div>';
  }

  window.ApitoComponents = window.ApitoComponents || {};
  window.ApitoComponents.matchRow = matchRow;
  window.ApitoComponents.featuredMatch = featuredMatch;
  window.ApitoComponents.classifyMatchStatus = classifyStatus;

  /* ---------- StandingsTable / DataTable ----------
     Canonical zone-color mapping, used identically by every
     table in the product (fixes the V1 zone-bar drift). */
  function zoneClass(pos, totalRows) {
    if (pos <= 3) return 'z-qualification';
    if (pos <= 6) return 'z-secondary';
    if (pos <= 7) return 'z-caution';
    return 'z-relegation';
  }
  function standingsHeader() {
    return '<div class="dt-row head"><span></span><span>#</span><span>Equipa</span><span>J</span><span>DG</span><span>V</span><span>Pts</span></div>';
  }
  function standingsRow(team, options) {
    var opts = options || {};
    var zone = zoneClass(team.posicao);
    var selfCls = opts.self ? ' self' : '';
    var saldo = team.saldo > 0 ? '+' + team.saldo : team.saldo;
    var href = team.equipaId != null ? " onclick=\"window.location.href='team.html?id=" + team.equipaId + (opts.leagueId != null ? '&league=' + opts.leagueId : '') + "'\"" : '';
    return (
      '<div class="dt-row' + selfCls + '">' +
        '<span class="dt-zone ' + zone + '"></span>' +
        '<span class="dt-pos">' + team.posicao + '</span>' +
        '<span class="dt-club"' + href + '>' + team.equipa + '</span>' +
        '<span class="dt-n">' + team.jogos + '</span>' +
        '<span class="dt-n">' + saldo + '</span>' +
        '<span class="dt-n">' + team.vitorias + '</span>' +
        '<span class="dt-pts">' + team.pontos + '</span>' +
      '</div>'
    );
  }

  /* ---------- Chip ---------- */
  function chip(label, options) {
    var opts = options || {};
    var cls = 'chip' + (opts.variant === 'live' ? ' chip--live' : '') + (opts.active ? ' active' : '');
    var dot = opts.variant === 'live' ? '<span class="chip-dot" aria-hidden="true"></span>' : '';
    var attrs = (opts.dataAttrs || '');
    return '<button type="button" class="' + cls + '"' + attrs + '>' + dot + label + '</button>';
  }

  /* ---------- StatComparison ---------- */
  function statComparison(stat) {
    var casaNum = parseFloat(stat.casa) || 0, foraNum = parseFloat(stat.fora) || 0;
    var total = casaNum + foraNum || 1;
    var pctCasa = Math.round((casaNum / total) * 100);
    var homeLeads = casaNum > foraNum;
    var awayLeads = foraNum > casaNum;
    return (
      '<div class="stat-comp">' +
        '<span class="stat-val' + (homeLeads ? ' leading' : '') + '">' + stat.casa + (stat.sufixo || '') + '</span>' +
        '<span class="stat-label">' + stat.label + '</span>' +
        '<span class="stat-val' + (awayLeads ? ' leading' : '') + '">' + stat.fora + (stat.sufixo || '') + '</span>' +
        '<div class="stat-bar"><div class="fill-home' + (homeLeads ? ' leading' : '') + '" style="width:' + pctCasa + '%"></div><div class="fill-away' + (awayLeads ? ' leading' : '') + '" style="width:' + (100 - pctCasa) + '%"></div></div>' +
      '</div>'
    );
  }

  /* ---------- StatStrip ---------- */
  function statStrip(items) {
    return (
      '<div class="stat-strip">' +
        items.map(function (it) {
          return '<div class="ss-item"><div class="ss-value">' + it.value + '</div><div class="ss-label">' + it.label + '</div></div>';
        }).join('') +
      '</div>'
    );
  }

  /* ---------- PlayerEntity ---------- */
  function playerEntityList(player) {
    return (
      '<div class="pe-list" onclick="window.location.href=\'player.html?id=' + player.id + '\'">' +
        '<span class="pe-num">' + (player.numero != null ? player.numero : '-') + '</span>' +
        player.nome +
        (player.capitao ? '<span class="pe-cap">C</span>' : '') +
      '</div>'
    );
  }
  function playerEntityCard(player) {
    return (
      '<div class="pe-card" onclick="window.location.href=\'player.html?id=' + player.id + '\'">' +
        '<div class="pe-num">' + (player.numero != null ? player.numero : '-') + '</div>' +
        '<div class="pe-name">' + player.nome + '</div>' +
        '<div class="pe-country">' + (player.pais || '') + '</div>' +
      '</div>'
    );
  }
  function playerEntity(player, options) {
    var variant = (options && options.variant) || 'list';
    return variant === 'grid' ? playerEntityCard(player) : playerEntityList(player);
  }

  /* ---------- EmptyState ---------- */
  function emptyState(text, options) {
    var opts = options || {};
    var action = opts.actionLabel ? ' <span class="action" onclick="' + opts.actionOnClick + '">' + opts.actionLabel + '</span>' : '';
    return '<div class="empty-state">' + text + action + '</div>';
  }

  window.ApitoComponents.standingsHeader = standingsHeader;
  window.ApitoComponents.standingsRow = standingsRow;
  window.ApitoComponents.chip = chip;
  window.ApitoComponents.statComparison = statComparison;
  window.ApitoComponents.statStrip = statStrip;
  window.ApitoComponents.playerEntity = playerEntity;
  window.ApitoComponents.emptyState = emptyState;

  /* ---------- Shared interaction: row click / keyboard navigation ----------
     Compact rows are native <a href>, so browsers already handle click and
     keyboard for them. Standard/Expanded rows are role="link" containers
     (they can't be a real <a> — they contain nested interactive elements:
     per-team links and the favorite button — nesting a link inside a link
     is invalid). One delegated listener here covers every page. */
  document.addEventListener('click', function (e) {
    var row = e.target.closest('.mr[role="link"]');
    if (!row) return;
    if (e.target.closest('.mr-side') || e.target.closest('.mr-fav')) return; // handled by their own href/handler
    var id = row.getAttribute('data-match-id');
    if (id) window.location.href = 'detail.html?id=' + id;
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var row = e.target.closest('.mr[role="link"]');
    if (!row || e.target !== row) return; // only when the row itself is focused, not a child control
    e.preventDefault();
    var id = row.getAttribute('data-match-id');
    if (id) window.location.href = 'detail.html?id=' + id;
  });
})();
