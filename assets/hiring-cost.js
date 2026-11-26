/* The worksheet only reads its own fields. Values never leave this page. */
(function () {
  'use strict';
  const sheet = document.querySelector('.cost-worksheet');
  if (!sheet) return;
  const labor = sheet.querySelectorAll('#cost-time tbody tr');
  const cash = sheet.querySelectorAll('#cost-cash tbody tr');
  const money = new Intl.NumberFormat('en-US', {style:'currency', currency:'USD'});

  function estimate(side) {
    let total = 0;
    let entered = false;
    for (const row of labor) {
      const hours = row.querySelector('[data-col="' + side + '"]');
      const rate = row.querySelector('[data-col="rate"]');
      if (!hours.validity.valid) return 'Check the hours';
      if (hours.value === '') continue;
      if (hours.valueAsNumber > 0 && (!rate.validity.valid || rate.value === '')) return 'Check the hourly cost';
      entered = true;
      if (hours.valueAsNumber > 0) total += hours.valueAsNumber * rate.valueAsNumber;
    }
    for (const row of cash) {
      const expense = row.querySelector('[data-col="' + side + '"]');
      if (!expense) continue;
      if (!expense.validity.valid) return 'Check the expenses';
      if (expense.value === '') continue;
      entered = true;
      total += expense.valueAsNumber;
    }
    if (side === 'out' && entered && sheet.querySelector('#outside-fee').value === '') return 'Enter the outside fee';
    if (!Number.isFinite(total)) return 'Check the amounts';
    return entered ? money.format(total) : '________';
  }

  function update() {
    sheet.querySelector('#cost-in').textContent = estimate('in');
    sheet.querySelector('#cost-out').textContent = estimate('out');
  }
  sheet.addEventListener('input', update);
  window.addEventListener('pageshow', update);
  const print = sheet.querySelector('#cost-print');
  print.hidden = false;
  print.addEventListener('click', () => window.print());
  update();
})();
