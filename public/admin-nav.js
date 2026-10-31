(() => {
  const tokenKey = 'salon_google_credential';
  const allItems = [
    { href: '/admin-dashboard', label: 'Dashboard', admin: true, page: 'dashboard', emoji: '🏠' },
    { href: '/employee-view', label: 'Employee Dashboard', admin: true, page: 'dashboard', emoji: '🏠' },
    { href: '/employee-dashboard', label: 'Dashboard', employee: true, page: 'dashboard', emoji: '🏠' },
    { href: '/collection-table', label: 'Collection', permission: 'Customer Entry', page: 'collection-records', emoji: '💰' },
    { href: '/expense-table', label: 'Expense', permission: 'Daily Expense', page: 'expense-records', emoji: '🧾' },
    { href: '/salary-table', label: 'Salary', permission: 'Salary', page: 'salary-records', emoji: '💵' },
    { href: '/counter-table', label: 'Counter', permission: 'Cash At Counter', page: 'counter-records', emoji: '🏧' },
    { href: '/employees', label: 'Employees', page: 'employee-list', emoji: '👥' }
  ];
  const navGroups = [
    {
      id: 'reports',
      label: 'Reports',
      emoji: '📊',
      children: [
        { href: '/reports?period=daily', label: 'Daily', page: 'reports', period: 'daily' },
        { href: '/reports?period=weekly', label: 'Weekly', page: 'reports', period: 'weekly' },
        { href: '/reports?period=monthly', label: 'Monthly', page: 'reports', period: 'monthly' },
        { href: '/activity-report', label: 'Activity Report', page: 'activity-report' }
      ]
    },
    {
      id: 'configuration',
      label: 'Settings',
      emoji: '⚙️',
      children: [
        { href: '/config', label: 'General', page: 'configuration' },
        { href: '/manage-shops', label: 'Manage Shops', page: 'manage-shops', admin: true },
        { href: '/user-access', label: 'User Access', page: 'user-access', admin: true },
        { href: '/shop-details', label: 'Shop Details', page: 'shop-information' },
        { href: '/expense-types', label: 'Expense Types', page: 'expense-types' },
        { href: '/rate-list', label: 'Rate List', page: 'rate-list' },
        { href: '/bulk-entry', label: 'Bulk Entry', page: 'bulk-entry' },
        { href: '/import-validation', label: 'Import Validation', page: 'import-validation' }
      ]
    }
  ];
  const pageMeta = {
    '/admin-dashboard': { parent: 'Admin Portal', parentHref: '/admin-dashboard', title: 'Dashboard', titleHref: '/admin-dashboard' },
    '/employee-dashboard': { parent: 'Employee Portal', parentHref: '/employee-dashboard', title: 'Dashboard', titleHref: '/employee-dashboard' },
    '/employee-view': { parent: 'Employee Portal', parentHref: '/employee-view', title: 'Employee Dashboard', titleHref: '/employee-view' },
    '/profile': { parent: 'Employee Portal', parentHref: '/employee-dashboard', title: 'My Profile', titleHref: '/profile' },
    '/settings': { parent: 'Employee Portal', parentHref: '/employee-dashboard', title: 'Settings', titleHref: '/settings' },
    '/attendance': { parent: 'Employee Portal', parentHref: '/employee-dashboard', title: 'Attendance', titleHref: '/attendance' },
    '/customers': { parent: 'Employee Portal', parentHref: '/employee-dashboard', title: 'Customers', titleHref: '/customers' },
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
    '/manage-shops': { parent: 'Configuration', parentHref: '/config', title: 'Manage Shops', titleHref: '/manage-shops' },
    '/user-access': { parent: 'Configuration', parentHref: '/config', title: 'User Access', titleHref: '/user-access' },
    '/expense-types': { parent: 'Configuration', parentHref: '/config', title: 'Expense Types', titleHref: '/expense-types' },
    '/rate-list': { parent: 'Configuration', parentHref: '/config', title: 'Rate List', titleHref: '/rate-list' },
    '/reports': { parent: 'Reports', parentHref: '/reports', title: 'Reports', titleHref: '/reports' },
    '/activity-report': { parent: 'Reports', parentHref: '/reports', title: 'Activity Report', titleHref: '/activity-report' },
    '/config': { parent: 'Configuration', parentHref: '/config', title: 'General Configuration', titleHref: '/config' },
    '/shop-details': { parent: 'Configuration', parentHref: '/config', title: 'Shop Information', titleHref: '/shop-details' },
    '/bulk-entry': { parent: 'Configuration', parentHref: '/config', title: 'Bulk Entry', titleHref: '/bulk-entry' },
    '/import-validation': { parent: 'Configuration', parentHref: '/config', title: 'Import Validation', titleHref: '/import-validation' },
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
      if (item.page) return session.pageAccess?.[item.page] === true;
      return session.permissions?.includes(item.permission);
    });
    const groups = navGroups
      .map(group => ({
        ...group,
        children: group.children.filter(child => {
          if (child.admin) return isAdmin;
          if (isAdmin) return true;
          if (child.page) return session.pageAccess?.[child.page] === true;
          return true;
        })
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
      title: document.title.replace(/\s*[—-]\s*(?:YOURS|SAMPLE)\s*SALON.*$/i, '').trim() || 'Salon Portal',
      titleHref: currentPath
    };
    const entries = allowedEntries(session);
    const employee = session.employee || {};

    const header = document.createElement('header');
    header.className = 'salon-header';
    const brand = document.createElement('a');
    brand.className = 'salon-brand';
    brand.href = dashboard;
    
    const resolvedShopName = (session.shop?.shopName || 'SAMPLE SALON').toUpperCase();
    const logo = document.createElement('div');
    logo.className = 'salon-brand-logo';
    logo.textContent = resolvedShopName.charAt(0) || 'S';
    
    const brandCopy = document.createElement('div');
    brandCopy.className = 'salon-brand-copy';
    const shopName = document.createElement('b');
    shopName.className = 'salon-shop-name';
    shopName.textContent = resolvedShopName;
    const shopSub = document.createElement('small');
    shopSub.className = 'salon-shop-sub';
    shopSub.textContent = session.employee?.role === 'Admin' ? 'Admin Portal' : 'Employee Portal';
    brandCopy.append(shopName, shopSub);
    brand.append(logo, brandCopy);

    const actions = document.createElement('div');
    actions.className = 'salon-header-actions';
    const searchWrap = document.createElement('div');
    searchWrap.className = 'salon-search-wrap';
    const search = document.createElement('label');
    search.className = 'salon-search';
    search.setAttribute('aria-label', 'Search pages');
    search.innerHTML = '<span>🔍</span>';
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
    const avatar = document.createElement('div');
    avatar.className = 'salon-avatar';
    setAvatar(avatar, employee);
    
    const profileText = document.createElement('div');
    profileText.className = 'salon-profile-text';
    const profileName = document.createElement('span');
    profileName.className = 'salon-profile-name';
    profileName.textContent = employee.employeeName || 'User';
    const profileRole = document.createElement('span');
    profileRole.className = 'salon-profile-role';
    profileRole.textContent = employee.role === 'Admin' ? 'ADMIN' : (employee.accountType || 'STAFF');
    profileText.append(profileName, profileRole);
    
    profileButton.append(avatar, profileText);
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

    const sidebar = document.createElement('aside');
    sidebar.className = 'salon-sidebar';
    sidebar.id = 'salon-sidebar';
    sidebar.setAttribute('aria-label', 'Salon navigation');

    header.append(brand, actions);
    const nav = document.createElement('nav');
    nav.className = 'salon-nav-items';
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
        
        const iconSpan = document.createElement('i');
        iconSpan.className = 'salon-nav-icon';
        iconSpan.textContent = entry.emoji || '⚙️';
        
        const groupLabel = document.createElement('span');
        groupLabel.textContent = entry.label;
        toggle.append(iconSpan, groupLabel);

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
          link.addEventListener('click', () => {
            document.querySelectorAll('.salon-nav-group').forEach(g => g.classList.remove('is-open'));
          });
          submenu.append(link);
          searchEntries.push({ ...child, group: entry.label });
        }
        group.append(toggle, submenu);

        toggle.addEventListener('click', (e) => {
          e.stopPropagation();
          const isOpen = group.classList.contains('is-open');
          document.querySelectorAll('.salon-nav-group').forEach(g => {
            if (g !== group) g.classList.remove('is-open');
          });
          group.classList.toggle('is-open', !isOpen);
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
        
        const iconSpan = document.createElement('i');
        iconSpan.className = 'salon-nav-icon';
        iconSpan.textContent = entry.emoji || '📄';
        
        const label = document.createElement('span');
        label.textContent = entry.label;
        link.append(iconSpan, label);
        nav.append(link);
        searchEntries.push({ ...entry, group: '' });
      }
    }
    sidebar.append(nav);

    function closeProfile() {
      profileMenu.hidden = true;
      profileButton.setAttribute('aria-expanded', 'false');
    }
    function closeSearch() {
      searchResults.hidden = true;
    }
    function renderSearch(query) {
      query = String(query || '').trim().toLowerCase();
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
        noResult.style.padding = '8px 12px';
        noResult.style.color = '#8b86a3';
        noResult.style.fontSize = '12px';
        noResult.textContent = 'No matching pages.';
        searchResults.append(noResult);
      }
      searchResults.hidden = false;
    }

    profileButton.addEventListener('click', event => {
      event.stopPropagation();
      const open = profileMenu.hidden;
      profileMenu.hidden = !open;
      profileButton.setAttribute('aria-expanded', String(open));
    });

    logout.addEventListener('click', async () => {
      try { await request('/api/logout', { method: 'POST' }); } catch {}
      localStorage.removeItem(tokenKey);
      localStorage.removeItem('salon_user_email');
      location.replace('/login');
    });

    searchInput.addEventListener('input', event => renderSearch(event.target.value));
    searchInput.addEventListener('focus', () => { if (searchInput.value) renderSearch(searchInput.value); });
    document.addEventListener('click', event => {
      if (!searchWrap.contains(event.target)) closeSearch();
      if (!profile.contains(event.target)) closeProfile();
      if (!sidebar.contains(event.target)) {
        document.querySelectorAll('.salon-nav-group').forEach(g => g.classList.remove('is-open'));
      }
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        closeSearch();
        closeProfile();
        document.querySelectorAll('.salon-nav-group').forEach(g => g.classList.remove('is-open'));
      }
    });

    document.body.classList.add('salon-layout');
    document.body.prepend(header, pageBar, sidebar);

    // Dynamic Shop Branding
    fetch('/api/shop-branding', { headers: authHeaders() }).then(response => response.ok ? response.json() : null).then(branding => {
      if (!branding) return;
      if (branding.theme) {
        const themeSlug = String(branding.theme).toLowerCase().replace(/\s+/g, '-');
        document.documentElement.setAttribute('data-theme', themeSlug);
        if (document.body) document.body.setAttribute('data-theme', themeSlug);
        localStorage.setItem('salon_theme', themeSlug);
      }
      if (branding.name) {
        shopName.textContent = branding.name;
        logo.textContent = branding.name.trim().charAt(0).toUpperCase();
      }
      if (branding.logoUrl) {
        logo.innerHTML = `<img src="${branding.logoUrl}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:14px;">`;
      }
    }).catch(() => {});
  }

  async function initialize() {
    const currentPath = normalizePath(window.location.pathname);
    try {
      const session = window.salonReady ? await window.salonReady : await request('/api/session');
      if (!session) return;
      const themeVal = session.shop?.theme || session.theme || 'Theme 2';
      const themeSlug = String(themeVal).toLowerCase().replace(/\s+/g, '-');
      document.documentElement.setAttribute('data-theme', themeSlug);
      if (document.body) document.body.setAttribute('data-theme', themeSlug);
      localStorage.setItem('salon_theme', themeSlug);
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