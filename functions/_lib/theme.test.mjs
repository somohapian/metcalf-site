import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const init = readFileSync(new URL('../../assets/theme-init.js', import.meta.url), 'utf8');
const control = readFileSync(new URL('../../assets/theme.js', import.meta.url), 'utf8');

function harness({saved = null, dark = false, blocked = false, ready = 'complete'} = {}) {
  class Element {
    constructor(tag = 'div') {this.tagName = tag;this.attrs = {};this.children = [];this.events = {};this.className = '';}
    setAttribute(key, value) {this.attrs[key] = value;}
    getAttribute(key) {return this.attrs[key] ?? null;}
    appendChild(child) {this.children.push(child);}
    insertBefore(child, before) {const i = this.children.indexOf(before);if (i < 0) this.children.push(child);else this.children.splice(i, 0, child);}
    addEventListener(event, fn) {this.events[event] = fn;}
    querySelector(selector) {return this.children.find(child => child.className.split(' ').includes(selector.slice(1))) || null;}
  }
  const root = new Element('html'), nav = new Element(), overlay = new Element(), footer = new Element('footer');
  const hamburger = new Element('button');hamburger.className = 'hamburger-btn';nav.appendChild(hamburger);
  const events = {}, docEvents = {}, writes = [], forbidden = [];
  let mediaChange;
  const media = {matches: dark, addEventListener(name, fn) {assert.equal(name, 'change');mediaChange = fn;}};
  const storage = {getItem(key) {assert.equal(key, 'metcalf-theme');if (blocked) throw Error('blocked');return saved;}, setItem(key, value) {if (blocked) throw Error('blocked');writes.push([key, value]);}, removeItem(key) {if (blocked) throw Error('blocked');writes.push([key, null]);}};
  const document = {documentElement: root, readyState: ready, createElement: tag => new Element(tag), addEventListener: (name, fn) => docEvents[name] = fn,
    querySelector: selector => ({'.topnav-inner':nav,'.nav-overlay':overlay,'footer .foot-bottom':footer,'footer':footer})[selector] || null};
  const window = {localStorage: storage, matchMedia(query) {assert.equal(query, '(prefers-color-scheme: dark)');return media;}, addEventListener: (name, fn) => events[name] = fn};
  const deny = name => () => {forbidden.push(name);throw Error('Unexpected ' + name);};
  const context = vm.createContext({window, document, fetch:deny('fetch'), navigator:{sendBeacon:deny('beacon')}, console:{log:deny('logging')}});
  vm.runInContext(init, context);
  return {root,nav,overlay,footer,events,docEvents,writes,forbidden,storage,
    load() {vm.runInContext(control, context);},
    os(value) {media.matches = value;mediaChange();},
    select() {return footer.querySelector('.theme-preference')?.children[1] || null;},
    choose(value) {const target = this.select();target.value = value;target.events.change({target});}};
}

test('early theme uses a valid saved choice, otherwise device preference, without writing storage', () => {
  for (const [options, theme, pref] of [[{dark:true},'dark','auto'],[{saved:'light',dark:true},'light','light'],[{saved:'dark'},'dark','dark'],[{saved:'invalid',dark:true},'dark','auto'],[{blocked:true,dark:true},'dark','auto']]) {
    const h = harness(options);assert.equal(h.root.getAttribute('data-theme'),theme);assert.equal(h.root.getAttribute('data-theme-preference'),pref);assert.deepEqual(h.writes,[]);
  }
});
test('footer preference mounts for loading, interactive and complete states without header controls', () => {
  for (const ready of ['loading','interactive','complete']) {
    const h = harness({ready});h.load();
    if (ready === 'loading') {assert.equal(h.select(),null);h.docEvents.DOMContentLoaded();}
    const label = h.footer.querySelector('.theme-preference'), select = h.select();
    assert.equal(label.tagName,'label');assert.equal(label.children[0].textContent,'Appearance');
    assert.equal(select.tagName,'select');assert.deepEqual(select.children.map(option => [option.value,option.textContent]),[['auto','System'],['light','Light'],['dark','Dark']]);
    assert.equal(select.value,'auto');assert.equal(h.nav.querySelector('.theme-toggle'),null);assert.equal(h.overlay.querySelector('.theme-toggle'),null);
    h.choose('dark');assert.equal(h.root.getAttribute('data-theme'),'dark');assert.equal(select.value,'dark');assert.deepEqual(h.writes,[['metcalf-theme','dark']]);
    h.choose('light');assert.equal(h.root.getAttribute('data-theme'),'light');assert.equal(select.value,'light');assert.deepEqual(h.forbidden,[]);
  }
});
test('choosing System removes the override and resumes device changes', () => {
  const h = harness({saved:'light',dark:true});h.load();assert.equal(h.select().value,'light');
  h.choose('auto');assert.deepEqual(h.writes,[['metcalf-theme',null]]);assert.equal(h.select().value,'auto');
  assert.equal(h.root.getAttribute('data-theme-preference'),'auto');assert.equal(h.root.getAttribute('data-theme'),'dark');
  h.os(false);assert.equal(h.root.getAttribute('data-theme'),'light');
});
test('device changes apply only until the visitor chooses a theme', () => {
  const h = harness();h.load();h.os(true);assert.equal(h.root.getAttribute('data-theme'),'dark');
  h.choose('light');h.os(true);assert.equal(h.root.getAttribute('data-theme'),'light');
  assert.equal(h.root.getAttribute('data-theme-preference'),'light');
});
test('blocked storage does not break selection or let device changes erase the in-memory choice', () => {
  const h = harness({blocked:true});h.load();h.choose('dark');h.os(false);
  assert.equal(h.root.getAttribute('data-theme'),'dark');assert.deepEqual(h.writes,[]);
  h.choose('auto');assert.equal(h.root.getAttribute('data-theme'),'light');assert.equal(h.select().value,'auto');
});
test('cross-tab changes synchronize, removal resumes device preference, unrelated storage is ignored', () => {
  const h = harness();h.load();
  h.events.storage({key:'metcalf-theme',newValue:'dark',storageArea:h.storage});assert.equal(h.root.getAttribute('data-theme'),'dark');assert.equal(h.select().value,'dark');
  h.events.storage({key:'unrelated',newValue:'light'});assert.equal(h.root.getAttribute('data-theme'),'dark');
  h.events.storage({key:'metcalf-theme',newValue:'light',storageArea:{}});assert.equal(h.root.getAttribute('data-theme'),'dark');
  h.events.storage({key:'metcalf-theme',newValue:null,storageArea:h.storage});assert.equal(h.root.getAttribute('data-theme'),'light');assert.equal(h.select().value,'auto');
  assert.equal(h.root.getAttribute('data-theme-preference'),'auto');h.os(true);assert.equal(h.root.getAttribute('data-theme'),'dark');
  h.events.storage({key:null,newValue:null,storageArea:h.storage});assert.equal(h.root.getAttribute('data-theme-preference'),'auto');
});
