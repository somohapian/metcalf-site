/* Presentation preference only. No page, form, or worksheet data is read. */
(function () {
  'use strict';
  var key = 'metcalf-theme', root = document.documentElement, media = null;
  var preference = root.getAttribute('data-theme-preference');
  if (preference !== 'light' && preference !== 'dark') preference = null;
  try { media = window.matchMedia('(prefers-color-scheme: dark)'); } catch (_) {}
  var buttons = [];
  function apply() {
    var theme = preference || (media && media.matches ? 'dark' : 'light');
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-theme-preference', preference || 'auto');
    buttons.forEach(function (button) {
      button.setAttribute('aria-pressed', String(theme === 'dark'));
      button.title = 'Switch to ' + (theme === 'dark' ? 'light' : 'dark') + ' mode';
    });
  }
  function toggle() {
    preference = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    try { window.localStorage.setItem(key, preference); } catch (_) {}
    apply();
  }
  function makeButton(mobile) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'theme-toggle' + (mobile ? ' theme-toggle-mobile' : '');
    button.setAttribute('aria-label', 'Dark mode');
    var light = document.createElement('span'), divider = document.createElement('span'), dark = document.createElement('span');
    light.className = 'theme-label-light'; light.textContent = 'Light';
    divider.textContent = ' / ';
    dark.className = 'theme-label-dark'; dark.textContent = 'Dark';
    [light, divider, dark].forEach(function (span) { span.setAttribute('aria-hidden', 'true'); button.appendChild(span); });
    button.addEventListener('click', toggle);
    buttons.push(button);
    return button;
  }
  function mount() {
    var nav = document.querySelector('.topnav-inner');
    if (nav && !nav.querySelector('.theme-toggle')) {
      var before = nav.querySelector('.hamburger-btn') || nav.querySelector('.nav-cta');
      nav.insertBefore(makeButton(false), before);
    }
    var overlay = document.querySelector('.nav-overlay');
    if (overlay && !overlay.querySelector('.theme-toggle')) overlay.appendChild(makeButton(true));
    apply();
  }
  if (media) {
    var change = function () { if (!preference) apply(); };
    if (media.addEventListener) media.addEventListener('change', change);
    else if (media.addListener) media.addListener(change);
  }
  window.addEventListener('storage', function (event) {
    if (event.key !== key && event.key !== null) return;
    // Ignore another storage area; only this site's local preference is shared.
    try { if (event.storageArea && event.storageArea !== window.localStorage) return; } catch (_) { return; }
    preference = event.newValue === 'light' || event.newValue === 'dark' ? event.newValue : null;
    apply();
  });
  // Existing navigation creates its mobile dialog on DOMContentLoaded first.
  if (document.readyState === 'complete') mount();
  else document.addEventListener('DOMContentLoaded', mount, {once: true});
}());
