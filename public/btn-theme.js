(function () {
  function hexToRgb(hex) {
    return {
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16)
    };
  }

  function readableText(hex) {
    const color = hexToRgb(hex);
    const luminance = (0.299 * color.r + 0.587 * color.g + 0.114 * color.b) / 255;
    return luminance > 0.62 ? '#211A16' : '#FFFFFF';
  }

  function readValue(source, rawKey, normalizedKey, fallback) {
    if (!source) return fallback;
    const value = source[rawKey] !== undefined ? source[rawKey] : source[normalizedKey];
    return value === undefined || value === null || String(value).trim() === '' ? fallback : value;
  }

  const buttonSelector = 'button:not([class*="salon-"]):not(.secondary):not(.danger)' +
    ':not(.link):not(.method):not(.eye):not(.dot):not(.arrow):not(.no-btn-theme):not(.mw-action)' +
    ':not(.aw-other-card):not(.aw-service):not(.aw-minus):not(.aw-plus):not(.aw-tab):not(.mw-filter-icon-btn):not(.mw-pill-btn):not(.mw-sheet-preset-btn):not(.mw-sheet-close-btn):not(.mw-clear-btn):not(.mw-active-filter-reset)';
  const themeSelector = buttonSelector + ',[data-salon-btn-theme]';

  function apply(source) {
    let first = String(readValue(source, 'Button Color', 'buttonColor', '#C9A227')).trim();
    let second = String(readValue(source, 'Button Color 2', 'buttonColor2', '#8A6D1B')).trim();
    if (!/^#[0-9a-f]{6}$/i.test(first)) first = '#C9A227';
    if (!/^#[0-9a-f]{6}$/i.test(second)) second = '#8A6D1B';
    const mix = String(readValue(source, 'Button Style', 'buttonStyle', 'Solid')).trim().toLowerCase() === 'mix';
    const image = mix ? `linear-gradient(135deg, ${first}, ${second})` : 'none';
    const text = readableText(first);
    const rgb = hexToRgb(first);
    const borderLight = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35)`;
    const borderHover = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.65)`;
    const borderDark = first;

    let element = document.getElementById('salonButtonTheme');
    if (!element) {
      element = document.createElement('style');
      element.id = 'salonButtonTheme';
      document.head.appendChild(element);
    }
    element.textContent =
      `:root{` +
      `--salon-btn-bg:${first};` +
      `--salon-btn-bg2:${second};` +
      `--salon-btn-text:${text};` +
      `--salon-border-light:${borderLight};` +
      `--salon-border-hover:${borderHover};` +
      `--salon-border-dark:${borderDark};` +
      `}` +
      `${themeSelector}{background-color:${first} !important;background-image:${image} !important;color:${text} !important}` +
      `${themeSelector}:disabled{opacity:1;cursor:not-allowed}`;
  }

  window.salonApplyButtonTheme = apply;

  function load() {
    fetch('/api/shop-branding')
      .then(function (response) { return response.ok ? response.json() : null; })
      .then(function (branding) { if (branding) apply(branding.login || branding); })
      .catch(function () {});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load);
  else load();
})();
