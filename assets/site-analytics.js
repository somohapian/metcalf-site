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
  // Use the same public campaign vocabulary as the inquiry receipt.
  // Free-text terms, ad content and externally supplied IDs can identify an individual.
  var publicLabels = {
    utm_source: 'apply.ms bing chatgpt chatgpt.com claude claude.ai copilot duckduckgo email event facebook facebook.com fb gemini gemini.google.com glassdoor google google.com grok grok.com ig indeed instagram linkedin linkedin.com lnkd.in metcalfsearch metcalfsearch.com newsletter openai partner perplexity perplexity.ai podcast print qr reddit referral sms t.co threads tiktok twitter x yahoo youtube',
    utm_medium: 'affiliate ai-assistant banner check cpc display e-mail email event footer groups newsletter organic paid paid-search paid-social paid_search paid_social paidsearch paidsocial partner ppc print qr referral sms social social-media social_media video',
    utm_campaign: 'careers-page diy-hiring partner-referrals'
  };
  Object.keys(publicLabels).forEach(function (key) {
    var value = (params.get(key) || '').trim().toLowerCase();
    if (publicLabels[key].split(' ').includes(value)) publicUrl.searchParams.set(key, value);
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
