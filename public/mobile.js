
  function killLeftSidebar() {
    if (window.innerWidth <= 768 || window.matchMedia('(max-width: 768px)').matches) {
      document.body.classList.add('mobile-employee');
      const badEls = document.querySelectorAll('#salon-sidebar, .salon-sidebar, .salon-sidebar-overlay, .salon-page-bar, .salon-header');
      badEls.forEach(el => {
        el.style.setProperty('display', 'none', 'important');
        el.style.setProperty('visibility', 'hidden', 'important');
        el.style.setProperty('left', '-9999px', 'important');
      });
    }
  }
  killLeftSidebar();
  window.addEventListener('resize', killLeftSidebar);
  document.addEventListener('DOMContentLoaded', killLeftSidebar);

(() => {
  const icons = {
    dashboard: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    collection: '<path d="M4 6.5h16v11H4z"/><path d="M7 10h10M7 13.5h6"/>',
    expense: '<path d="M4 6.5h16v11H4z"/><path d="M7 10h6M7 13.5h9"/><path d="M16.5 4v4"/>',
    salary: '<path d="M4 6.5h16v11H4z"/><circle cx="12" cy="12" r="2.5"/><path d="M7 9.5h.01M17 14.5h.01"/>',
    counter: '<path d="M4 6.5h16v11H4z"/><path d="M7 10h10M7 13.5h5"/><circle cx="17" cy="15" r="1"/>',
    more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
    attendance: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/><path d="m9 15 2 2 4-4"/>',
    customers: '<circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 5.5a3 3 0 0 1 0 5.8M17 14a5 5 0 0 1 3.5 4.8"/>',
    reports: '<path d="M4 19.5V4.5h16v15z"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
    employees: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    config: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    profile: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4v-.2a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1z"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke-linecap="round" stroke-linejoin="round"/><polyline points="16 17 21 12 16 7" stroke-linecap="round" stroke-linejoin="round"/><line x1="21" y1="12" x2="9" y2="12" stroke-linecap="round" stroke-linejoin="round"/>',
    crown: '<path d="m4 8 4 3 4-6 4 6 4-3-2 10H6z"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    tag: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
    shop: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>'
  };

  function svg(name, className = '') {
    return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || ''}</svg>`;
  }

  function initials(name) {
    const parts = String(name || 'Admin').trim().split(/\s+/).filter(Boolean);
    return (parts.slice(0, 2).map(part => part[0]).join('') || 'A').toUpperCase();
  }

  function hasPage(session, key) {
    if (!session || session?.employee?.role === 'Admin') return true;
    if (session?.pageAccess && key in session.pageAccess) {
      return Boolean(session.pageAccess[key]);
    }
    const fallback = {
      'collection-records': 'Customer Entry',
      'collection-entry': 'Customer Entry',
      'expense-records': 'Daily Expense',
      'expense-entry': 'Daily Expense',
      'salary-records': 'Salary',
      'salary-entry': 'Salary',
      'counter-records': 'Cash At Counter',
      'counter-entry': 'Cash At Counter',
      'expense-categories': 'Configuration',
      'expense-types': 'Configuration',
      reports: 'Reports'
    }[key];
    return Boolean(fallback && session?.permissions?.includes(fallback));
  }

  window.salonMobile = { icons, svg, initials, hasPage };

  function currentSection(path) {
    const p = (path || '').toLowerCase();
    if (p === '/admin-dashboard' || p === '/admin-dashboard.html' || p === '/employee-dashboard' || p === '/employee-dashboard.html' || p === '/employee-view' || p === '/' || p === '/index.html' || p === '/admin.html') {
      return 'dashboard';
    }
    if (p.includes('/collection')) return 'collection';
    if (p.includes('/expense')) return 'expense';
    return 'more';
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
    link.className = `m-more-tile ${color || 'amber'}`;
    link.href = href;
    link.innerHTML = `<span class="m-more-icon">${svg(icon)}</span><span>${label}</span>${soon ? '<span class="soon">Soon</span>' : ''}`;
    return link;
  }

  let shellBuilt = false;
  let cachedSession = null;

  function build(session) {
    cachedSession = session || cachedSession;
    const safeSession = cachedSession || { employee: { role: 'Admin', employeeName: 'Admin' } };
    const isAdmin = safeSession?.employee?.role === 'Admin';
    const employee = safeSession.employee || {};
    const displayName = employee.employeeName || (isAdmin ? 'Admin' : 'Employee');

    // Always ensure mobile-employee class is applied on mobile screens
    if (window.innerWidth <= 768 || window.matchMedia('(max-width: 768px)').matches) {
      document.body.classList.add('mobile-employee');
    }

    if (shellBuilt) {
      // Already built, update dynamic properties
      const brand = document.querySelector('.m-mobile-header .m-brand-name');
      const avatar = document.querySelector('.m-mobile-header .m-avatar');
      if (brand && safeSession.shopName) brand.textContent = safeSession.shopName;
      if (avatar && employee.photoUrl) avatar.innerHTML = `<img src="${employee.photoUrl}" alt="">`;
      return;
    }
    shellBuilt = true;

    const currentPath = location.pathname.replace(/\/+$/, '') || '/';
    const section = currentSection(currentPath);

    // 1. Mobile Header (Fixed Top)
    const existingHeader = document.querySelector('.m-mobile-header');
    if (!existingHeader) {
      const header = document.createElement('header');
      header.className = 'm-mobile-header';
      const dashboardHref = isAdmin ? '/admin-dashboard' : '/employee-dashboard';
      const headerPhoto = `<a href="${isAdmin ? '/admin-dashboard' : '/profile'}" class="m-avatar" aria-label="Profile">${employee.photoUrl ? `<img src="${employee.photoUrl}" alt="">` : initials(displayName)}</a>`;
      header.innerHTML = `
        <a class="m-brand" href="${dashboardHref}" aria-label="Go to dashboard">
          <span class="m-logo">Y</span>
          <span class="m-brand-name">YOURS SALON</span>
        </a>
        ${headerPhoto}
      `;
      document.body.prepend(header);
    }

    // 2. Mobile Bottom Navigation (Fixed Bottom: EXACT 4 BUTTONS)
    // 1: Dashboard, 2: Collection, 3: Expense, 4: More
    const existingNav = document.querySelector('.m-mobile-nav');
    if (existingNav) existingNav.remove();

    const nav = document.createElement('nav');
    nav.className = 'm-mobile-nav';
    nav.setAttribute('aria-label', 'Main navigation');

    // Button 1: Dashboard
    const dashHref = isAdmin ? '/admin-dashboard' : '/employee-dashboard';
    nav.append(makeLink(dashHref, 'Dashboard', 'dashboard', section === 'dashboard'));

    // Button 2: Collection
    const collHref = hasPage(safeSession, 'collection-table') ? '/collection-table' : '/collection-entry';
    nav.append(makeLink(collHref, 'Collection', 'collection', section === 'collection'));

    // Button 3: Expense
    const expHref = hasPage(safeSession, 'expense-entry') ? '/expense-entry' : '/expense-table';
    nav.append(makeLink(expHref, 'Expense', 'expense', section === 'expense'));

    // Button 4: More (opens sheet containing all other pages)
    const moreButton = document.createElement('button');
    moreButton.type = 'button';
    const moreActive = section === 'more';
    moreButton.className = 'm-nav-item no-btn-theme' + (moreActive ? ' active' : '');
    moreButton.setAttribute('aria-haspopup', 'dialog');
    moreButton.setAttribute('aria-expanded', 'false');
    moreButton.innerHTML = `${svg('more')}<span>More</span>`;
    nav.append(moreButton);

    document.body.append(nav);

    // 3. More Sheet (Contains ALL other shifted pages)
    const existingOverlay = document.querySelector('.m-more-overlay');
    if (existingOverlay) existingOverlay.remove();
    const existingSheet = document.querySelector('.m-more-sheet');
    if (existingSheet) existingSheet.remove();

    const overlay = document.createElement('div');
    overlay.className = 'm-more-overlay';

    const sheet = document.createElement('section');
    sheet.className = 'm-more-sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-label', 'More options');
    sheet.innerHTML = '<div class="m-sheet-handle"></div><h2>More Features</h2>';

    const grid = document.createElement('div');
    grid.className = 'm-more-grid';

    // Shifted Page 1: Salary Records
    grid.append(makeMoreTile('/salary-table', 'Salary', 'salary', 'amber'));

    // Shifted Page 2: Counter Cash
    grid.append(makeMoreTile('/counter-table', 'Counter Cash', 'counter', 'green'));

    // Shifted Page 3: Employees
    if (isAdmin || hasPage(safeSession, 'employee-list') || hasPage(safeSession, 'employee-entry')) {
      const empHref = hasPage(safeSession, 'employee-list') ? '/employees' : '/employee-entry';
      grid.append(makeMoreTile(empHref, 'Employees', 'employees', 'blue'));
    }

    // Shifted Page 4: Reports
    if (isAdmin || hasPage(safeSession, 'reports') || hasPage(safeSession, 'activity-report')) {
      const reportsHref = hasPage(safeSession, 'reports') ? '/reports' : '/activity-report';
      grid.append(makeMoreTile(reportsHref, 'Reports', 'reports', 'purple'));
    }

    // Shifted Page 5: User Access (if Admin)
    if (isAdmin) {
      grid.append(makeMoreTile('/user-access', 'User Access', 'crown', 'purple'));
    }

    // Expense Category (if Admin or has page)
    if (isAdmin || hasPage(safeSession, 'expense-categories')) {
      grid.append(makeMoreTile('/expense-categories', 'Expense Category', 'tag', 'amber'));
    }

    // Expense Name (if Admin or has page)
    if (isAdmin || hasPage(safeSession, 'expense-types')) {
      grid.append(makeMoreTile('/expense-types', 'Expense Name', 'tag', 'green'));
    }

    // Shifted Page 6: Shop Details
    if (isAdmin || hasPage(safeSession, 'shop-information')) {
      grid.append(makeMoreTile('/shop-details', 'Shop Details', 'shop', 'amber'));
    }

    // Shifted Page 7: Rate List
    if (isAdmin || hasPage(safeSession, 'rate-list')) {
      grid.append(makeMoreTile('/rate-list', 'Rate List', 'tag', 'green'));
    }

    // Shifted Page 8: Configuration
    if (isAdmin || hasPage(safeSession, 'configuration')) {
      grid.append(makeMoreTile('/config', 'Config', 'config', 'blue'));
    }

    // Shifted Page 9: Attendance
    if (isAdmin || hasPage(safeSession, 'attendance')) {
      grid.append(makeMoreTile('/attendance', 'Attendance', 'attendance', 'green'));
    }

    // Shifted Page 10: Customers
    if (isAdmin || hasPage(safeSession, 'customers')) {
      grid.append(makeMoreTile('/customers', 'Customers', 'customers', 'blue'));
    }

    // Shifted Page 11: Sign Out / Logout
    const logout = document.createElement('button');
    logout.type = 'button';
    logout.className = 'm-more-tile red no-btn-theme';
    logout.innerHTML = `<span class="m-more-icon">${svg('logout')}</span><span>Logout</span>`;
    logout.addEventListener('click', () => {
      if (window.salonAuth?.logout) {
        window.salonAuth.logout();
      } else {
        localStorage.removeItem('salon_token');
        localStorage.removeItem('salon_google_credential');
        location.href = '/login';
      }
    });
    grid.append(logout);

    sheet.append(grid);
    document.body.append(overlay, sheet);

    function closeMore() {
      overlay.classList.remove('open');
      sheet.classList.remove('open');
      moreButton.classList.toggle('active', section === 'more');
      moreButton.setAttribute('aria-expanded', 'false');
    }

    function openMore() {
      overlay.classList.add('open');
      sheet.classList.add('open');
      moreButton.classList.add('active');
      moreButton.setAttribute('aria-expanded', 'true');
    }

    moreButton.addEventListener('click', (e) => {
      e.preventDefault();
      if (sheet.classList.contains('open')) closeMore(); else openMore();
    });

    overlay.addEventListener('click', closeMore);
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeMore();
    });
  }

  function checkAndInit() {
    if (window.innerWidth <= 768) {
      document.body.classList.add('mobile-employee');
      if (!shellBuilt) build(cachedSession);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAndInit);
  } else {
    checkAndInit();
  }

  window.addEventListener('resize', () => {
    if (window.innerWidth <= 768) {
      document.body.classList.add('mobile-employee');
      if (!shellBuilt) build(cachedSession);
    }
  });

  // Async session listener to polish with live branding and role
  (async () => {
    try {
      const session = window.salonReady ? await window.salonReady : null;
      if (session) {
        window.__salonSession = session;
        build(session);
      }
      fetch('/api/shop-branding')
        .then(res => res.ok ? res.json() : null)
        .catch(() => null)
        .then(branding => {
          if (!branding) return;
          const brand = document.querySelector('.m-mobile-header .m-brand-name');
          const logo = document.querySelector('.m-mobile-header .m-logo');
          if (branding.name && brand) brand.textContent = branding.name;
          if (branding.logoUrl && logo) logo.innerHTML = `<img src="${branding.logoUrl}" alt="">`;
        });
    } catch (e) {
      // Fallback works smoothly
    }
  })();
})();
