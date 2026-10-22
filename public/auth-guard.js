(() => {
  const tokenKey = 'salon_google_credential';
  const publicPaths = new Set(['/', '/login', '/login.html']);
  const adminOnlyPaths = new Set([
    '/admin-dashboard', '/reports', '/activity-report', '/employees', '/employee-entry', '/user-access',
    '/expense-types', '/rate-list', '/config', '/shop-details', '/bulk-entry'
  ]);

  function token() {
    return localStorage.getItem(tokenKey) || '';
  }

  function headers(json = false) {
    const result = {};
    if (token()) result.Authorization = `Bearer ${token()}`;
    if (json) result['Content-Type'] = 'application/json';
    return result;
  }

  async function request(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: { ...headers(Boolean(options.body)), ...(options.headers || {}) }
    });
    const text = await response.text();
    let result = {};
    try { result = text ? JSON.parse(text) : {}; } catch { result = { error: text }; }
    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem(tokenKey);
        localStorage.removeItem('salon_user_email');
        location.replace('/login');
      }
      throw new Error(result.error || 'Request failed.');
    }
    return result;
  }

  function clearSession() {
    localStorage.removeItem(tokenKey);
    localStorage.removeItem('salon_user_email');
  }

  async function logout() {
    try {
      await request('/api/logout', { method: 'POST' });
    } catch {
      // Clear the local session even if the network is unavailable.
    }
    clearSession();
    location.replace('/login');
  }

  async function trackPage(session) {
    if (!session) return;
    try {
      await request('/api/activity/page-open', {
        method: 'POST',
        body: JSON.stringify({
          page: document.title.replace(/\s*[—-]\s*YOURS SALON.*$/i, '').trim() || location.pathname,
          route: location.pathname,
          module: location.pathname.split('/')[1] || 'login'
        })
      });
    } catch {
      // A page-open log must never make the page unusable.
    }
  }

  async function initialize() {
    const pagePath = location.pathname.replace(/\/+$/, '') || '/';
    if (publicPaths.has(pagePath)) return null;
    try {
      const session = await request('/api/session');
      const isAdmin = session.employee?.role === 'Admin';
      if (adminOnlyPaths.has(pagePath) && !isAdmin) {
        location.replace('/employee-dashboard');
        return null;
      }
      if (pagePath === '/employee-dashboard' && isAdmin) {
        location.replace('/admin-dashboard');
        return null;
      }
      window.salonSession = session;
      await trackPage(session);
      return session;
    } catch {
      clearSession();
      location.replace('/login');
      return null;
    }
  }

  window.salonAuth = { token, headers, request, logout, clearSession, trackPage };
  window.salonReady = initialize();
})();
