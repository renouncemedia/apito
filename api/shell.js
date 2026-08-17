/* ============================================================
   APITO V2 — SHELL / NAVIGATION BEHAVIOR
   Pass 2 of APITO_DESIGN_SYSTEM_V2.md, Section 16.

   Single canonical source for shell markup (sidebar, topbar,
   bottom navigation) and shell-owned behavior (theme state,
   active-destination logic), consumed identically by all five
   pages. Markup lives here exactly once — each page calls
   ApitoShell.renderSidebar() / renderTopbar() / renderBottomNav()
   from a one-line inline <script> at the position that markup
   should occupy, so every page renders from the same source
   without any build step.

   Loaded synchronously and early (linked in <head>, no defer)
   so the theme attribute is applied before first paint. DOM
   injection uses document.currentScript, which is only valid
   while the calling inline <script> is synchronously executing
   — so each render*() call must be made directly from an inline
   <script> tag placed at the desired markup position, not from
   an event handler or callback.
   ============================================================ */

(function () {
  'use strict';

  /* ---------- Theme (single source of truth for all pages/surfaces) ---------- */
  var THEME_KEY = 'apito-theme';

  function getTheme() {
    return localStorage.getItem(THEME_KEY) || 'dark';
  }
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }
  function setTheme(theme) {
    localStorage.setItem(THEME_KEY, theme);
    applyTheme(theme);
  }
  function toggleTheme() {
    setTheme(getTheme() === 'light' ? 'dark' : 'light');
  }

  // Applied immediately on load (this file is included early, undeferred,
  // in <head>) so there is no flash of the wrong theme before the shell
  // or page content renders.
  applyTheme(getTheme());

  /* ---------- Current-page / active-destination logic ----------
     One shared algorithm so desktop sidebar and mobile bottom-nav
     always agree, and so entity/detail screens never get a
     misleading primary active state (Pass 2 brief, Section 5). */
  function currentFile() {
    var last = location.pathname.split('/').pop();
    return last === '' ? 'index.html' : last;
  }
  function isHome() {
    return currentFile() === 'index.html';
  }
  function activeDestination() {
    if (!isHome()) return null; // entity/detail screens: no invented primary state
    var filtro = new URLSearchParams(location.search).get('filtro');
    if (filtro === 'ao-vivo') return 'ao-vivo';
    if (filtro === 'favoritos') return 'favoritos';
    return 'inicio';
  }

  /* ---------- Icons (kept identical to V1 for visual continuity —
     icon redesign is not in scope for Pass 2) ---------- */
  var ICONS = {
    inicio: '<path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>',
    live: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3" fill="currentColor"/>',
    star: '<path d="M12 17.3l-6.2 3.6 1.6-7-5.4-4.7 7.1-.6L12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7z"/>',
    theme: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    search: '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>'
  };
  function icon(name) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' + ICONS[name] + '</svg>';
  }

  var DEST_LABEL = { inicio: 'Início', 'ao-vivo': 'Ao vivo', favoritos: 'Favoritos' };
  var DEST_ICON = { inicio: 'inicio', 'ao-vivo': 'live', favoritos: 'star' };
  var DEST_HREF = {
    inicio: 'index.html',
    'ao-vivo': 'index.html?filtro=ao-vivo',
    favoritos: 'index.html?filtro=favoritos'
  };

  /* On Home, Início/Ao vivo/Favoritos are in-page state toggles handled by
     the page's own script via document-level click delegation (unchanged
     V1 behavior, preserved per the Pass 2 brief). Elsewhere they are real
     links back to Home with the matching query string — also unchanged
     V1 behavior for those four pages, just no longer duplicated per file. */
  function destItemMarkup(dest, id, forBottomNav) {
    var active = activeDestination() === dest;
    var cls = (forBottomNav ? 'bn-item' : 'nav-item') + (active ? ' active' : '');
    var current = active ? ' aria-current="page"' : '';
    var label = DEST_LABEL[dest];
    var ic = icon(DEST_ICON[dest]);
    var inner = forBottomNav
      ? '<span class="bn-icon">' + ic + '</span><span class="bn-label">' + label + '</span>'
      : ic + '<span>' + label + '</span>';

    if (isHome()) {
      return '<button type="button" class="' + cls + '" id="' + id + '"' + current + '>' + inner + '</button>';
    }
    return '<a href="' + DEST_HREF[dest] + '" class="' + cls + '" id="' + id + '"' + current + '>' + inner + '</a>';
  }

  function temaItemMarkup(id, forBottomNav) {
    var cls = forBottomNav ? 'bn-item' : 'nav-item';
    var ic = icon('theme');
    var inner = forBottomNav
      ? '<span class="bn-icon">' + ic + '</span><span class="bn-label">Tema</span>'
      : ic + '<span>Tema</span>';
    return '<button type="button" class="' + cls + '" id="' + id + '">' + inner + '</button>';
  }

  /* ---------- Sidebar (desktop) ---------- */
  function sidebarHTML() {
    return (
      '<nav class="sidebar" aria-label="Navegação principal">' +
        '<div class="brand">' +
          '<div class="mark" aria-hidden="true"></div><span class="name">Apito</span>' +
        '</div>' +
        destItemMarkup('inicio', 'nav-inicio', false) +
        destItemMarkup('ao-vivo', 'nav-ao-vivo', false) +
        destItemMarkup('favoritos', 'nav-favoritos', false) +
        temaItemMarkup('nav-tema', false) +
        '<div class="sidebar-promo">' +
          '<div class="title">Apito PRO</div>' +
          '<div class="sub">Estatísticas avançadas e sem limites de pedidos.</div>' +
          '<div class="cta">Em breve</div>' +
        '</div>' +
      '</nav>'
    );
  }

  /* ---------- Topbar (all five pages) ----------
     Search + favorites filter are Home-specific functionality
     (they operate on Home's own in-page match list) and are only
     rendered there; other pages get brand + theme control only,
     per Section 10 of the design system. */
  function topbarHTML() {
    var extra = '';
    if (isHome()) {
      extra =
        '<div class="search-box">' + icon('search') +
          '<input type="text" id="search-input" placeholder="Procurar equipa...">' +
        '</div>' +
        '<button class="icon-btn" id="fav-toggle" title="Favoritos" aria-label="Mostrar só jogos favoritos">' + icon('star') + '</button>';
    }
    return (
      '<div class="topbar">' +
        '<div class="mobile-brand">' +
          '<div class="mark" aria-hidden="true"></div><span class="name">Apito</span>' +
        '</div>' +
        extra +
        '<button class="icon-btn" id="theme-toggle" title="Tema" aria-label="Alternar entre tema claro e escuro">' + icon('theme') + '</button>' +
      '</div>'
    );
  }

  /* ---------- Bottom navigation (mobile, persistent) ---------- */
  function bottomNavHTML() {
    return (
      '<nav class="bottom-nav" aria-label="Navegação principal (móvel)">' +
        destItemMarkup('inicio', 'bn-inicio', true) +
        destItemMarkup('ao-vivo', 'bn-ao-vivo', true) +
        destItemMarkup('favoritos', 'bn-favoritos', true) +
        temaItemMarkup('bn-tema', true) +
      '</nav>'
    );
  }

  /* ---------- Injection ----------
     Inserts markup immediately before the currently-executing
     inline <script> tag, i.e. exactly where that tag sits in the
     page — this is what lets every page keep its markup source
     in this one file while still controlling *where* each piece
     renders. */
  function inject(html) {
    var script = document.currentScript;
    if (!script || !script.parentNode) return;
    script.insertAdjacentHTML('beforebegin', html);
  }

  window.ApitoShell = {
    renderSidebar: function () { inject(sidebarHTML()); },
    renderTopbar: function () { inject(topbarHTML()); },
    renderBottomNav: function () { inject(bottomNavHTML()); },
    toggleTheme: toggleTheme,
    getTheme: getTheme
  };

  /* Theme toggling is fully shell-owned: every element that can trigger
     it (#theme-toggle in the topbar, #nav-tema in the sidebar, #bn-tema
     in the bottom nav) is generated by this file on every page, so one
     delegated listener here is the single implementation — no page
     duplicates or re-wires this behavior itself. This also fixes the
     V1 bug where detail.html and player.html rendered a "Tema" control
     with no click handler attached at all. */
  document.addEventListener('click', function (e) {
    if (e.target.closest('#theme-toggle') || e.target.closest('#nav-tema') || e.target.closest('#bn-tema')) {
      toggleTheme();
    }
  });
})();
