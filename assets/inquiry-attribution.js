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
      if (item && item.touch && typeof item.time === 'number' && Date.now() >= item.time && Date.now() - item.time < lifetime) return item.touch;
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
  window.metcalfInquiryAttribution = function () {
    return {first: first, submission: visit};
  };
})();
