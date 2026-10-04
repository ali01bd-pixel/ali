(() => {
  'use strict';

  const tools = {
    upscaler: {
      label: 'AI Image Upscaler',
      sub: 'Real-ESRGAN browser enhancement',
      src: 'tools/upscaler/index.html',
      color: '#c4b5fd',
      storage: 'ali-hub-use-upscaler'
    },
    vectorizer: {
      label: 'Flat-Color Vectorizer',
      sub: 'Clean SVG / EPS tracing',
      src: 'tools/vectorizer/index.html',
      color: '#67e8f9',
      storage: 'ali-hub-use-vectorizer'
    },
    metadata: {
      label: 'Stock Metadata Generator',
      sub: 'AI titles, keywords & Excel export',
      src: 'tools/metadata/index.html',
      color: '#86efac',
      storage: 'ali-hub-use-metadata'
    }
  };

  const navButtons = [...document.querySelectorAll('[data-open-tool]')];
  const home = document.getElementById('homeView');
  const toolView = document.getElementById('toolView');
  const title = document.getElementById('activeToolTitle');
  const sub = document.getElementById('activeToolSub');
  const frame = document.getElementById('activeToolFrame');
  const lastUseEls = new Map();

  let active = 'home';

  function safeGet(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  function safeSet(key, value) {
    try { localStorage.setItem(key, value); } catch {}
  }
  function recordUse(id) {
    const now = new Date();
    safeSet(tools[id].storage, String(Date.now()));
    safeSet('ali-hub-last-tool', id);
    const label = now.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    if (lastUseEls.has(id)) lastUseEls.get(id).textContent = `Last opened ${label}`;
  }
  function refreshLastUse() {
    for (const [id, el] of lastUseEls) {
      const value = Number(safeGet(tools[id].storage) || 0);
      if (!value) { el.textContent = 'Not used this browser yet'; continue; }
      const date = new Date(value);
      el.textContent = `Last opened ${date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`;
    }
  }
  function hashTool() {
    return (location.hash || '').replace('#','').trim().toLowerCase();
  }
  function setHash(id) {
    const next = id === 'home' ? '' : `#${id}`;
    if (next !== location.hash) history.replaceState(null, '', `${location.pathname}${location.search}${next}`);
  }

  function openTool(id, pushHash = true) {
    if (!tools[id]) { showHome(false); return; }
    active = id;
    home.classList.add('hidden');
    toolView.classList.add('active');
    navButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.openTool === id));
    title.textContent = tools[id].label;
    sub.textContent = tools[id].sub;
    if (frame.dataset.tool !== id) {
      frame.src = tools[id].src;
      frame.dataset.tool = id;
    }
    recordUse(id);
    if (pushHash) setHash(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showHome(pushHash = true) {
    active = 'home';
    home.classList.remove('hidden');
    toolView.classList.remove('active');
    navButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.openTool === 'home'));
    if (pushHash) setHash('home');
    refreshLastUse();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  document.querySelectorAll('[data-card-tool]').forEach(card => {
    card.addEventListener('click', event => {
      const id = card.dataset.cardTool;
      if (event.target.closest('button') || event.target.closest('a')) return;
      openTool(id);
    });
  });

  navButtons.forEach(btn => btn.addEventListener('click', () => {
    const id = btn.dataset.openTool;
    id === 'home' ? showHome() : openTool(id);
  }));

  document.getElementById('homeNav').addEventListener('click', () => showHome());
  document.getElementById('reloadBtn').addEventListener('click', () => {
    if (active === 'home') return;
    frame.contentWindow?.location.reload();
  });
  document.getElementById('standaloneBtn').addEventListener('click', () => {
    if (active !== 'home' && tools[active]) window.open(tools[active].src, '_blank', 'noopener,noreferrer');
  });
  document.getElementById('homeFromToolBtn').addEventListener('click', () => showHome());

  for (const id of Object.keys(tools)) {
    const el = document.querySelector(`[data-last-use="${id}"]`);
    if (el) lastUseEls.set(id, el);
  }
  refreshLastUse();

  const browserBadge = document.getElementById('browserStatus');
  const browserText = navigator.gpu ? 'WebGPU detected' : 'WASM-compatible browser';
  browserBadge.textContent = browserText;
  document.getElementById('systemNote').textContent = `${navigator.hardwareConcurrency || 2} logical CPU cores · ${browserText}`;

  window.addEventListener('message', event => {
    if (event.source !== frame.contentWindow) return;
    const data = event.data || {};
    if (data.type !== 'ali-hub-resize') return;
    const height = Number(data.height);
    if (Number.isFinite(height) && height > 400 && height < 100000) frame.style.height = `${Math.max(700, Math.ceil(height + 2))}px`;
  });

  window.addEventListener('hashchange', () => {
    const id = hashTool();
    if (id === 'home' || !id) showHome(false); else if (tools[id]) openTool(id, false); else showHome(false);
  });

  document.addEventListener('keydown', event => {
    if (event.target.matches('input,textarea,select')) return;
    if (event.key === 'h' || event.key === 'H') showHome();
    if (event.key === '1') openTool('upscaler');
    if (event.key === '2') openTool('vectorizer');
    if (event.key === '3') openTool('metadata');
  });

  const initial = hashTool() || safeGet('ali-hub-last-tool');
  if (initial && tools[initial]) openTool(initial, false); else showHome(false);
})();
