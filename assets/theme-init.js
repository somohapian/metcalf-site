/* Runs before styles paint. A missing/blocked script leaves the CSS device fallback. */
(function () {
  'use strict';
  var preference = null, dark = false;
  try {
    var saved = window.localStorage.getItem('metcalf-theme');
    if (saved === 'light' || saved === 'dark') preference = saved;
  } catch (_) { /* A blocked preference store must not prevent the page loading. */ }
  try { dark = window.matchMedia('(prefers-color-scheme: dark)').matches; } catch (_) {}
  var root = document.documentElement;
  root.setAttribute('data-theme', preference || (dark ? 'dark' : 'light'));
  root.setAttribute('data-theme-preference', preference || 'auto');
}());
