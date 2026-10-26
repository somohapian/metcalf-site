/*
 * Client logo strip.
 *
 * Fills every [data-client-ticker] element from window.MS_CLIENTS (set by
 * /assets/clients/clients.js). The list is shuffled, each logo is checked
 * before it is shown, and up to data-show logos (default 7) render as a
 * seamless scrolling row: the set twice, the second copy aria-hidden. The
 * strip stays hidden unless at least three logos load. Under 640px it is a
 * swipe row and with reduced motion a static wrapped row; the page CSS
 * (style#metcalf-client-strip) handles both.
 */
(function () {
  'use strict';

  var BASE = '/assets/clients/';
  var LABEL = 'Some of the companies we have hired for.';
  var DEFAULT_SHOW = 7;
  var MIN_LOGOS = 3;
  var SECONDS_PER_LOGO = 3.2;
  var LOAD_TIMEOUT = 8000;

  function shuffle(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  function usable(c) {
    return !!c && typeof c.name === 'string' && c.name !== '' &&
      typeof c.file === 'string' && /^[a-z0-9][a-z0-9._-]*\.(?:png|webp|svg)$/i.test(c.file);
  }

  // Logos that share a `group` never show in the same set (a brokerage logo
  // and a team logo that already carries that brokerage). The first one the
  // shuffle lands on wins; the rest are dropped for this load.
  function oneLogoPerGroup(list) {
    var seen = {};
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var g = list[i].group;
      if (typeof g === 'string' && g !== '') {
        if (seen[g]) continue;
        seen[g] = true;
      }
      out.push(list[i]);
    }
    return out;
  }

  // Loads logos in list order until `need` of them have loaded, replacing a
  // failure with the next one on the list. Calls done(loaded) once, in order.
  function preload(list, need, done) {
    var loaded = [];
    var next = 0;
    var pending = 0;
    var finished = false;

    function pump() {
      while (pending + loaded.length < need && next < list.length) start(next++);
      if (!pending && !finished) {
        finished = true;
        loaded.sort(function (a, b) { return a.i - b.i; });
        done(loaded.map(function (x) { return x.c; }));
      }
    }

    function start(i) {
      var c = list[i];
      var img = new Image();
      var settled = false;
      var timer = setTimeout(function () { settle(false); }, LOAD_TIMEOUT);
      function settle(ok) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        pending--;
        if (ok) loaded.push({ i: i, c: c });
        pump();
      }
      pending++;
      img.onload = function () { settle(img.naturalWidth > 0); };
      img.onerror = function () { settle(false); };
      img.src = BASE + encodeURIComponent(c.file);
    }

    pump();
  }

  function logo(c, duplicate) {
    var img = document.createElement('img');
    img.setAttribute('loading', 'lazy');
    img.setAttribute('decoding', 'async');
    img.alt = duplicate ? '' : c.name;
    var h = Math.round(Number(c.h));
    if (h > 0) img.setAttribute('height', String(h));
    if (duplicate) img.setAttribute('aria-hidden', 'true');
    img.src = BASE + encodeURIComponent(c.file);
    return img;
  }

  function render(el, logos) {
    var label = document.createElement('p');
    label.className = 'client-strip__label';
    label.textContent = LABEL;

    var viewport = document.createElement('div');
    viewport.className = 'client-strip__viewport';
    viewport.setAttribute('role', 'group');
    viewport.setAttribute('aria-label', 'Client logos');
    viewport.tabIndex = 0;

    var track = document.createElement('div');
    track.className = 'client-strip__track';
    track.style.setProperty('--strip-duration', (logos.length * SECONDS_PER_LOGO).toFixed(1) + 's');

    var i;
    for (i = 0; i < logos.length; i++) track.appendChild(logo(logos[i], false));
    for (i = 0; i < logos.length; i++) track.appendChild(logo(logos[i], true));

    viewport.appendChild(track);
    el.appendChild(label);
    el.appendChild(viewport);
    el.hidden = false;
  }

  // Starts the logo checks when the strip is within 800px of the viewport.
  function whenNear(el, fn) {
    if (!('IntersectionObserver' in window)) {
      fn();
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          io.disconnect();
          fn();
          return;
        }
      }
    }, { rootMargin: '800px 0px' });
    io.observe(el);
  }

  function setup(el, clients) {
    var show = parseInt(el.getAttribute('data-show'), 10);
    if (!(show > 0)) show = DEFAULT_SHOW;
    show = Math.min(show, clients.length);
    var order = oneLogoPerGroup(shuffle(clients));
    show = Math.min(show, order.length);
    whenNear(el, function () {
      preload(order, show, function (logos) {
        try {
          if (logos.length < MIN_LOGOS) {
            el.hidden = true;
            return;
          }
          render(el, logos);
        } catch (err) {
          el.hidden = true;
        }
      });
    });
  }

  function boot() {
    var list = window.MS_CLIENTS;
    if (!Array.isArray(list)) return;
    var clients = list.filter(usable);
    var els = document.querySelectorAll('[data-client-ticker]');
    for (var i = 0; i < els.length; i++) {
      if (clients.length < MIN_LOGOS) els[i].hidden = true;
      else setup(els[i], clients);
    }
  }

  try {
    boot();
  } catch (err) {
    // A broken logo list must never break the page.
  }
})();
