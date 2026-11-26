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
    heading: 'You interview a shortlist for your opening.',
    explanation: 'Recruiting Partner is $2,950 a month. Your recruiter finds and screens candidates, coordinates interviews and helps you make the offer. We work with your team remotely on one search at a time and can arrange an occasional visit together.'
  };
  const plus = {
    name: 'Recruiting Partner Plus',
    tier: 'recruiting-partner-plus',
    heading: 'You interview a shortlist for each role.'
  };

  function showResult() {
    const { roles, visits } = answers;
    if (roles === null || visits === null) return;

    const needsScope = roles === 2 || visits === 2;
    let outcome;
    if (needsScope) {
      outcome = 'scope_review';
      title.textContent = 'Let’s plan the recruiting work around your team.';
      const notes = [];
      if (roles === 2) {
        notes.push(visits === 2
          ? 'We’ll help you decide which searches to run together and which you can stagger.'
          : 'We’ll help you prioritize the openings. If you can stagger the searches, Plus can cover up to three at once.');
      }
      if (visits === 2) {
        notes.push('Tell us where your managers need help and when. We’ll work out an onsite schedule around the interviews and hiring decisions.');
      }
      notes.push('For reference, Recruiting Partner Pro is $10,950 a month. A dedicated recruiter works with your managers on the roles we agree to cover. Three full onsite days a week are included in Central Ohio.');
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
        reason.textContent = 'Recruiting Partner Plus is $5,950 a month. You can use up to 8 scheduled onsite hours a month in Central Ohio for interviews or time with your hiring manager. If an occasional visit would do, Partner can handle one role for $2,950 a month with visits by agreement.';
      } else {
        reason.textContent = 'Recruiting Partner Plus is $5,950 a month for up to three roles at once. A weekly hiring huddle keeps the searches coordinated. We can work with you remotely or use up to 8 onsite hours a month in Central Ohio for interviews and time with your managers.';
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
