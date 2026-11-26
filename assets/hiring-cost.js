/* The worksheet reads only its own fields. Entered values never leave the page. */
(function () {
  'use strict';
  const sheet = document.querySelector('.cost-worksheet');
  if (!sheet) return;
  const labor = sheet.querySelectorAll('#cost-time tbody tr');
  const cashRows = sheet.querySelectorAll('#cost-cash tbody tr:not(#daily-ads):not(#ad-days):not(#ad-credit)');
  const money = new Intl.NumberFormat('en-US', {style:'currency', currency:'USD'});
  const blank = '________';
  const unavailable = 'Check the marked fields';
  const fee = sheet.querySelector('#outside-fee');
  const names = {in:'in-house', out:'with outside help'};
  const errors = new Map();

  sheet.querySelectorAll('input').forEach((input, index) => {
    const note = document.createElement('small');
    note.id = 'worksheet-error-' + index;
    note.className = 'cost-field-error';
    note.hidden = true;
    input.after(note);
    errors.set(input, note);
  });

  function flag(input, message) {
    const note = errors.get(input);
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', note.id);
    note.textContent = message;
    note.hidden = false;
  }

  function format(amount) {
    return Number.isFinite(amount) ? money.format(amount) : 'Amount is too large';
  }

  function calculate(side) {
    let hoursCost = 0, cash = 0;
    let hasHours = false, hasCash = false, hoursOK = true, cashOK = true;
    const column = '[data-col="' + side + '"]';
    for (const row of labor) {
      const hours = row.querySelector(column);
      const rate = row.querySelector('[data-col="rate"]');
      const task = row.querySelector('th').textContent.toLowerCase();
      if (!hours.validity.valid) {
        flag(hours,'Enter zero or more hours for ' + task + ', ' + names[side] + '.');
        hoursOK = false;
      }
      if (hours.value === '') continue;
      hasHours = true;
      if (hours.valueAsNumber > 0) {
        if (rate.value === '' || !rate.validity.valid) {
          flag(rate,'Enter an hourly cost of zero or more for ' + task + '.');
          hoursOK = false;
        } else {
          hoursCost += hours.valueAsNumber * rate.valueAsNumber;
        }
      }
    }
    const daily = sheet.querySelector('#daily-ads ' + column);
    const days = sheet.querySelector('#ad-days ' + column);
    const invoice = sheet.querySelector('#invoice-ads ' + column);
    let adSpend = 0;
    if (daily && days && (daily.value !== '' || days.value !== '' || daily.validity.badInput || days.validity.badInput)) {
      hasCash = true;
      if (invoice.value !== '') {
        flag(invoice,'Use an invoice or daily spend for ' + names[side] + '. Clear the other method.');
        cashOK = false;
      }
      if (daily.value === '' || !daily.validity.valid) {
        flag(daily, 'Enter the daily ad spend for ' + names[side] + ', zero or more.');
        cashOK = false;
      }
      if (days.value === '' || !days.validity.valid) {
        flag(days, 'Enter whole billed days for ' + names[side] + ', zero or more.');
        cashOK = false;
      }
      if (cashOK) {
        adSpend = daily.valueAsNumber * days.valueAsNumber;
        cash += adSpend;
      }
    }
    for (const row of cashRows) {
      const field = row.querySelector(column);
      if (!field) continue;
      if (!field.validity.valid) {
        const expense = row.querySelector('th').textContent.replace(/\s*\(\$\)$/, '').toLowerCase();
        flag(field,'Enter a cost of zero or more for ' + expense + ', ' + names[side] + '.');
        cashOK = false;
      }
      if (field.value === '') continue;
      hasCash = true;
      cash += field.valueAsNumber;
      if (field === invoice) adSpend = field.valueAsNumber;
    }
    if (side === 'out') {
      const credit = sheet.querySelector('#ad-credit input');
      if (credit && (credit.value !== '' || credit.validity.badInput)) {
        hasCash = true;
        if (!credit.validity.valid || credit.valueAsNumber > adSpend) {
          flag(credit,'Enter approved credits from zero to the outside ad spend, before credits.');
          cashOK = false;
        } else {
          cash -= credit.valueAsNumber;
        }
      }
    }

    const missingFee = side === 'out' && (hasHours || hasCash) && fee.value === '' && !fee.validity.badInput;
    if (missingFee) flag(fee,'Outside fee unknown. Enter the full quote, or zero if there’s no fee.');
    const cashText = !cashOK ? unavailable : missingFee ? 'Fee unknown' : hasCash ? format(cash) : blank;
    const timeText = !hoursOK ? unavailable : hasHours ? format(hoursCost) : blank;
    const totalText = !cashOK || !hoursOK ? unavailable : missingFee ? 'Fee unknown' :
      hasCash || hasHours ? format(cash + hoursCost) : blank;
    return {cash:cashText, time:timeText, cost:totalText};
  }

  function update() {
    for (const [input,note] of errors) {
      if (!note.hidden) {
        note.hidden = true;
        input.removeAttribute('aria-invalid');
        input.removeAttribute('aria-describedby');
      }
    }
    for (const side of ['in','out']) {
      for (const [name,value] of Object.entries(calculate(side))) {
        const cell = sheet.querySelector('#' + name + '-' + side);
        if (cell) cell.textContent = value;
      }
    }
  }
  // Announce only the two totals after an edit is committed, while the full
  // labeled table remains available to screen readers at any time.
  sheet.addEventListener('change', () => {
    const status = sheet.querySelector('#cost-status');
    if (!status) return;
    const amount = side => {
      const text = sheet.querySelector('#cost-' + side).textContent;
      return text === blank ? 'no amounts entered' : text;
    };
    status.textContent = 'In-house total entered: ' + amount('in') +
      '. Total entered with outside help: ' + amount('out') + '.';
  });
  sheet.addEventListener('input', update);
  window.addEventListener('pageshow', update);
  const print = sheet.querySelector('#cost-print');
  print.hidden = false;
  print.addEventListener('click', () => window.print());
  update();
})();
