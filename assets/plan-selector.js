(function () {
  'use strict';

  const quiz = document.getElementById('tier-quiz');
  if (!quiz) return;

  const result = quiz.querySelector('.tq-result');
  const title = result.querySelector('[data-result-title]');
  const reason = result.querySelector('[data-result-reason]');
  const primary = result.querySelector('.tq-activate');
  const detail = result.querySelector('.tq-actions .tq-more');
  const buttons = quiz.querySelectorAll('button[data-question]');
  const answers = { roles: null, visits: null };
  let lastOutcome = null;

  const partner = {
    name: 'Recruiting Partner',
    tier: 'recruiting-partner',
    heading: 'Recruiting Partner is $2,950 a month.',
    explanation: 'We run one search at a time. There are no scheduled visits. If a visit would help, we agree on the location, schedule and total in writing before you activate.'
  };
  const plus = {
    name: 'Recruiting Partner Plus',
    tier: 'recruiting-partner-plus',
    heading: 'Recruiting Partner Plus is $5,950 a month.'
  };

  function showResult() {
    const { roles, visits } = answers;
    if (roles === null || visits === null) return;

    const needsScope = roles === 2 || visits === 2;
    let outcome;
    if (needsScope) {
      outcome = 'scope_review';
      title.textContent = 'Let’s talk through the scope first.';
      const notes = [];
      if (roles === 2) {
        notes.push(visits === 2
          ? 'Which searches need to run together, and which could you stagger?'
          : 'Which roles need to move together? If you can stagger the searches, Plus can cover up to three at once.');
      }
      if (visits === 2) {
        notes.push('Tell us how many hours you need and where. We’ll talk through the right schedule for the work.');
      }
      notes.push('For reference, Recruiting Partner Pro is $10,950 a month for roles in the agreed scope. It includes three full onsite days a week in Central Ohio only.');
      reason.textContent = notes.join(' ');
      primary.textContent = 'Talk with us about your search';
      primary.href = '/contact';
      detail.textContent = 'See Recruiting Partner Pro';
      detail.href = '/recruiting-partner-pro';
    } else {
      const plan = roles === 0 && visits === 0 ? partner : plus;
      outcome = plan.tier;
      title.textContent = plan.heading;
      if (plan === partner) {
        reason.textContent = plan.explanation;
      } else if (roles === 0) {
        reason.textContent = 'Plus includes up to 8 scheduled onsite hours a month in Central Ohio. If an occasional visit would do, Partner can handle one role for $2,950 a month with visits by agreement.';
      } else {
        reason.textContent = 'We can work on up to three roles at the same time. The plan includes up to 8 scheduled onsite hours a month in Central Ohio. You can use the plan remotely.';
      }
      primary.textContent = 'Choose ' + plan.name;
      primary.href = '/' + plan.tier + '#checkout';
      detail.textContent = 'See what’s included';
      detail.href = '/' + plan.tier;
    }
    result.hidden = false;
    if (outcome !== lastOutcome && typeof window.gtag === 'function') {
      window.gtag('event', 'tier_quiz_result', { tier: outcome });
    }
    lastOutcome = outcome;
  }

  buttons.forEach(function (button) {
    button.addEventListener('click', function () {
      const question = button.dataset.question;
      answers[question] = Number(button.dataset.level);
      buttons.forEach(function (option) {
        if (option.dataset.question === question) {
          option.setAttribute('aria-pressed', String(option === button));
        }
      });
      showResult();
    });
  });
  quiz.hidden = false;
}());
