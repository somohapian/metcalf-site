/* Choose two complete quote/author pairs once per page load. No rotation. */
(function () {
  'use strict';
  var root = document.querySelector('[data-recommendations]');
  if (!root) return;
  var quotes = Array.prototype.slice.call(root.querySelectorAll('[data-recommendation]'));
  var shuffled = quotes.slice();
  for (var i = shuffled.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var swap = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = swap;
  }
  var selected = shuffled.slice(0, 2);
  quotes.forEach(function (quote) { quote.hidden = selected.indexOf(quote) === -1; });
})();
