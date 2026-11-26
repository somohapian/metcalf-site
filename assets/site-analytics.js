/* Public marketing measurement. Never pass return-session tokens or form data as a page URL. */
(function () {
  'use strict';
  var stream = 'G-0R74SX6WZX';
  if (location.protocol !== 'https:' || !/^(www\.)?metcalfsearch\.com$/.test(location.hostname) || window['ga-disable-' + stream]) return;

  var canonical = document.querySelector('link[rel="canonical"]');
  var path = '/404';
  if (canonical) {
    try {
      var target = new URL(canonical.href);
      if (target.hostname === 'metcalfsearch.com') path = target.pathname;
    } catch (_) {}
  }
  var publicUrl = new URL(path, location.origin);
  var params = new URLSearchParams(location.search);
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_id', 'utm_term', 'utm_content'].forEach(function (key) {
    var value = params.get(key);
    if (value && /^[a-z0-9][a-z0-9 _.-]{0,79}$/i.test(value) && !/\d{7,}/.test(value)) publicUrl.searchParams.set(key, value);
  });
  var referrer = '';
  try {
    var from = new URL(document.referrer);
    if (/^https?:$/.test(from.protocol)) referrer = from.origin + '/';
  } catch (_) {}

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('set','linker',{domains:['metcalfsearch.com','apply.ms']});
  window.gtag('config', stream, {page_location: publicUrl.href, page_referrer: referrer,
    allow_google_signals: false, allow_ad_personalization_signals: false});
  var script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=' + stream;
  document.head.appendChild(script);
})();
