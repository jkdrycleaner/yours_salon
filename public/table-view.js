(() => {
  const pageSize = 10;
  const tableIcon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M3.5 9.5h17M9.5 3.5v17M15 3.5v17"/></svg>';

  function normalizeLabel(value) {
    return value.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function buildToolbar(table) {
    const toolbar = document.createElement('div');
    toolbar.className = 'table-view-toolbar';

    const pagination = document.createElement('div');
    pagination.className = 'table-view-pagination';
    const previous = document.createElement('button');
    previous.type = 'button';
    previous.className = 'table-view-page-button';
    previous.setAttribute('aria-label', 'Previous page');
    previous.textContent = '‹';
    const range = document.createElement('span');
    range.setAttribute('aria-live', 'polite');
    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'table-view-page-button';
    next.setAttribute('aria-label', 'Next page');
    next.textContent = '›';
    pagination.append(previous, range, next);

    const picker = document.createElement('div');
    picker.className = 'table-view-columns';
    const pickerButton = document.createElement('button');
    pickerButton.type = 'button';
    pickerButton.className = 'table-view-columns-button';
    pickerButton.setAttribute('aria-label', 'Choose table columns');
    pickerButton.title = 'Show or hide columns';
    pickerButton.setAttribute('aria-expanded', 'false');
    pickerButton.innerHTML = tableIcon;
    const menu = document.createElement('div');
    menu.className = 'table-view-column-menu';
    menu.hidden = true;
    picker.append(pickerButton, menu);
    toolbar.append(pagination, picker);

    const storageKey = () => `salon_table_columns_${location.pathname}_${table.id || table.dataset.tableView || 'default'}_${table.dataset.dataset || 'default'}_v${table.dataset.columnPreferencesVersion || '1'}`;
    let currentPage = 1;
    let headerSignature = '';
    let visibleColumns = new Set();

    function headers() {
      return [...table.querySelectorAll('thead tr:last-child th')].map((cell, index) => ({
        index,
        label: cell.textContent.trim() || `Column ${index + 1}`,
        fixed: cell.hasAttribute('data-fixed-column')
      }));
    }

    function fixedLabels(columns) {
      return columns
        .filter(column => column.fixed)
        .map(column => normalizeLabel(column.label));
    }

    function readPreferences(columns) {
      let saved;
      try {
        saved = JSON.parse(localStorage.getItem(storageKey()) || 'null');
      } catch {
        saved = null;
      }
      const known = new Set(columns.map(column => normalizeLabel(column.label)));
      const fixed = fixedLabels(columns);
      if (!Array.isArray(saved)) {
        const defaults = columns.filter(column => table.querySelector(`thead th:nth-child(${column.index + 1})[data-default-visible]`));
        return defaults.length
          ? new Set([...defaults.map(column => normalizeLabel(column.label)), ...fixed])
          : new Set(known);
      }
      return new Set([...saved.filter(label => known.has(label)), ...fixed]);
    }

    function applyColumnVisibility(columns) {
      const rows = [...table.querySelectorAll('tr')];
      for (const row of rows) {
        const cells = [...row.children];
        if (cells.length === 1 && cells[0].colSpan > 1) continue;
        for (const [index, cell] of cells.entries()) {
          cell.hidden = columns[index]?.fixed
            ? false
            : !visibleColumns.has(normalizeLabel(columns[index]?.label || ''));
        }
      }
    }

    function savePreferences(columns) {
      try {
        localStorage.setItem(storageKey(), JSON.stringify([...visibleColumns]));
      } catch {
        // Keep the current page usable when browser storage is unavailable.
      }
      applyColumnVisibility(columns);
      const configurable = columns.filter(column => !column.fixed);
      selectAllButton.textContent = configurable.every(column => visibleColumns.has(normalizeLabel(column.label)))
        ? 'Hide all columns'
        : 'Select all columns';
    }

    const selectAllButton = document.createElement('button');
    selectAllButton.type = 'button';
    selectAllButton.className = 'table-view-select-all';

    function updateColumnMenu() {
      const columns = headers();
      const signature = columns.map(column => normalizeLabel(column.label)).join('|');
      if (signature !== headerSignature) {
        visibleColumns = readPreferences(columns);
        headerSignature = signature;
        menu.replaceChildren();
        const title = document.createElement('div');
        title.className = 'table-view-menu-title';
        title.textContent = 'Show / hide columns';
        menu.append(title, selectAllButton);
        for (const column of columns) {
          if (column.fixed) continue;
          const label = document.createElement('label');
          label.className = 'table-view-column-option';
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.checked = visibleColumns.has(normalizeLabel(column.label));
          checkbox.addEventListener('change', () => {
            const key = normalizeLabel(column.label);
            if (checkbox.checked) visibleColumns.add(key);
            else visibleColumns.delete(key);
            savePreferences(columns);
          });
          const text = document.createElement('span');
          text.textContent = column.label;
          label.append(checkbox, text);
          menu.append(label);
        }
      }
      savePreferences(columns);
    }

    selectAllButton.addEventListener('click', () => {
      const columns = headers();
      const configurable = columns.filter(column => !column.fixed);
      const allVisible = configurable.every(column => visibleColumns.has(normalizeLabel(column.label)));
      visibleColumns = new Set([
        ...fixedLabels(columns),
        ...(allVisible ? [] : configurable.map(column => normalizeLabel(column.label)))
      ]);
      for (const checkbox of menu.querySelectorAll('input[type="checkbox"]')) {
        checkbox.checked = !allVisible;
      }
      savePreferences(columns);
    });

    pickerButton.addEventListener('click', () => {
      menu.hidden = !menu.hidden;
      pickerButton.setAttribute('aria-expanded', String(!menu.hidden));
    });
    document.addEventListener('click', event => {
      if (!picker.contains(event.target)) {
        menu.hidden = true;
        pickerButton.setAttribute('aria-expanded', 'false');
      }
    });

    function dataRows() {
      return [...table.tBodies].flatMap(tbody => [...tbody.rows])
        .filter(row => !(row.cells.length === 1 && row.cells[0].colSpan > 1));
    }

    function updatePager() {
      const serverMode = table.dataset.tableView === 'server';
      if (serverMode) {
        const total = Number(table.dataset.total || 0);
        const page = Math.max(1, Number(table.dataset.page || 1));
        const size = Math.max(1, Number(table.dataset.pageSize || pageSize));
        const start = total ? (page - 1) * size + 1 : 0;
        const end = Math.min(page * size, total);
        range.textContent = `${start}-${end}/${total}`;
        previous.disabled = page <= 1 || total === 0;
        next.disabled = end >= total;
        return;
      }

      const rows = dataRows();
      const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
      currentPage = Math.min(currentPage, pageCount);
      const startIndex = (currentPage - 1) * pageSize;
      rows.forEach((row, index) => {
        row.hidden = index < startIndex || index >= startIndex + pageSize;
      });
      const start = rows.length ? startIndex + 1 : 0;
      const end = Math.min(startIndex + pageSize, rows.length);
      range.textContent = `${start}-${end}/${rows.length}`;
      previous.disabled = currentPage <= 1 || rows.length === 0;
      next.disabled = currentPage >= pageCount;
    }

    previous.addEventListener('click', () => {
      const page = Number(table.dataset.page || 1);
      if (table.dataset.tableView === 'server') {
        if (page > 1) table.dispatchEvent(new CustomEvent('table-view-page-change', { detail: { page: page - 1 } }));
        return;
      }
      currentPage = Math.max(1, currentPage - 1);
      updatePager();
    });
    next.addEventListener('click', () => {
      if (table.dataset.tableView === 'server') {
        const page = Number(table.dataset.page || 1);
        const total = Number(table.dataset.total || 0);
        const size = Number(table.dataset.pageSize || pageSize);
        if (page * size < total) table.dispatchEvent(new CustomEvent('table-view-page-change', { detail: { page: page + 1 } }));
        return;
      }
      currentPage += 1;
      updatePager();
    });

    const wrapper = table.closest('.table-wrap, .scroll') || table.parentElement;
    wrapper.parentElement.insertBefore(toolbar, wrapper);
    updateColumnMenu();
    updatePager();

    const observer = new MutationObserver(() => {
      updateColumnMenu();
      updatePager();
    });
    observer.observe(table, {
      attributes: true,
      attributeFilter: ['data-page', 'data-page-size', 'data-total'],
      childList: true,
      subtree: true
    });
  }

  document.querySelectorAll('table[data-table-view]').forEach(buildToolbar);
})();
