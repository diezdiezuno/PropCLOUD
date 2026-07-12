/**
 * PropTools – Shared UI Components
 * ─────────────────────────────────
 * Uso en cada página (una sola llamada):
 *
 *   const { profile, apps } = await initComponents({ active: 'firmas' });
 *
 * Requiere que `sb` (Supabase client) esté definido antes de este script.
 */

// ─── Logo ─────────────────────────────────────────────────────────────────────

const PROPTOOLS_SVG = `<span class="pt-logo-bar"></span><span class="pt-logo-wordmark"><span class="pt-logo-prop">Prop</span><span class="pt-logo-tools">TOOLS</span></span>`;

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ─── CSS ──────────────────────────────────────────────────────────────────────

function injectComponentStyles() {
  if (document.getElementById('pt-components-css')) return;
  const style = document.createElement('style');
  style.id = 'pt-components-css';
  style.textContent = `
    :root {
      --grad-start: #FF3A5C;
      --grad-mid:   #C044E8;
      --grad-end:   #5B4FE8;
      --blue:      #5B4FE8;
      --blue-dark: #4A3DB5;
      --ink:       #0E0E1A;
      --ink-soft:  #4B5260;
      --surface:   #ffffff;
      --surface2:  #F4F5F7;
      --border:    #E2E5EA;
      --header-h:  88px;
      --sidebar-w: 232px;
      --radius:    8px;
      --font:      'DM Sans', sans-serif;
      --font-mono: 'DM Mono', monospace;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: var(--font); color: var(--ink); background: var(--surface2); min-height: 100vh; }

    #pt-layout {
      display: grid;
      grid-template-columns: var(--sidebar-w) 1fr;
      grid-template-rows: var(--header-h) 1fr auto;
      min-height: 100vh;
    }

    /* Header */
    #pt-header {
      grid-column: 1 / -1; position: sticky; top: 0; z-index: 100;
      height: var(--header-h); background: var(--surface); border-bottom: 1px solid var(--border);
      display: flex; align-items: center; padding: 0 28px; gap: 10px;
    }
    #pt-header .pt-logo-mark {
      display: flex; align-items: center; gap: 10px;
      text-decoration: none; color: var(--ink); flex-shrink: 0;
    }
    .pt-logo-bar {
      display: inline-block; width: 6px; height: 32px; border-radius: 3px; flex-shrink: 0;
      background: linear-gradient(to bottom, var(--grad-start), var(--grad-mid), var(--grad-end));
    }
    .pt-logo-wordmark { font-size: 20px; line-height: 1; letter-spacing: -0.5px; white-space: nowrap; }
    .pt-logo-prop  { font-weight: 300; color: var(--ink); }
    .pt-logo-tools { font-weight: 900; letter-spacing: -1px; color: var(--ink); }
    #pt-header .pt-app-badge { font-weight: 300; color: var(--ink-soft); font-size: 14px; }
    #pt-header .pt-header-spacer { flex: 1; }
    #pt-header .pt-tenant-logo { height: 50px; width: auto; object-fit: contain; }

    /* Sidebar */
    #pt-sidebar {
      background: var(--surface); border-right: 1px solid var(--border);
      display: flex; flex-direction: column; padding: 24px 16px; gap: 2px;
      position: sticky; top: var(--header-h); height: calc(100vh - var(--header-h)); overflow-y: auto;
    }
    #pt-sidebar .pt-nav-section-label {
      font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
      color: var(--ink-soft); padding: 12px 12px 6px; opacity: 0.7;
    }
    #pt-sidebar .pt-nav-section-admin { margin-top: 8px; }
    #pt-sidebar a.pt-nav-item {
      display: flex; align-items: center; gap: 10px; padding: 9px 12px;
      border-radius: var(--radius); text-decoration: none; font-size: 14px;
      font-weight: 500; color: var(--ink-soft); transition: background 0.12s, color 0.12s; line-height: 1;
    }
    #pt-sidebar a.pt-nav-item .pt-nav-icon {
      width: 18px; height: 18px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
    }
    #pt-sidebar a.pt-nav-item:hover       { background: var(--surface2); color: var(--ink); }
    #pt-sidebar a.pt-nav-item.active      { background: #EDEAFF; color: var(--blue); }
    #pt-sidebar a.pt-nav-item-admin:hover { background: #F5F3FF; color: #6D28D9; }
    #pt-sidebar a.pt-nav-item-admin.active{ background: #EDE9FE; color: #6D28D9; }

    #pt-sidebar .pt-sidebar-footer {
      margin-top: auto; padding-top: 16px; border-top: 1px solid var(--border);
    }
    #pt-sidebar .pt-logout-btn {
      width: 100%; display: flex; align-items: center; gap: 10px; padding: 9px 12px;
      border-radius: var(--radius); background: none; border: none; cursor: pointer;
      font-family: var(--font); font-size: 14px; font-weight: 500; color: var(--ink-soft);
      transition: background 0.12s, color 0.12s;
    }
    #pt-sidebar .pt-logout-btn:hover { background: #FEF2F2; color: #DC2626; }

    /* Main */
    #pt-main { padding: 32px 36px; min-width: 0; }

    /* Footer — fixed al fondo */
    #pt-footer {
      position: fixed; bottom: 0; left: 0; right: 0; z-index: 50;
      border-top: 1px solid var(--border); background: var(--surface);
      height: 48px; padding: 0 28px;
      display: flex; align-items: center;
    }
    #pt-footer .pt-footer-left {
      display: flex; align-items: center; gap: 6px; flex: 1;
    }
    #pt-footer .pt-footer-proptools-name {
      font-size: 12px; font-weight: 700; color: var(--ink);
    }
    #pt-footer .pt-footer-version {
      font-family: var(--font-mono); font-size: 10px; color: #B0B8C8; letter-spacing: .04em;
    }
    #pt-footer .pt-footer-center {
      position: absolute; left: 50%; transform: translateX(-50%);
    }
    #pt-footer .pt-footer-sig {
      font-family: Helvetica, Arial, sans-serif; font-size: 12px; color: #B0B8C8; letter-spacing: .04em;
    }
    #pt-footer .pt-footer-right {
      flex: 1; display: flex; justify-content: flex-end; align-items: center; gap: 8px;
    }
    #pt-footer .pt-footer-10101 {
      font-family: var(--font-mono); font-size: 15px; font-weight: 700;
      color: var(--ink); letter-spacing: .02em;
      display: flex; align-items: baseline; text-decoration: none;
    }
    #pt-footer .pt-footer-10101:hover { opacity: .75; }
    #pt-footer .pt-footer-cursor {
      color: #22c55e; animation: pt-blink 1.1s step-end infinite;
    }
    @keyframes pt-blink { 0%,100%{opacity:1} 50%{opacity:0} }
    #pt-footer .pt-footer-domain {
      font-family: var(--font-mono); font-size: 11px; color: #9BA3AF;
    }
    #pt-footer .pt-footer-year {
      font-family: var(--font-mono); font-size: 11px; color: #C4C9D4;
    }

    /* Nav horizontal en header (cuando no hay sidebar) */
    #pt-header-nav {
      display: flex; align-items: center; gap: 2px; margin-left: 8px;
    }
    #pt-header-nav a.pt-hnav-item {
      display: flex; align-items: center; gap: 6px;
      padding: 6px 10px; border-radius: 6px;
      text-decoration: none; font-size: 13px; font-weight: 500;
      color: var(--ink-soft); transition: background 0.12s, color 0.12s;
      white-space: nowrap;
    }
    #pt-header-nav a.pt-hnav-item:hover { background: var(--surface2); color: var(--ink); }
    #pt-header-nav a.pt-hnav-item.active { background: #EDEAFF; color: var(--blue); }
    #pt-header-nav a.pt-hnav-item-admin:hover { background: #F5F3FF; color: #6D28D9; }
    #pt-header-nav a.pt-hnav-item-admin.active { background: #EDE9FE; color: #6D28D9; }
    #pt-header-nav .pt-hnav-divider {
      width: 1px; height: 20px; background: var(--border); margin: 0 4px;
    }
    #pt-header .pt-logout-btn {
      display: flex; align-items: center; gap: 6px;
      padding: 6px 10px; border-radius: 6px;
      background: none; border: none; cursor: pointer;
      font-family: var(--font); font-size: 13px; font-weight: 500;
      color: var(--ink-soft); transition: background 0.12s, color 0.12s;
    }
    #pt-header .pt-logout-btn:hover { background: #FEF2F2; color: #DC2626; }

    /* Mobile */
    #pt-sidebar-toggle { display: none; background: none; border: none; cursor: pointer; padding: 6px; color: var(--ink); }
    @media (max-width: 768px) {
      #pt-layout { grid-template-columns: 1fr; }
      #pt-sidebar-toggle { display: flex; }
      #pt-sidebar {
        position: fixed; top: var(--header-h); left: 0; width: var(--sidebar-w);
        height: calc(100vh - var(--header-h)); z-index: 90;
        transform: translateX(-100%); transition: transform 0.2s ease;
        box-shadow: 4px 0 24px rgba(0,0,0,0.08);
      }
      #pt-sidebar.open { transform: translateX(0); }
      #pt-main { padding: 24px 20px; }
      #pt-sidebar-backdrop {
        display: none; position: fixed; inset: 0; top: var(--header-h);
        background: rgba(0,0,0,0.3); z-index: 89;
      }
      #pt-sidebar-backdrop.open { display: block; }
    }
  `;
  document.head.appendChild(style);
}

// ─── Header ───────────────────────────────────────────────────────────────────

function renderHeader({ tenantLogo = '', tenantName = 'Tenant', apps = [], active = '', role = 'agent' } = {}) {
  const el = document.getElementById('pt-header');
  if (!el) return;

  const hasSidebar = !!document.getElementById('pt-sidebar');

  // Nav horizontal: solo si no hay sidebar
  let navHTML = '';
  if (!hasSidebar && apps.length > 0) {
    const toolApps  = apps.filter(a => a.requires_role !== 'admin');
    const adminApps = apps.filter(a => a.requires_role === 'admin' && role === 'admin');

    const buildLink = (app) => `
      <a href="${esc(app.href)}"
         class="pt-hnav-item${app.requires_role === 'admin' ? ' pt-hnav-item-admin' : ''}${active === app.slug ? ' active' : ''}">
        ${app.icon_svg}${esc(app.label)}
      </a>`;

    const adminSection = adminApps.length
      ? `<div class="pt-hnav-divider"></div>${adminApps.map(buildLink).join('')}`
      : '';

    navHTML = `
      <nav id="pt-header-nav">
        ${toolApps.map(buildLink).join('')}
        ${adminSection}
        <div class="pt-hnav-divider"></div>
        <button class="pt-logout-btn" onclick="window.__ptLogout()">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Salir
        </button>
      </nav>`;
  }

  el.innerHTML = `
    <button id="pt-sidebar-toggle" aria-label="Menú" onclick="window.__ptToggleSidebar()">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <line x1="3" y1="6"  x2="21" y2="6"/>
        <line x1="3" y1="12" x2="21" y2="12"/>
        <line x1="3" y1="18" x2="21" y2="18"/>
      </svg>
    </button>
    <div class="pt-logo-mark">
      ${PROPTOOLS_SVG}
    </div>
    ${navHTML}
    <div class="pt-header-spacer"></div>
    ${tenantLogo ? `<img src="${esc(tenantLogo)}" alt="${esc(tenantName)}" class="pt-tenant-logo" />` : ''}
  `;
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function renderSidebar({ apps = [], active = '', role = 'agent' } = {}) {
  const el = document.getElementById('pt-sidebar');
  if (!el) return;

  const toolApps  = apps.filter(a => a.requires_role !== 'admin');
  const adminApps = apps.filter(a => a.requires_role === 'admin' && role === 'admin');

  const buildLink = (app) => `
    <a href="${esc(app.href)}"
       class="pt-nav-item${app.requires_role === 'admin' ? ' pt-nav-item-admin' : ''}${active === app.slug ? ' active' : ''}"
       aria-current="${active === app.slug ? 'page' : 'false'}">
      <span class="pt-nav-icon">${app.icon_svg}</span>
      ${esc(app.label)}
    </a>`;

  el.innerHTML = `
    <span class="pt-nav-section-label">Herramientas</span>
    ${toolApps.map(buildLink).join('')}
    ${adminApps.length ? `
      <span class="pt-nav-section-label pt-nav-section-admin">Administración</span>
      ${adminApps.map(buildLink).join('')}
    ` : ''}
    <div class="pt-sidebar-footer">
      <button class="pt-logout-btn" onclick="window.__ptLogout()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
        Cerrar sesión
      </button>
    </div>
  `;

  if (!document.getElementById('pt-sidebar-backdrop')) {
    const backdrop = document.createElement('div');
    backdrop.id = 'pt-sidebar-backdrop';
    backdrop.onclick = () => window.__ptToggleSidebar(false);
    document.body.appendChild(backdrop);
  }
}

// ─── Footer ───────────────────────────────────────────────────────────────────

// ─── Versión ─────────────────────────────────────────────────────────────────
const PT_VERSION = '1.0.0';

function renderFooter() {
  const el = document.getElementById('pt-footer');
  if (!el) return;
  const year = new Date().getFullYear();
  el.innerHTML = `
    <div class="pt-footer-left">
      <span class="pt-footer-proptools-name">PropTools</span>
      <span class="pt-footer-version">v${PT_VERSION}</span>
    </div>
    <div class="pt-footer-center">
      <span class="pt-footer-sig">dB^r&gt;</span>
    </div>
    <div class="pt-footer-right">
      <a href="https://diezdiez.uno" target="_blank" rel="noopener noreferrer" class="pt-footer-10101">
        10101<span class="pt-footer-cursor">&#x258C;</span>
      </a>
      <span class="pt-footer-domain">diezdiez.uno</span>
      <span class="pt-footer-year">&copy; ${year}</span>
    </div>
  `;
}

// ─── initComponents ───────────────────────────────────────────────────────────

/**
 * Inicializa toda la UI en una sola llamada.
 *
 * 1. Verifica sesión → redirige a /perfil/ si no hay
 * 2. Consulta perfil del usuario (users + tenants)
 * 3. Llama RPC get_tenant_apps() → plan del tenant + overrides individuales
 * 4. Filtra apps por rol (admin ve sección Administración)
 * 5. Renderiza header, sidebar y footer
 * 6. Retorna { profile, apps } para uso en la página
 *
 * @param {object} opts
 * @param {string} opts.active    Slug de la página activa
 * @param {string} [opts.version] Versión para el footer
 * @returns {Promise<{ profile: object, apps: Array } | null>}
 */
async function initComponents({ active = '', version = '' } = {}) {
  // Modo embebido: dentro del admin de PropCLOUD (iframe) no pintamos
  // header/sidebar propios — el shell lo pone PropCLOUD.
  const EMBEDDED = window.self !== window.top || new URLSearchParams(location.search).has('embed');
  if (!EMBEDDED) injectComponentStyles();

  if (typeof sb === 'undefined') {
    console.error('[PropTools] initComponents: `sb` no está definido.');
    return null;
  }

  // 1. Sesión (compartida con PropCLOUD vía cookie-storage)
  let session = (await sb.auth.getSession()).data.session;
  if (!session) {
    session = await new Promise(resolve => {
      const timeout = setTimeout(() => resolve(null), 3000);
      const { data: { subscription } } = sb.auth.onAuthStateChange((_event, s) => {
        if (s) { clearTimeout(timeout); subscription.unsubscribe(); resolve(s); }
      });
    });
  }
  if (!session) {
    // login único: el de PropCLOUD
    const target = '/admin/login';
    if (EMBEDDED) { window.top.location.href = target; } else { window.location.href = target; }
    return null;
  }

  // 2. Perfil (users). Si no existe (p. ej. un admin de PropCLOUD que nunca
  //    usó las herramientas), se auto-provisiona desde tenant_admins.
  let { data: profile } = await sb
    .from('users')
    .select('*, tenants(*)')
    .eq('auth_id', session.user.id)
    .single();

  if (!profile) {
    const { data: adm } = await sb
      .from('tenant_admins').select('tenant_id, role').eq('user_id', session.user.id).single();
    if (adm) {
      await sb.from('users').upsert({
        auth_id:   session.user.id,
        tenant_id: adm.tenant_id,
        email:     session.user.email,
        name:      session.user.email?.split('@')[0] || 'Admin',
        role:      adm.role === 'admin' ? 'admin' : 'agent',
      }, { onConflict: 'auth_id' });
      ({ data: profile } = await sb
        .from('users').select('*, tenants(*)').eq('auth_id', session.user.id).single());
    }
  }

  if (!profile) {
    console.warn('[PropTools] No se encontró perfil.');
    if (!EMBEDDED) {
      renderHeader();
      renderSidebar({ apps: [], active, role: 'agent' });
      renderFooter();
    }
    return null;
  }

  // 3. Apps: catálogo fijo filtrado por tenants.proptools_apps (plan del tenant)
  const APPS_CATALOG = [
    { slug: 'firmas',       label: 'Firmas',       href: '/tools/firmas/',       nav_order: 1, requires_role: null,    icon_svg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>' },
    { slug: 'tarjetas',     label: 'Tarjetas',     href: '/tools/tarjetas/',     nav_order: 2, requires_role: null,    icon_svg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>' },
    { slug: 'rotulos',      label: 'Rótulos',      href: '/tools/rotulos/',      nav_order: 3, requires_role: null,    icon_svg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="12" rx="2"/><line x1="12" y1="16" x2="12" y2="21"/></svg>' },
    { slug: 'valoraciones', label: 'Valoraciones', href: '/tools/valoraciones/', nav_order: 4, requires_role: null,    icon_svg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="3 17 9 11 13 15 21 7"/><polyline points="14 7 21 7 21 14"/></svg>' },
    { slug: 'calendario',   label: 'Calendario',   href: '/tools/calendario/',   nav_order: 5, requires_role: null,    icon_svg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' },
    { slug: 'equipos',      label: 'Equipos',      href: '/tools/equipos/',      nav_order: 6, requires_role: null,    icon_svg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>' },
    { slug: 'admin',        label: 'Admin',        href: '/tools/admin/',        nav_order: 9, requires_role: 'admin', icon_svg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>' },
  ];
  const enabled = profile.tenants?.proptools_apps || [];
  let resolvedApps = APPS_CATALOG.filter(a => a.requires_role === 'admin' || enabled.includes(a.slug));

  // 4 + 5. Render (solo standalone — embebido usa el shell de PropCLOUD)
  if (!EMBEDDED) {
    renderHeader({
      tenantLogo: profile.tenants?.logo_url || '',
      tenantName: profile.tenants?.name     || 'Tenant',
      apps: resolvedApps,
      active,
      role: profile.role,
    });
    renderSidebar({ apps: resolvedApps, active, role: profile.role });
    renderFooter();
  } else {
    // Embebido en PropCLOUD: sin chrome propio (header/sidebar/footer) ni
    // título de página (lo pone el shell), fondo transparente para que se
    // integre con el fondo #f5f5f7 del admin, y layouts sin la fila del header.
    document.body.classList.add('pt-embedded');
    const st = document.createElement('style');
    st.textContent = `
      #pt-header, #pt-sidebar, #pt-footer, .page-header { display: none !important; }
      body { background: transparent !important; }
      .app-screen { grid-template-rows: 0 100vh !important; }
      #pt-main { padding-top: 0 !important; }
      .results-bar { top: 0 !important; }
    `;
    document.head.appendChild(st);
  }

  return { profile, apps: resolvedApps };
}

// ─── Helpers globales ─────────────────────────────────────────────────────────

window.__ptToggleSidebar = function (force) {
  const sidebar  = document.getElementById('pt-sidebar');
  const backdrop = document.getElementById('pt-sidebar-backdrop');
  if (!sidebar) return;
  const open = typeof force === 'boolean' ? force : !sidebar.classList.contains('open');
  sidebar.classList.toggle('open', open);
  backdrop?.classList.toggle('open', open);
};

window.__ptLogout = async function () {
  try { if (typeof sb !== 'undefined') await sb.auth.signOut(); }
  catch (e) { console.warn('[PropTools] Logout error:', e); }
  window.location.href = '/admin/login';
};

// export { renderHeader, renderSidebar, renderFooter, initComponents };
