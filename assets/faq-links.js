(function () {
  function openHashAnswer() {
    var id;
    try { id = decodeURIComponent(window.location.hash.slice(1)); }
    catch (error) { return; }
    if (!id) return;
    var target = document.getElementById(id);
    if (!target) return;
    var answer = target.closest('details');
    if (!answer) return;
    answer.open = true;
    requestAnimationFrame(function () {
      target.scrollIntoView({ block: 'start' });
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', openHashAnswer);
  } else {
    openHashAnswer();
  }
  window.addEventListener('hashchange', openHashAnswer);
  // Reopen a closed answer when a link points to the current hash again.
  document.addEventListener('click', function (event) {
    var link = event.target.closest('a[href]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    var url = new URL(link.href, window.location.href);
    if (url.origin === window.location.origin && url.pathname === window.location.pathname &&
        url.search === window.location.search && url.hash && url.hash === window.location.hash) {
      openHashAnswer();
    }
  });
})();
