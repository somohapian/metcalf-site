/* Presentation preference only. No page, form, or worksheet data is read. */
(function () {
  'use strict';
  var key = 'metcalf-theme', root = document.documentElement, media = null;
  var preference = root.getAttribute('data-theme-preference');
  if (preference !== 'light' && preference !== 'dark') preference = null;
  try { media = window.matchMedia('(prefers-color-scheme: dark)'); } catch (_) {}
  var controls = [];
  function apply() {
    var theme = preference || (media && media.matches ? 'dark' : 'light');
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-theme-preference', preference || 'auto');
    controls.forEach(function (control) { control.value = preference || 'auto'; });
  }
  function choose(event) {
    var value = event.target.value;
    preference = value === 'light' || value === 'dark' ? value : null;
    try {
      if (preference) window.localStorage.setItem(key, preference);
      else window.localStorage.removeItem(key);
    } catch (_) { /* The choice still applies when preference storage is blocked. */ }
    apply();
  }
  function mount() {
    var footer = document.querySelector('footer .foot-bottom') || document.querySelector('footer');
    if (footer && !footer.querySelector('.theme-preference')) {
      var label = document.createElement('label'), text = document.createElement('span');
      var select = document.createElement('select');
      label.className = 'theme-preference';
      text.textContent = 'Appearance';
      [['auto', 'System'], ['light', 'Light'], ['dark', 'Dark']].forEach(function (item) {
        var option = document.createElement('option');
        option.value = item[0]; option.textContent = item[1]; select.appendChild(option);
      });
      select.addEventListener('change', choose);
      controls.push(select);
      label.appendChild(text); label.appendChild(select); footer.appendChild(label);
    }
    apply();
  }
  if (media) {
    var change = function () { if (!preference) apply(); };
    if (media.addEventListener) media.addEventListener('change', change);
    else if (media.addListener) media.addListener(change);
  }
  window.addEventListener('storage', function (event) {
    if (event.key !== key && event.key !== null) return;
    try { if (event.storageArea && event.storageArea !== window.localStorage) return; } catch (_) { return; }
    preference = event.newValue === 'light' || event.newValue === 'dark' ? event.newValue : null;
    apply();
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once: true});
  else mount();
}());
