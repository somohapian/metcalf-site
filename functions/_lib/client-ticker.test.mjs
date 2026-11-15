import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('../../', import.meta.url);
const scripts = ['clients.js', 'ticker.js'].map(name =>
  readFileSync(new URL('assets/clients/' + name, root), 'utf8'));

function element(tag) {
  return { tag, children: [], attrs: {}, listeners: {},
    style: { setProperty(key, value) { this[key] = value; }, removeProperty(key) { delete this[key]; } },
    appendChild(child) { this.children.push(child); },
    setAttribute(key, value) { this.attrs[key] = value; },
    getAttribute(key) { return this.attrs[key]; },
    addEventListener(name, fn) { this.listeners[name] = fn; }
  };
}

async function render(seed) {
  const strip = element('div');
  strip.attrs['data-show'] = '7';
  const random = Object.create(Math);
  random.random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  class Image {
    set src(value) {
      this.naturalWidth = existsSync(new URL(value.slice(1), root)) ? 1 : 0;
      queueMicrotask(() => this.naturalWidth ? this.onload() : this.onerror());
    }
  }
  const context = vm.createContext({ window: {}, document: {
    createElement: element, querySelectorAll: () => [strip]
  }, Image, Math: random, setTimeout, clearTimeout });
  scripts.forEach(script => vm.runInContext(script, context));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(strip.hidden, false);
  return { strip, clients: context.window.MS_CLIENTS };
}

test('logo selection keeps seven unique clients, group exclusions and hidden duplicate attribution', async () => {
  const orders = [];
  for (const seed of [1, 23, 456]) {
    const { strip, clients } = await render(seed);
    const images = strip.children[1].children[0].children;
    assert.equal(images.length, 14);
    const names = images.slice(0, 7).map(image => image.alt);
    assert.equal(new Set(names).size, 7);
    const groups = names.map(name => clients.find(client => client.name === name).group).filter(Boolean);
    assert.equal(new Set(groups).size, groups.length);
    images.slice(7).forEach((image, i) => {
      assert.equal(image.alt, '');
      assert.equal(image.attrs['aria-hidden'], 'true');
      assert.equal(image.src, images[i].src);
    });
    orders.push(names.join('|'));
  }
  assert.ok(new Set(orders).size > 1);
});

test('explicit pause persists until Play, which restores CSS hover/focus and reduced-motion control', async () => {
  const { strip } = await render(1);
  const track = strip.children[1].children[0], control = strip.children[2];
  assert.equal(control.type, 'button');
  assert.equal(control.attrs['aria-pressed'], 'false');
  control.listeners.click();
  assert.equal(control.textContent, 'Play logos');
  assert.equal(control.attrs['aria-pressed'], 'true');
  assert.equal(track.style['animation-play-state'], 'paused');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(track.style['animation-play-state'], 'paused');
  control.listeners.click();
  assert.equal(control.textContent, 'Pause logos');
  assert.equal(control.attrs['aria-pressed'], 'false');
  assert.equal(track.style['animation-play-state'], undefined);
});
