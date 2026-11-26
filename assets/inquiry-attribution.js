/* Source details for employer inquiry receipts. These fields never go to GA. */
(function () {
  'use strict';
  if (location.protocol !== 'https:' || !/^(www\.)?metcalfsearch\.com$/.test(location.hostname)) return;
  if (navigator.globalPrivacyControl || navigator.doNotTrack === '1' || window['ga-disable-G-0R74SX6WZX']) return;

  var firstKey = 'ms-inquiry-first-v1';
  var visitKey = 'ms-inquiry-visit-v1';
  var firstLifetime = 90 * 86400000;
  var visitLifetime = 30 * 60000;

  // Only paths belonging to public marketing pages can enter a receipt.
  var path = location.pathname.replace(/\/$/, '').replace(/\.html$/, '') || '/';
  var publicPath = /^\/(?:about|activate|assess|blog(?:\/[a-z0-9-]{1,160})?|candidates|close|comparison|contact|faq|fractional-recruiting|hire-without-a-placement-fee|jay-metcalf|keep(?:-check-in|-concern)?|privacy|recruiting-partner(?:-plus|-pro)?|services|source|stack(?:-field-guide|-method)?|talk|terms|who-we-serve)?$/;
  if (!publicPath.test(path)) return;

  function externalReferrer() {
    try {
      var ref = new URL(document.referrer);
      if (!/^https?:$/.test(ref.protocol) || /(^|\.)metcalfsearch\.com$/.test(ref.hostname)) return '';
      return ref.hostname.slice(0, 253);
    } catch (_) { return ''; }
  }

  function campaignLabel(value) {
    // Accept short marketing labels, never URLs, contact addresses or form values.
    return value && /^[a-z0-9][a-z0-9 _.-]{0,79}$/i.test(value) && !/\d{7,}/.test(value) ? value.trim().toLowerCase() : '';
  }
  var params = new URLSearchParams(location.search);
  var source = campaignLabel(params.get('utm_source'));
  var medium = campaignLabel(params.get('utm_medium'));
  var campaign = campaignLabel(params.get('utm_campaign'));
  var referrer = externalReferrer();
  var touch = {
    landing: path,
    referrer: referrer,
    source: source || referrer,
    medium: medium,
    campaign: campaign
  };

  function read(kind, key, lifetime) {
    try {
      var item = JSON.parse(window[kind].getItem(key));
      if (item && item.touch && typeof item.touch.source === 'string' && typeof item.touch.landing === 'string' && typeof item.time === 'number' && Date.now() >= item.time && Date.now() - item.time < lifetime) return item.touch;
    } catch (_) { /* Storage may be blocked. The current visit can still be observed. */ }
    return null;
  }
  function save(kind, key, detail) {
    try { window[kind].setItem(key, JSON.stringify({time: Date.now(), touch: detail})); } catch (_) {}
  }
  var first = read('localStorage', firstKey, firstLifetime);
  if (!first) {
    first = touch;
    save('localStorage', firstKey, first);
  }
  var visit = read('sessionStorage', visitKey, visitLifetime);
  if (!visit || referrer || source || medium || campaign) visit = touch;
  save('sessionStorage', visitKey, visit);
  // Carry only broad, non-identifying source labels to employer pages on apply.ms.
  // Use separate parameters so this handoff cannot rewrite the visit's Google campaign.
  var handoffLandings = new Set('/ /about /activate /assess /blog /close /comparison /contact /faq /fractional-recruiting /hire-without-a-placement-fee /jay-metcalf /keep /keep-check-in /keep-concern /recruiting-partner /recruiting-partner-plus /recruiting-partner-pro /services /source /stack-field-guide /stack-method /talk /who-we-serve'.split(' '));
  var destinations = new Set(['/', '/help/', '/help/samples/free-careers-page/']);
  var allowedSources = new Set(['google','bing','duckduckgo','yahoo','chatgpt.com','perplexity.ai','gemini.google.com','claude.ai','grok.com','linkedin','facebook','newsletter','partner','metcalfsearch.com']);
  var allowedMedia = new Set(['organic','ai-assistant','referral','email','social','paid-social','cpc']);
  var allowedCampaigns = new Set(['careers-page','diy-hiring','partner-referrals']);
  var providers = [
    ['gemini.google.com','gemini.google.com','ai-assistant'], ['google.com','google','organic'],
    ['bing.com','bing','organic'], ['duckduckgo.com','duckduckgo','organic'], ['search.yahoo.com','yahoo','organic'],
    ['chatgpt.com','chatgpt.com','ai-assistant'], ['perplexity.ai','perplexity.ai','ai-assistant'],
    ['claude.ai','claude.ai','ai-assistant'], ['grok.com','grok.com','ai-assistant'],
    ['linkedin.com','linkedin','social'], ['facebook.com','facebook','social']
  ];
  function decorate(event) {
    if (navigator.globalPrivacyControl || navigator.doNotTrack === '1' || window['ga-disable-G-0R74SX6WZX'] || window['ga-disable-G-KX3XCD90NF']) return;
    if (!handoffLandings.has(first.landing)) return;
    var link = event.target && event.target.closest && event.target.closest('a[href]');
    if (!link) return;
    var dest = new URL(link.href);
    if (dest.origin !== 'https://apply.ms' || !destinations.has(dest.pathname)) return;
    var originName = first.source;
    var originMedium = allowedMedia.has(first.medium) ? first.medium : '';
    var explicit = originName !== first.referrer;
    var match = providers.find(function (row) {
      return originName === row[0] || originName.endsWith('.' + row[0]);
    });
    if (match) {
      originName = match[1];
      if (!originMedium && !explicit) originMedium = match[2];
    }
    if (!allowedSources.has(originName)) return;
    dest.searchParams.set('ms_from','metcalf');
    dest.searchParams.set('ms_source',originName);
    if (originMedium) dest.searchParams.set('ms_medium',originMedium);
    if (allowedCampaigns.has(first.campaign)) dest.searchParams.set('ms_campaign',first.campaign);
    dest.searchParams.set('ms_landing',first.landing);
    link.href = dest.href;
  }
  document.addEventListener('pointerdown', decorate, true);
  document.addEventListener('click', decorate, true);
  window.metcalfInquiryAttribution = function () {
    return {first: first, submission: visit};
  };
})();
