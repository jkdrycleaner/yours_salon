(() => {
  const icons = {
    dashboard: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
    collection: '<path d="M4 6.5h16v11H4z"/><path d="M7 10h10M7 13.5h6"/>',
    expense: '<path d="M4 6.5h16v11H4z"/><path d="M7 10h6M7 13.5h9"/><path d="M16.5 4v4"/>',
    salary: '<path d="M4 6.5h16v11H4z"/><circle cx="12" cy="12" r="2.5"/><path d="M7 9.5h.01M17 14.5h.01"/>',
    counter: '<path d="M4 6.5h16v11H4z"/><path d="M7 10h10M7 13.5h5"/><circle cx="17" cy="15" r="1"/>',
    more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
    attendance: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/><path d="m9 15 2 2 4-4"/>',
    customers: '<circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 5.5a3 3 0 0 1 0 5.8M17 14a5 5 0 0 1 3.5 4.8"/>',
    reports: '<path d="M4 19.5V4.5h16v15z"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
    profile: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4v-.2a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1z"/>',
    logout: '<path d="M10 4H5v16h5M14 8l4 4-4 4M8 12h10"/>',
    crown: '<path d="m4 8 4 3 4-6 4 6 4-3-2 10H6z"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>'
  };

  function svg(name, className = '') {
    return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || ''}</svg>`;
  }

  function initials(name) {
    const parts = String(name || 'User').trim().split(/\s+/).filter(Boolean);
    return (parts.slice(0, 2).map(part => part[0]).join('') || 'U').toUpperCase();
  }

  function hasPage(session, key) {
    if (session?.employee?.role === 'Admin') return true;
    if (session?.pageAccess?.[key] === true) return true;
    const fallback = {
      'collection-records': 'Customer Entry',
      'expense-records': 'Daily Expense',
      'salary-records': 'Salary',
      'counter-records': 'Cash At Counter',
      reports: 'Reports'
    }[key];
    return Boolean(fallback && session?.permissions?.includes(fallback));
  }

  window.salonMobile = { icons, svg, initials, hasPage };

  function currentSection(path) {
    if (path === '/employee-dashboard' || path === '/employee-dashboard.html') return 'dashboard';
    if (path.startsWith('/collection')) return 'collection';
    if (path.startsWith('/expense')) return 'expense';
    if (path.startsWith('/salary')) return 'salary';
    if (path.startsWith('/counter')) return 'counter';
    return '';
  }

  function makeLink(href, label, icon, active) {
    const link = document.createElement('a');
    link.className = `m-nav-item${active ? ' active' : ''}`;
    link.href = href;
    link.innerHTML = `${svg(icon)}<span>${label}</span>`;
    return link;
  }

  function makeMoreTile(href, label, icon, color, soon = false) {
    const link = document.createElement('a');
    link.className = `m-more-tile ${color}`;
    link.href = href;
    link.innerHTML = `<span class="m-more-icon">${svg(icon)}</span><span>${label}</span>${soon ? '<span class="soon">Soon</span>' : ''}`;
    return link;
  }

  function build(session) {
    if (session?.employee?.role === 'Admin') return;
    if (document.body.classList.contains('mobile-employee')) return;
    document.body.classList.add('mobile-employee');

    const currentPath = location.pathname.replace(/\/+$/, '') || '/';
    const section = currentSection(currentPath);
    const employee = session.employee || {};
    const displayName = employee.employeeName || 'Employee';

    const header = document.createElement('header');
    header.className = 'm-mobile-header';
    const headerPhoto = section === 'dashboard'
      ? ''
      : `<span class="m-avatar">${employee.photoUrl ? `<img src="${employee.photoUrl}" alt="">` : initials(displayName)}</span>`;
    header.innerHTML = `
      <a class="m-brand" href="/employee-dashboard" aria-label="Go to dashboard">
        <span class="m-logo">Y</span>
        <span class="m-brand-name">YOURS SALON</span>
      </a>${headerPhoto}`;
    document.body.prepend(header);

    const nav = document.createElement('nav');
    nav.className = 'm-mobile-nav';
    nav.setAttribute('aria-label', 'Employee navigation');
    const navItems = [
      { key: 'dashboard', href: '/employee-dashboard', label: 'Dashboard', icon: 'dashboard' },
      { key: 'collection-records', href: session?.pageAccess?.['collection-entry'] !== false ? '/collection-entry' : '/collection-table', label: 'My Work', icon: 'collection' },
      { key: 'salary-records', href: '/salary-table', label: 'Salary', icon: 'salary' },
      { key: 'counter-records', href: '/counter-table', label: 'Counter Cash', icon: 'counter' }
    ];
    for (const item of navItems) {
      if (item.key === 'dashboard' || hasPage(session, item.key)) {
        nav.append(makeLink(item.href, item.label, item.icon, section === item.key.split('-')[0]));
      }
    }
    const moreButton = document.createElement('button');
    moreButton.type = 'button';
    const moreActive = !['dashboard', 'collection', 'salary', 'counter'].includes(section);
    moreButton.className = 'm-nav-item no-btn-theme' + (moreActive ? ' active' : '');
    moreButton.setAttribute('aria-haspopup', 'dialog');
    moreButton.setAttribute('aria-expanded', 'false');
    moreButton.innerHTML = `${svg('more')}<span>More</span>`;
    nav.append(moreButton);
    document.body.append(nav);

    const overlay = document.createElement('div');
    overlay.className = 'm-more-overlay';
    const sheet = document.createElement('section');
    sheet.className = 'm-more-sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-label', 'More options');
    sheet.innerHTML = '<div class="m-sheet-handle"></div><h2>More</h2>';
    const grid = document.createElement('div');
    grid.className = 'm-more-grid';
    if (hasPage(session, 'expense-records')) grid.append(makeMoreTile('/expense-table', 'Expense', 'expense', 'blue'));
    grid.append(
      makeMoreTile('/attendance', 'Attendance', 'attendance', 'green', true),
      makeMoreTile('/customers', 'Customers', 'customers', 'blue', true)
    );
    if (hasPage(session, 'reports')) grid.append(makeMoreTile('/reports', 'Reports', 'reports', 'amber'));
    grid.append(
      makeMoreTile('/profile', 'Profile', 'profile', 'purple'),
      makeMoreTile('/settings', 'Settings', 'settings', 'amber')
    );
    const logout = document.createElement('button');
    logout.type = 'button';
    logout.className = 'm-more-tile red';
    logout.innerHTML = `<span class="m-more-icon">${svg('logout')}</span><span>Logout</span>`;
    logout.addEventListener('click', () => window.salonAuth?.logout?.());
    grid.append(logout);
    sheet.append(grid);
    document.body.append(overlay, sheet);

    function closeMore() {
      overlay.classList.remove('open');
      sheet.classList.remove('open');
      moreButton.classList.remove('active');
      moreButton.setAttribute('aria-expanded', 'false');
    }

    function openMore() {
      overlay.classList.add('open');
      sheet.classList.add('open');
      moreButton.classList.add('active');
      moreButton.setAttribute('aria-expanded', 'true');
    }

    moreButton.addEventListener('click', () => {
      if (sheet.classList.contains('open')) closeMore(); else openMore();
    });
    overlay.addEventListener('click', closeMore);
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeMore();
    });

    window.salonMobile = { closeMore, openMore, icons, svg, initials, hasPage };
  }

  (async () => {
    try {
      const session = await window.salonReady;
      if (!session || session.employee?.role === 'Admin') return;
      build(session);
      const brandingReady = fetch('/api/shop-branding').then(response => response.ok ? response.json() : null).catch(() => null).then(branding => {
        const brand = document.querySelector('.mobile-employee .m-brand-name');
        const logo = document.querySelector('.mobile-employee .m-logo');
        if (branding?.name && brand) brand.textContent = branding.name;
        if (branding?.logoUrl && logo) logo.innerHTML = `<img src="${branding.logoUrl}" alt="">`;
      });
      window.salonMobileShellReady = Promise.race([
        brandingReady,
        new Promise(resolve => setTimeout(resolve, 800))
      ]);
      await window.salonMobileShellReady;
    } catch {
      // The mobile shell is an enhancement; pages remain usable without it.
    }
  })();
})();
