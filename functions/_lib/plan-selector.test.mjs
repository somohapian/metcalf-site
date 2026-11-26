import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const asset = '/assets/plan-selector.js';
const script = readFileSync(new URL('../..' + asset, import.meta.url), 'utf8');
const cases = [
  ['recruiting-partner', 'recruiting-partner-plus', 'scope_review'],
  ['recruiting-partner-plus', 'recruiting-partner-plus', 'scope_review'],
  ['scope_review', 'scope_review', 'scope_review']
];

// Build the fixture from each page's actual buttons so either page can catch markup drift.
function createSelector(html) {
  const [markup] = html.match(/<div class="tier-quiz" id="tier-quiz" hidden>[\s\S]+?<script [^>]*><\/script>/);
  assert.ok(markup.includes('src="' + asset + '?'));
  assert.ok(markup.includes('aria-live="polite" aria-atomic="true"'));
  assert.match(markup, /data-question="visits" data-level="0" aria-pressed="false">Remote, with occasional visits by agreement</);
  assert.doesNotMatch(markup, /How often do you hire|Constantly/);
  const callbacks = new Map();
  const buttons = Array.from(markup.matchAll(/<button type="button" class="tq-opt" data-question="(roles|visits)" data-level="(\d)" aria-pressed="false">/g),
    ([, question, level]) => ({
      dataset: { question, level },
      addEventListener(event, callback) { assert.equal(event, 'click'); callbacks.set(this, callback); },
      setAttribute(name, value) { assert.equal(name, 'aria-pressed'); this.pressed = value; }
    }));
  assert.equal(buttons.length, 6);
  const elements = Object.fromEntries(['[data-result-title]', '[data-result-reason]', '.tq-activate', '.tq-actions .tq-more'].map(key => [key, {}]));
  const result = { hidden: true, querySelector: key => elements[key] };
  const quiz = { hidden: true, querySelector: () => result, querySelectorAll: () => buttons };
  const events = [];
  runInNewContext(script, { document: { getElementById: () => quiz }, window: { gtag: (...args) => events.push(args) } });
  assert.equal(quiz.hidden, false);
  function click(question, level) {
    const button = buttons.find(item => item.dataset.question === question && +item.dataset.level === level);
    callbacks.get(button)();
    assert.deepEqual(buttons.filter(other => other.dataset.question === question && other.pressed === 'true'), [button]);
  }
  return { result, elements, events, click };
}

for (const page of ['index', 'activate']) {
  const html = readFileSync(new URL('../../' + page + '.html', import.meta.url), 'utf8');
  test(page + ' explains and routes all nine recruiting choices', () => {
    for (const [roles, row] of cases.entries()) {
      for (const [visits, tier] of row.entries()) {
        const { result, elements, events, click } = createSelector(html);
        click('roles', roles);
        assert.equal(result.hidden, true);
        assert.equal(events.length, 0);
        click('visits', visits);
        assert.equal(result.hidden, false);
        assert.equal(events.length, 1);
        assert.equal(events[0][0], 'event');
        assert.equal(events[0][1], 'tier_quiz_result');
        assert.deepEqual({ ...events[0][2] }, { tier });
        const scope = tier === 'scope_review';
        assert.equal(elements['.tq-activate'].href, scope ? '/contact' : '/' + tier + '#checkout');
        assert.equal(elements['.tq-actions .tq-more'].href, scope ? '/recruiting-partner-pro' : '/' + tier);
        const text = elements['[data-result-title]'].textContent + ' ' + elements['[data-result-reason]'].textContent;
        if (scope) assert.match(text, /\$10,950/);
        if (roles === 2) assert.match(text, /stagger/);
        if (visits === 2) {
          assert.match(text, /schedule/);
          assert.doesNotMatch(text, /Plus can cover/);
        }
        if (roles === 0 && visits === 1) assert.match(text, /occasional visit/);
        if (tier === 'recruiting-partner') assert.match(text, /screen/i);
        click('visits', visits);
        assert.equal(events.length, 1);
      }
    }
  });
  test(page + ' updates an earlier choice and distinguishes a scoping inquiry from a tier', () => {
    const { elements, events, click, result } = createSelector(html);
    click('visits', 0);
    assert.equal(result.hidden, true);
    click('roles', 0);
    click('roles', 1);
    click('roles', 2);
    click('visits', 2);
    assert.deepEqual(events.map(event => event[2].tier), ['recruiting-partner', 'recruiting-partner-plus', 'scope_review']);
    assert.equal(elements['.tq-activate'].href, '/contact');
  });
}
