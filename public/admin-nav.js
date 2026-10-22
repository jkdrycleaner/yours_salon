(() => {
  const tokenKey = 'salon_google_credential';
  const allItems = [
    { href: '/admin-dashboard', label: 'Dashboard', admin: true, page: 'dashboard', icon: '<path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h8M8 17h5"/>' },
    { href: '/employee-dashboard', label: 'Dashboard', employee: true, page: 'dashboard', icon: '<path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h5"/>' },
    { href: '/collection-table', label: 'Collection Records', permission: 'Customer Entry', page: 'collection-records', icon: '<path d="M4 5.5h16v13H4z"/><path d="M8 9h8M8 12.5h5M8 16h3"/>' },
    { href: '/expense-table', label: 'Expense Records', permission: 'Daily Expense', page: 'expense-records', icon: '<path d="M4 5.5h16v13H4z"/><path d="M8 9h5M8 12.5h8M8 16h6"/><path d="M16 9h2v2"/>' },
    { href: '/salary-table', label: 'Salary Records', permission: 'Salary', page: 'salary-records', icon: '<path d="M4 5.5h16v13H4z"/><circle cx="12" cy="12" r="3"/><path d="M7 9h.01M17 15h.01"/>' },
    { href: '/counter-table', label: 'Counter Cash Records', permission: 'Cash At Counter', page: 'counter-records', icon: '<path d="M4 6.5h16v11H4z"/><path d="M7 10h10M7 13.5h6"/><circle cx="17" cy="15.5" r="1"/>' },
    { href: '/employees', label: 'Employee List', admin: true, page: 'employee-list', icon: '<circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 5.5a3 3 0 0 1 0 5.8M17 14a5 5 0 0 1 3.5 4.8"/>' }
  ];
  const navGroups = [
    {
      id: 'reports',
      label: 'Reports',
      admin: true,
      icon: '<path d="M4 19.5V4.5h16v15z"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
      children: [
        { href: '/reports?period=daily', label: 'Daily', page: 'reports', period: 'daily' },
        { href: '/reports?period=weekly', label: 'Weekly', page: 'reports', period: 'weekly' },
        { href: '/reports?period=monthly', label: 'Monthly', page: 'reports', period: 'monthly' },
        { href: '/activity-report', label: 'Activity Report', page: 'activity-report' }
      ]
    },
    {
      id: 'configuration',
      label: 'Configuration',
      admin: true,
      icon: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4v-.2a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1z"/>',
      children: [
        { href: '/config', label: 'General', page: 'configuration' },
        { href: '/user-access', label: 'User Access', page: 'user-access' },
        { href: '/shop-details', label: 'Shop Details', page: 'shop-information' },
        { href: '/expense-types', label: 'Expense Types', page: 'expense-types' },
        { href: '/rate-list', label: 'Rate List', page: 'rate-list' },
        { href: '/bulk-entry', label: 'Bulk Entry', page: 'bulk-entry' }
      ]
    }
  ];
  const pageMeta = {
    '/admin-dashboard': { parent: 'Admin Portal', parentHref: '/admin-dashboard', title: 'Dashboard', titleHref: '/admin-dashboard' },
    '/employee-dashboard': { parent: 'Employee Portal', parentHref: '/employee-dashboard', title: 'Dashboard', titleHref: '/employee-dashboard' },
    '/collection-entry': { parent: 'Collection Records', parentHref: '/collection-table', title: 'Add Customer Entry', titleHref: '/collection-entry' },
    '/collection-table': { parent: 'Customer Entry', parentHref: '/collection-entry', title: 'Collection Records', titleHref: '/collection-table' },
    '/expense-entry': { parent: 'Expense Records', parentHref: '/expense-table', title: 'Add Expense Entry', titleHref: '/expense-entry' },
    '/expense-table': { parent: 'Daily Expense', parentHref: '/expense-entry', title: 'Expense Records', titleHref: '/expense-table' },
    '/salary-entry': { parent: 'Salary Records', parentHref: '/salary-table', title: 'Add Salary Entry', titleHref: '/salary-entry' },
    '/salary-table': { parent: 'Salary', parentHref: '/salary-entry', title: 'Salary Records', titleHref: '/salary-table' },
    '/counter-entry': { parent: 'Counter Cash Records', parentHref: '/counter-table', title: 'Add Counter Cash Entry', titleHref: '/counter-entry' },
    '/counter-table': { parent: 'Cash At Counter', parentHref: '/counter-entry', title: 'Counter Cash Records', titleHref: '/counter-table' },
    '/employees': { parent: 'Administration', parentHref: '/admin-dashboard', title: 'Employee List', titleHref: '/employees' },
    '/employee-entry': { parent: 'Employee List', parentHref: '/employees', title: 'Add Employee', titleHref: '/employee-entry' },
    '/user-access': { parent: 'Configuration', parentHref: '/config', title: 'User Access', titleHref: '/user-access' },
    '/expense-types': { parent: 'Configuration', parentHref: '/config', title: 'Expense Types', titleHref: '/expense-types' },
    '/rate-list': { parent: 'Configuration', parentHref: '/config', title: 'Rate List', titleHref: '/rate-list' },
    '/reports': { parent: 'Reports', parentHref: '/reports', title: 'Reports', titleHref: '/reports' },
    '/activity-report': { parent: 'Reports', parentHref: '/reports', title: 'Activity Report', titleHref: '/activity-report' },
    '/config': { parent: 'Configuration', parentHref: '/config', title: 'General Configuration', titleHref: '/config' },
    '/shop-details': { parent: 'Configuration', parentHref: '/config', title: 'Shop Information', titleHref: '/shop-details' },
    '/bulk-entry': { parent: 'Configuration', parentHref: '/config', title: 'Bulk Entry', titleHref: '/bulk-entry' },
    '/password-change': { parent: 'Account', parentHref: '/admin-dashboard', title: 'Change Password', titleHref: '/password-change' },
    '/password-change.html': { parent: 'Account', parentHref: '/admin-dashboard', title: 'Change Password', titleHref: '/password-change.html' }
  };

  function normalizePath(path) {
    return path.replace(/\/+$/, '') || '/';
  }

  const reportPeriods = ['daily', 'weekly', 'monthly'];
  function activePeriod() {
    const period = new URLSearchParams(window.location.search).get('period');
    return reportPeriods.includes(period) ? period : 'monthly';
  }
  function entryPath(href) {
    return normalizePath(String(href || '').split('?')[0]);
  }
  function isEntryActive(entry, currentPath, period) {
    if (entry.period) return currentPath === '/reports' && entry.period === period;
    return entryPath(entry.href) === currentPath;
  }
  function pageMetaFor(path, period) {
    if (path === '/reports') {
      const label = period.charAt(0).toUpperCase() + period.slice(1);
      return { parent: 'Reports', parentHref: '/reports', title: `${label} Report`, titleHref: `/reports?period=${period}` };
    }
    return pageMeta[path];
  }

  function showSuccess(message = 'Saved successfully.') {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'salon-success-overlay';
      overlay.innerHTML = '<div class="salon-success-card" role="status" aria-live="polite"><div class="salon-success-check" aria-hidden="true">&#10003;</div><strong>Success</strong><p></p></div>';
      overlay.querySelector('p').textContent = message;
      document.body.append(overlay);
      requestAnimationFrame(() => overlay.classList.add('open'));
      window.setTimeout(() => {
        overlay.classList.remove('open');
        window.setTimeout(() => { overlay.remove(); resolve(); }, 160);
      }, 2000);
    });
  }

  window.salonUi = { showSuccess };

  function authHeaders() {
    const token = localStorage.getItem(tokenKey);
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function request(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: { ...authHeaders(), ...(options.headers || {}) }
    });
    const text = await response.text();
    let result = {};
    try { result = text ? JSON.parse(text) : {}; } catch { result = { error: text }; }
    if (!response.ok) throw new Error(result.error || 'Request failed.');
    return result;
  }

  function icon(markup) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke-width', '1.7');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = markup;
    return svg;
  }

  function initials(name) {
    return String(name || 'User').trim().split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase() || 'U';
  }

  function setAvatar(avatar, employee) {
    avatar.replaceChildren();
    const photoUrl = String(employee?.photoUrl || '').trim();
    if (photoUrl) {
      const image = document.createElement('img');
      image.alt = `${employee.employeeName || 'Employee'} photo`;
      image.src = photoUrl;
      image.addEventListener('error', () => { avatar.textContent = initials(employee.employeeName); }, { once: true });
      avatar.append(image);
      return;
    }
    avatar.textContent = initials(employee?.employeeName);
  }

  function allowedEntries(session) {
    const isAdmin = session.employee?.role === 'Admin';
    const singles = allItems.filter(item => {
      if (item.admin) return isAdmin;
      if (item.employee) return !isAdmin;
      if (isAdmin) return true;
      if (session.pageAccess && item.page) return session.pageAccess[item.page] !== false;
      return session.permissions?.includes(item.permission);
    });
    const groups = navGroups
      .filter(group => !group.admin || isAdmin)
      .map(group => ({
        ...group,
        children: group.children.filter(child => !child.admin || isAdmin)
      }))
      .filter(group => group.children.length);
    return [...singles, ...groups];
  }

  function addHeader(session) {
    if (document.querySelector('.salon-header')) return;
    const currentPath = normalizePath(window.location.pathname);
    const period = activePeriod();
    const dashboard = session.employee?.role === 'Admin' ? '/admin-dashboard' : '/employee-dashboard';
    const meta = pageMetaFor(currentPath, period) || {
      parent: session.employee?.role === 'Admin' ? 'Admin Portal' : 'Employee Portal',
      parentHref: dashboard,
      title: document.title.replace(/\s*[—-]\s*YOURS SALON.*$/i, '').trim() || 'Salon Portal',
      titleHref: currentPath
    };
    const entries = allowedEntries(session);
    const employee = session.employee || {};

    const header = document.createElement('header');
    header.className = 'salon-header';
    const brand = document.createElement('a');
    brand.className = 'salon-brand';
    brand.href = dashboard;
    const logo = document.createElement('img');
    logo.className = 'salon-brand-logo';
    logo.alt = '';
    logo.hidden = true;
    const brandCopy = document.createElement('span');
    brandCopy.className = 'salon-brand-copy';
    const shopName = document.createElement('strong');
    shopName.className = 'salon-shop-name';
    shopName.textContent = 'YOURS SALON';
    brandCopy.append(shopName);
    brand.append(logo, brandCopy);

    const actions = document.createElement('div');
    actions.className = 'salon-header-actions';
    const searchWrap = document.createElement('div');
    searchWrap.className = 'salon-search-wrap';
    const search = document.createElement('label');
    search.className = 'salon-search';
    search.setAttribute('aria-label', 'Search pages');
    search.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.3"/><path d="m16 16 4.5 4.5"/></svg>';
    const searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.placeholder = 'Search pages';
    searchInput.autocomplete = 'off';
    search.append(searchInput);
    const searchResults = document.createElement('div');
    searchResults.className = 'salon-search-results';
    searchResults.hidden = true;
    searchWrap.append(search, searchResults);

    const profile = document.createElement('div');
    profile.className = 'salon-profile';
    const profileButton = document.createElement('button');
    profileButton.className = 'salon-profile-button';
    profileButton.type = 'button';
    profileButton.setAttribute('aria-haspopup', 'menu');
    profileButton.setAttribute('aria-expanded', 'false');
    const avatar = document.createElement('span');
    avatar.className = 'salon-avatar';
    setAvatar(avatar, employee);
    const profileName = document.createElement('span');
    profileName.className = 'salon-profile-name';
    profileName.textContent = employee.employeeName || 'User';
    const profileRole = document.createElement('span');
    profileRole.className = 'salon-profile-role';
    profileRole.textContent = employee.accountType || (employee.role === 'Admin' ? 'Admin' : 'Employee');
    profileButton.append(avatar, profileName, profileRole);
    const profileMenu = document.createElement('div');
    profileMenu.className = 'salon-profile-menu';
    profileMenu.hidden = true;
    const password = document.createElement('a');
    password.href = '/password-change';
    password.textContent = 'Change password';
    password.className = 'salon-profile-menu-link';
    if (currentPath === '/password-change' || currentPath === '/password-change.html') password.hidden = true;
    const logout = document.createElement('button');
    logout.type = 'button';
    logout.className = 'salon-profile-menu-link danger';
    logout.textContent = 'Sign out';
    profileMenu.append(password, logout);
    profile.append(profileButton, profileMenu);
    actions.append(searchWrap, profile);
    header.append(brand, actions);

    const pageBar = document.createElement('div');
    pageBar.className = 'salon-page-bar';
    const breadcrumb = document.createElement('div');
    breadcrumb.className = 'salon-breadcrumb';
    const parent = document.createElement('a');
    parent.className = 'salon-breadcrumb-parent';
    parent.href = meta.parentHref || dashboard;
    parent.textContent = meta.parent;
    const separator = document.createElement('span');
    separator.className = 'salon-breadcrumb-separator';
    separator.textContent = '›';
    const current = document.createElement('a');
    current.className = 'salon-breadcrumb-current';
    current.href = meta.titleHref || currentPath;
    current.textContent = meta.title;
    if (normalizePath(current.href) === currentPath || current.getAttribute('href') === currentPath) {
      current.setAttribute('aria-current', 'page');
    }
    breadcrumb.append(parent, separator, current);
    pageBar.append(breadcrumb);

    const overlay = document.createElement('div');
    overlay.className = 'salon-sidebar-overlay';
    const sidebar = document.createElement('aside');
    sidebar.className = 'salon-sidebar';
    sidebar.setAttribute('aria-label', 'Salon navigation');
    const menuToggle = document.createElement('button');
    menuToggle.className = 'salon-menu-toggle';
    menuToggle.type = 'button';
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', 'Open menu');
    menuToggle.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg><span>Menu</span>';
    const nav = document.createElement('nav');
    nav.className = 'salon-nav-items';
    const empty = document.createElement('div');
    empty.className = 'salon-nav-empty';
    empty.textContent = 'No matching pages.';
    empty.hidden = true;
    const searchEntries = [];
    for (const entry of entries) {
      if (entry.children) {
        const group = document.createElement('div');
        group.className = 'salon-nav-group';
        group.dataset.label = entry.label.toLowerCase();
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'salon-nav-group-toggle';
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-controls', `salon-nav-${entry.id}`);
        const groupLabel = document.createElement('span');
        groupLabel.textContent = entry.label;
        const chevron = document.createElement('span');
        chevron.className = 'salon-nav-group-chevron';
        chevron.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
        toggle.append(icon(entry.icon), groupLabel, chevron);
        const submenu = document.createElement('div');
        submenu.className = 'salon-nav-submenu';
        submenu.id = `salon-nav-${entry.id}`;
        const activeGroup = entry.children.some(child => isEntryActive(child, currentPath, period));
        group.classList.toggle('is-active', activeGroup);
        for (const child of entry.children) {
          const link = document.createElement('a');
          const active = isEntryActive(child, currentPath, period);
          link.className = `salon-nav-sublink${active ? ' active' : ''}`;
          link.href = child.href;
          link.dataset.label = child.label.toLowerCase();
          link.dataset.navHref = child.href;
          if (child.period) link.dataset.navPeriod = child.period;
          if (active) link.setAttribute('aria-current', 'page');
          link.textContent = child.label;
          link.addEventListener('click', () => setMenu(false));
          submenu.append(link);
          searchEntries.push({ ...child, group: entry.label });
        }
        group.append(toggle, submenu);
        if (activeGroup) {
          setGroupOpen(group, true);
        } else {
          submenu.hidden = true;
        }
        toggle.addEventListener('click', () => {
          if (!sidebar.classList.contains('open')) {
            setMenu(true);
            setGroupOpen(group, true);
            return;
          }
          setGroupOpen(group, !group.classList.contains('is-open'));
        });
        nav.append(group);
      } else {
        const link = document.createElement('a');
        const active = isEntryActive(entry, currentPath, period);
        link.className = `salon-nav-link${active ? ' active' : ''}`;
        link.href = entry.href;
        link.dataset.label = entry.label.toLowerCase();
        link.dataset.navHref = entry.href;
        if (active) link.setAttribute('aria-current', 'page');
        const label = document.createElement('span');
        label.textContent = entry.label;
        link.append(icon(entry.icon), label);
        link.addEventListener('click', () => setMenu(false));
        nav.append(link);
        searchEntries.push({ ...entry, group: '' });
      }
    }
    nav.append(empty);
    sidebar.append(menuToggle, nav);

    function setMenu(open, showOverlay = open) {
      document.body.classList.toggle('salon-menu-expanded', open);
      document.documentElement.classList.toggle('salon-menu-locked', showOverlay);
      sidebar.classList.toggle('open', open);
      overlay.classList.toggle('open', showOverlay);
      menuToggle.setAttribute('aria-expanded', String(open));
      menuToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    }
    function setGroupOpen(group, open) {
      group.classList.toggle('is-open', open);
      group.querySelector('.salon-nav-group-toggle')?.setAttribute('aria-expanded', String(open));
      const submenu = group.querySelector('.salon-nav-submenu');
      if (submenu) submenu.hidden = !open;
    }
    function refreshActive() {
      const path = normalizePath(window.location.pathname);
      const nextPeriod = activePeriod();
      for (const link of nav.querySelectorAll('[data-nav-href]')) {
        const active = isEntryActive({ href: link.dataset.navHref, period: link.dataset.navPeriod }, path, nextPeriod);
        link.classList.toggle('active', active);
        if (active) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      }
      for (const group of nav.querySelectorAll('.salon-nav-group')) {
        const active = Boolean(group.querySelector('.salon-nav-sublink.active'));
        group.classList.toggle('is-active', active);
        if (active) setGroupOpen(group, true);
      }
      const nextMeta = pageMetaFor(path, nextPeriod);
      if (nextMeta) {
        parent.textContent = nextMeta.parent;
        parent.href = nextMeta.parentHref || dashboard;
        current.textContent = nextMeta.title;
        current.href = nextMeta.titleHref || path;
        current.setAttribute('aria-current', 'page');
      }
    }
    window.salonNav = { refresh: refreshActive };
    function closeSearch() {
      const hadSearch = Boolean(searchInput.value.trim()) || searchWrap.classList.contains('expanded');
      searchResults.hidden = true;
      if (window.matchMedia('(max-width: 620px)').matches) {
        searchWrap.classList.remove('expanded');
      }
      if (hadSearch) {
        searchInput.value = '';
        renderSearch('');
        setMenu(false);
      }
    }
    function closeProfile() {
      profileMenu.hidden = true;
      profileButton.setAttribute('aria-expanded', 'false');
    }
    let searchOpenState = null;
    function renderSearch(value) {
      const query = value.trim().toLowerCase();
      const topLinks = [...nav.querySelectorAll(':scope > .salon-nav-link')];
      const groups = [...nav.querySelectorAll(':scope > .salon-nav-group')];
      if (query && !searchOpenState) {
        searchOpenState = new Map(groups.map(group => [group, group.classList.contains('is-open')]));
      }
      if (!query && searchOpenState) {
        for (const [group, open] of searchOpenState) setGroupOpen(group, open);
        searchOpenState = null;
      }
      let matches = 0;
      for (const link of topLinks) {
        const visible = !query || link.dataset.label.includes(query);
        link.hidden = !visible;
        if (visible) matches += 1;
      }
      for (const group of groups) {
        const groupMatch = !query || group.dataset.label.includes(query);
        const childLinks = [...group.querySelectorAll('.salon-nav-sublink')];
        let visibleChildren = 0;
        for (const link of childLinks) {
          const visible = !query || groupMatch || link.dataset.label.includes(query);
          link.hidden = !visible;
          if (visible) visibleChildren += 1;
        }
        const visible = !query || groupMatch || visibleChildren > 0;
        group.hidden = !visible;
        if (visible) matches += 1;
        if (query && visible) setGroupOpen(group, true);
      }
      empty.hidden = matches > 0;
      searchResults.replaceChildren();
      if (!query) {
        searchResults.hidden = true;
        return;
      }
      const resultItems = searchEntries.filter(item =>
        item.label.toLowerCase().includes(query) || item.group.toLowerCase().includes(query)
      );
      for (const item of resultItems) {
        const link = document.createElement('a');
        link.className = 'salon-search-result';
        link.href = item.href;
        link.textContent = item.group ? `${item.group} › ${item.label}` : item.label;
        searchResults.append(link);
      }
      if (!resultItems.length) {
        const noResult = document.createElement('div');
        noResult.className = 'salon-search-empty';
        noResult.textContent = 'No matching page.';
        searchResults.append(noResult);
      }
      searchResults.hidden = false;
    }

    menuToggle.addEventListener('click', () => setMenu(!sidebar.classList.contains('open')));
    overlay.addEventListener('click', () => setMenu(false));
    profileButton.addEventListener('click', () => {
      const open = profileMenu.hidden;
      profileMenu.hidden = !open;
      profileButton.setAttribute('aria-expanded', String(open));
    });
    logout.addEventListener('click', async () => {
      logout.disabled = true;
      try { await request('/api/logout', { method: 'POST' }); } catch {}
      localStorage.removeItem(tokenKey);
      localStorage.removeItem('salon_user_email');
      location.replace('/login');
    });
    search.addEventListener('click', event => {
      if (window.matchMedia('(max-width: 620px)').matches && !searchWrap.classList.contains('expanded')) {
        event.preventDefault();
        searchWrap.classList.add('expanded');
        searchInput.focus();
      }
    });
    searchInput.addEventListener('input', event => renderSearch(event.target.value));
    searchInput.addEventListener('focus', () => { if (searchInput.value) renderSearch(searchInput.value); });
    document.addEventListener('click', event => {
      if (!searchWrap.contains(event.target)) closeSearch();
      if (!profile.contains(event.target)) closeProfile();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        closeSearch();
        closeProfile();
        setMenu(false);
      }
    });
    document.body.classList.add('salon-layout');
    document.body.prepend(header, pageBar, overlay, sidebar);
    if (!window.salonApplyButtonTheme) {
      const buttonThemeScript = document.createElement('script');
      buttonThemeScript.src = '/btn-theme.js';
      document.head.appendChild(buttonThemeScript);
    }
    fetch('/api/shop-branding', { headers: authHeaders() }).then(response => response.ok ? response.json() : null).then(branding => {
      if (!branding) return;
      if (branding.name) shopName.textContent = branding.name;
      if (branding.logoUrl) { logo.src = branding.logoUrl; logo.hidden = false; }
      if (window.salonApplyButtonTheme) window.salonApplyButtonTheme(branding.login);
    }).catch(() => {});
  }

  async function initialize() {
    const currentPath = normalizePath(window.location.pathname);
    try {
      const session = window.salonReady ? await window.salonReady : await request('/api/session');
      if (!session) return;
      if (session.employee?.mustChangePassword && !['/password-change', '/password-change.html'].includes(currentPath)) {
        location.replace('/password-change');
        return;
      }
      addHeader(session);
    } catch {
      localStorage.removeItem(tokenKey);
      localStorage.removeItem('salon_user_email');
      location.replace('/login');
    }
  }

  if (!['/', '/login', '/login.html'].includes(normalizePath(window.location.pathname))) initialize();
})();
