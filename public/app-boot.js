(() => {
  const root = document.documentElement;
  if (root.classList.contains('app-boot-done')) return;
  root.classList.add('app-booting');

  const style = document.createElement('style');
  style.id = 'appBootStyles';
  style.textContent = `
    html.app-booting,html.app-booting body{background:#f4f6f9!important}
    html.app-booting body{overflow:hidden!important}
    html.app-booting body>*:not(#appBootOverlay){visibility:hidden!important}
    #appBootOverlay{position:fixed;z-index:3000;inset:0;display:grid;place-items:center;padding:24px;background:#f4f6f9;color:#1d2939;font-family:Arial,sans-serif;opacity:1;transition:opacity .18s ease}
    #appBootOverlay.closing{opacity:0;pointer-events:none}
    .app-boot-card{width:min(300px,100%);padding:26px 22px;border:1px solid #e1e7ee;border-radius:18px;background:#fff;box-shadow:0 18px 55px #1723321f;text-align:center}
    .app-boot-logo{display:grid;place-items:center;width:58px;height:58px;margin:0 auto 15px;padding:5px;border-radius:18px;background:#fff;color:#9a7414;font:800 26px Arial;overflow:hidden}
    .app-boot-logo img{display:block;width:100%;height:100%;object-fit:contain}
    .app-boot-spinner{width:28px;height:28px;margin:0 auto 14px;border:3px solid #ead9a9;border-top-color:#c99a23;border-radius:50%;animation:appBootSpin .8s linear infinite}
    .app-boot-card strong{display:block;font:700 16px Arial}
    .app-boot-card span{display:block;margin-top:6px;color:#758397;font:12px Arial}
    .app-boot-reload{display:none;margin:16px auto 0;min-height:38px;padding:8px 16px;border:0;border-radius:9px;background:#c99a23;color:#fff;font:700 12px Arial;cursor:pointer}
    #appBootOverlay.error .app-boot-spinner{display:none}
    #appBootOverlay.error .app-boot-reload{display:inline-flex;align-items:center;justify-content:center}
    @keyframes appBootSpin{to{transform:rotate(360deg)}}
    @media(prefers-reduced-motion:reduce){.app-boot-spinner{animation:none}#appBootOverlay{transition:none}}
  `;
  document.head.appendChild(style);

  let finished = false;
  let activeRequests = 0;
  let idleTimer = null;
  let idleResolve = null;
  const nativeFetch = window.fetch.bind(window);
  const ignored = ['/api/activity/page-open', '/api/shop-branding'];
  const brandingReady = nativeFetch('/api/shop-branding')
    .then(response => response.ok ? response.json() : null)
    .catch(() => null);

  window.fetch = (...args) => {
    const url = String(args[0]?.url || args[0] || '');
    if (ignored.some(path => url.includes(path))) return nativeFetch(...args);
    activeRequests += 1;
    clearTimeout(idleTimer);
    return nativeFetch(...args).finally(() => {
      activeRequests = Math.max(0, activeRequests - 1);
      scheduleIdle();
    });
  };

  function scheduleIdle() {
    clearTimeout(idleTimer);
    if (activeRequests > 0 || !idleResolve) return;
    idleTimer = setTimeout(() => {
      if (!idleResolve) return;
      const resolve = idleResolve;
      idleResolve = null;
      resolve();
    }, 350);
  }

  function waitForIdle() {
    return new Promise(resolve => {
      idleResolve = resolve;
      scheduleIdle();
    });
  }

  function ensureOverlay() {
    let overlay = document.getElementById('appBootOverlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'appBootOverlay';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    overlay.innerHTML = '<div class="app-boot-card"><div class="app-boot-logo" aria-hidden="true"></div><div class="app-boot-spinner" aria-hidden="true"></div><strong>Loading...</strong><span>Please wait</span><button class="app-boot-reload" type="button">Reload</button></div>';
    overlay.querySelector('.app-boot-reload').addEventListener('click', () => location.reload());
    document.body.appendChild(overlay);
    document.documentElement.setAttribute('aria-busy', 'true');
    brandingReady.then(applyBranding);
    setTimeout(() => {
      const logo = overlay.querySelector('.app-boot-logo');
      if (logo && !logo.childElementCount && !logo.textContent) logo.textContent = 'Y';
    }, 1200);
    return overlay;
  }

  function applyBranding(branding) {
    const logo = document.querySelector('#appBootOverlay .app-boot-logo');
    if (!logo) return;
    const fallback = String(branding?.name || 'Y').trim().charAt(0) || 'Y';
    const url = branding?.logoUrl || branding?.faviconUrl || branding?.login?.logoUrl;
    if (!url) {
      logo.textContent = fallback;
      return;
    }
    const image = document.createElement('img');
    image.alt = '';
    image.src = url;
    image.addEventListener('error', () => { logo.textContent = fallback; });
    logo.replaceChildren(image);
  }

  function showOverlay() {
    ensureOverlay();
  }

  function finish() {
    if (finished) return;
    finished = true;
    clearTimeout(timeoutId);
    clearTimeout(idleTimer);
    root.classList.remove('app-booting');
    root.classList.add('app-boot-done');
    root.removeAttribute('aria-busy');
    const overlay = document.getElementById('appBootOverlay');
    if (!overlay) return;
    overlay.classList.add('closing');
    setTimeout(() => overlay.remove(), 220);
  }

  function showSlow() {
    if (finished) return;
    const overlay = ensureOverlay();
    overlay.classList.add('error');
    overlay.querySelector('strong').textContent = 'Taking longer than expected';
    overlay.querySelector('span').textContent = 'Check your connection and reload.';
  }

  const timeoutId = setTimeout(showSlow, 15000);
  window.addEventListener('pageshow', event => { if (event.persisted) finish(); });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showOverlay, { once: true });
  } else {
    showOverlay();
  }

  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const nextFrame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const whenLoaded = () => document.readyState === 'complete'
    ? Promise.resolve()
    : new Promise(resolve => window.addEventListener('load', resolve, { once: true }));

  async function waitForProperty(name, limit = 2200) {
    const started = Date.now();
    while (Date.now() - started < limit) {
      if (window[name]) return window[name];
      await delay(50);
    }
    return null;
  }

  (async () => {
    let session = null;
    const ready = await waitForProperty('salonReady', 1200);
    if (ready) {
      try { session = await ready; } catch {}
    }
    const mobileEmployee = window.matchMedia('(max-width:700px)').matches && session?.employee?.role !== 'Admin';
    const shell = await waitForProperty(mobileEmployee ? 'salonMobileShellReady' : 'salonShellReady');
    if (shell) await Promise.race([Promise.resolve(shell).catch(() => {}), delay(1500)]);
    await whenLoaded();
    await nextFrame();
    if (window.salonPageReady) await Promise.race([Promise.resolve(window.salonPageReady).catch(() => {}), delay(8000)]);
    await Promise.race([waitForIdle(), delay(1400)]);
    await nextFrame();
    finish();
  })().catch(() => finish());
})();
