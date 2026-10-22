(() => {
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayNames = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  const presets = [
    { key: 'custom', label: 'Custom range' },
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'last7', label: 'Last 7 days' },
    { key: 'last30', label: 'Last 30 days' },
    { key: 'thisMonth', label: 'This month' },
    { key: 'lastMonth', label: 'Last month' },
    { key: 'thisYear', label: 'This year' },
    { key: 'lastYear', label: 'Last year' }
  ];

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function toIso(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function fromIso(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function today() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function endOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
  }

  function presetRange(key) {
    const base = today();
    if (key === 'today') return { from: toIso(base), to: toIso(base) };
    if (key === 'yesterday') {
      const value = addDays(base, -1);
      return { from: toIso(value), to: toIso(value) };
    }
    if (key === 'last7') return { from: toIso(addDays(base, -6)), to: toIso(base) };
    if (key === 'last30') return { from: toIso(addDays(base, -29)), to: toIso(base) };
    if (key === 'thisMonth') return { from: toIso(startOfMonth(base)), to: toIso(base) };
    if (key === 'lastMonth') {
      const previous = new Date(base.getFullYear(), base.getMonth() - 1, 1);
      return { from: toIso(startOfMonth(previous)), to: toIso(endOfMonth(previous)) };
    }
    if (key === 'thisYear') return { from: toIso(new Date(base.getFullYear(), 0, 1)), to: toIso(base) };
    if (key === 'lastYear') {
      const year = base.getFullYear() - 1;
      return { from: toIso(new Date(year, 0, 1)), to: toIso(new Date(year, 11, 31)) };
    }
    return null;
  }

  function displayDate(value) {
    const date = fromIso(value);
    return date ? `${pad(date.getDate())} ${shortMonths[date.getMonth()]} ${date.getFullYear()}` : '';
  }

  function displayRange(range) {
    if (!range.from || !range.to) return 'Select date range';
    if (range.from === range.to) return displayDate(range.from);
    return `${displayDate(range.from)} – ${displayDate(range.to)}`;
  }

  function calendarIcon() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.8');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M7.5 3v4M16.5 3v4M3.5 9.5h17"/>';
    return svg;
  }

  function mount(container, options = {}) {
    if (!container) throw new Error('Date range container is required.');
    const notify = options.onChange || (() => {});
    let range = presetRange(options.defaultPreset || 'last30');
    let selectedPreset = options.defaultPreset || 'last30';
    let open = false;
    let customOpen = false;
    let phase = 'from';
    let pendingFrom = '';
    let pendingTo = '';
    let viewMonth = startOfMonth(fromIso(range.from) || today());

    container.classList.add('salon-date-range');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'salon-date-range-button';
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-expanded', 'false');
    const icon = document.createElement('span');
    icon.className = 'salon-date-range-icon';
    icon.append(calendarIcon());
    const label = document.createElement('span');
    label.className = 'salon-date-range-label';
    const chevron = document.createElement('span');
    chevron.className = 'salon-date-range-chevron';
    chevron.textContent = '▾';
    button.append(icon, label, chevron);

    const popover = document.createElement('div');
    popover.className = 'salon-date-range-popover';
    popover.hidden = true;
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-label', 'Choose date range');

    const presetList = document.createElement('div');
    presetList.className = 'salon-date-range-presets';
    const calendarPanel = document.createElement('div');
    calendarPanel.className = 'salon-date-range-calendar';
    calendarPanel.hidden = true;
    popover.append(presetList, calendarPanel);
    container.append(button, popover);

    function updateLabel() {
      label.textContent = displayRange(range);
      button.title = displayRange(range);
    }

    function notifyChange() {
      updateLabel();
      notify({ ...range, preset: selectedPreset });
    }

    function setRange(from, to, preset = 'custom', shouldNotify = true) {
      range = { from, to: to || from };
      selectedPreset = preset;
      viewMonth = startOfMonth(fromIso(range.from) || today());
      updateLabel();
      if (shouldNotify) notify({ ...range, preset: selectedPreset });
    }

    function close() {
      open = false;
      popover.hidden = true;
      button.setAttribute('aria-expanded', 'false');
    }

    function openPopover() {
      open = true;
      popover.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      calendarPanel.hidden = !customOpen;
      renderPresets();
      if (customOpen) renderCalendar();
    }

    function renderPresets() {
      presetList.replaceChildren();
      for (const preset of presets) {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'salon-date-range-preset' + (preset.key === selectedPreset ? ' active' : '');
        item.textContent = preset.label;
        item.addEventListener('click', () => {
          if (preset.key === 'custom') {
            customOpen = true;
            phase = 'from';
            pendingFrom = '';
            pendingTo = '';
            viewMonth = startOfMonth(fromIso(range.from) || today());
            calendarPanel.hidden = false;
            renderCalendar();
            return;
          }
          const next = presetRange(preset.key);
          customOpen = false;
          calendarPanel.hidden = true;
          setRange(next.from, next.to, preset.key);
          close();
        });
        presetList.append(item);
      }
      if (customOpen) {
        const custom = presetList.querySelector('.salon-date-range-preset:first-child');
        custom?.classList.add('active');
      }
    }

    function renderCalendar() {
      calendarPanel.replaceChildren();
      const header = document.createElement('div');
      header.className = 'salon-date-range-calendar-head';
      const previous = document.createElement('button');
      previous.type = 'button';
      previous.className = 'salon-date-range-nav';
      previous.setAttribute('aria-label', 'Previous month');
      previous.textContent = '‹';
      const heading = document.createElement('strong');
      heading.textContent = `${monthNames[viewMonth.getMonth()]} ${viewMonth.getFullYear()}`;
      const next = document.createElement('button');
      next.type = 'button';
      next.className = 'salon-date-range-nav';
      next.setAttribute('aria-label', 'Next month');
      next.textContent = '›';
      previous.addEventListener('click', () => {
        viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1);
        renderCalendar();
      });
      next.addEventListener('click', () => {
        viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1);
        renderCalendar();
      });
      header.append(previous, heading, next);

      const helper = document.createElement('p');
      helper.className = 'salon-date-range-helper';
      helper.textContent = phase === 'from' ? 'Select start date' : 'Select end date';

      const grid = document.createElement('div');
      grid.className = 'salon-date-range-grid';
      for (const day of dayNames) {
        const cell = document.createElement('span');
        cell.className = 'salon-date-range-day-name';
        cell.textContent = day;
        grid.append(cell);
      }

      const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
      const offset = (first.getDay() + 6) % 7;
      const start = addDays(first, -offset);
      const activeFrom = phase === 'to' ? pendingFrom : '';
      const activeTo = phase === 'to' ? pendingTo : '';
      const todayIso = toIso(today());
      for (let index = 0; index < 42; index += 1) {
        const date = addDays(start, index);
        const iso = toIso(date);
        const day = document.createElement('button');
        day.type = 'button';
        day.className = 'salon-date-range-day';
        day.textContent = String(date.getDate());
        if (date.getMonth() !== viewMonth.getMonth()) day.classList.add('muted');
        if (iso === todayIso) day.classList.add('today');
        if (activeFrom && iso === activeFrom) day.classList.add('range-start');
        if (activeTo && iso === activeTo) day.classList.add('range-end');
        if (activeFrom && activeTo && iso > activeFrom && iso < activeTo) day.classList.add('in-range');
        day.addEventListener('click', () => {
          if (phase === 'from') {
            pendingFrom = iso;
            pendingTo = '';
            phase = 'to';
            renderCalendar();
            return;
          }
          let from = pendingFrom;
          let to = iso;
          if (to < from) [from, to] = [to, from];
          customOpen = false;
          calendarPanel.hidden = true;
          setRange(from, to, 'custom');
          close();
        });
        grid.append(day);
      }
      calendarPanel.append(header, helper, grid);
    }

    button.addEventListener('click', event => {
      event.stopPropagation();
      if (open) {
        close();
      } else {
        customOpen = selectedPreset === 'custom';
        phase = 'from';
        pendingFrom = '';
        pendingTo = '';
        openPopover();
      }
    });
    popover.addEventListener('click', event => event.stopPropagation());
    document.addEventListener('click', () => {
      if (open) close();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && open) close();
    });

    updateLabel();
    return {
      getRange: () => ({ ...range }),
      getPreset: () => selectedPreset,
      setRange: (from, to, preset = 'custom', shouldNotify = true) => setRange(from, to, preset, shouldNotify),
      reset(shouldNotify = true) {
        const next = presetRange('last30');
        setRange(next.from, next.to, 'last30', shouldNotify);
        customOpen = false;
        phase = 'from';
        pendingFrom = '';
        pendingTo = '';
        close();
      }
    };
  }

  window.SalonDateRange = { mount, presetRange };
})();
