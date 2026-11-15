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
  const root = new Element('html'), nav = new Element(), overlay = new Element();
  const hamburger = new Element('button');hamburger.className = 'hamburger-btn';nav.appendChild(hamburger);
  const events = {}, docEvents = {}, writes = [], forbidden = [];
  let mediaChange;
  const media = {matches: dark, addEventListener(name, fn) {assert.equal(name, 'change');mediaChange = fn;}};
  const storage = {getItem(key) {assert.equal(key, 'metcalf-theme');if (blocked) throw Error('blocked');return saved;}, setItem(key, value) {if (blocked) throw Error('blocked');writes.push([key, value]);}};
  const document = {documentElement: root, readyState: ready, createElement: tag => new Element(tag), addEventListener: (name, fn) => docEvents[name] = fn,
    querySelector: selector => ({'.topnav-inner':nav,'.nav-overlay':overlay})[selector] || null};
  const window = {localStorage: storage, matchMedia(query) {assert.equal(query, '(prefers-color-scheme: dark)');return media;}, addEventListener: (name, fn) => events[name] = fn};
  const deny = name => () => {forbidden.push(name);throw Error('Unexpected ' + name);};
  const context = vm.createContext({window, document, fetch:deny('fetch'), navigator:{sendBeacon:deny('beacon')}, console:{log:deny('logging')}});
  vm.runInContext(init, context);
  return {root,nav,overlay,events,docEvents,writes,forbidden,storage,
    load() {vm.runInContext(control, context);},
    os(value) {media.matches = value;mediaChange();},
    buttons() {return [nav.querySelector('.theme-toggle'),overlay.querySelector('.theme-toggle')];}};
}

test('early theme uses a valid saved choice, otherwise device preference, without writing storage', () => {
  for (const [options, theme, pref] of [[{dark:true},'dark','auto'],[{saved:'light',dark:true},'light','light'],[{saved:'dark'},'dark','dark'],[{saved:'invalid',dark:true},'dark','auto'],[{blocked:true,dark:true},'dark','auto']]) {
    const h = harness(options);assert.equal(h.root.getAttribute('data-theme'),theme);assert.equal(h.root.getAttribute('data-theme-preference'),pref);assert.deepEqual(h.writes,[]);
  }
});
test('mount waits for navigation initialization and adds accessible synchronized native buttons', () => {
  const h = harness({ready:'interactive'});h.load();assert.equal(h.buttons()[0],null);
  h.docEvents.DOMContentLoaded();
  for (const button of h.buttons()) {assert.equal(button.type,'button');assert.equal(button.getAttribute('aria-label'),'Dark mode');assert.equal(button.getAttribute('aria-pressed'),'false');}
  h.buttons()[0].events.click();
  assert.equal(h.root.getAttribute('data-theme'),'dark');
  assert.deepEqual(h.writes,[['metcalf-theme','dark']]);
  h.buttons().forEach(button => assert.equal(button.getAttribute('aria-pressed'),'true'));
  h.buttons()[1].events.click();
  h.buttons().forEach(button => assert.equal(button.getAttribute('aria-pressed'),'false'));
  assert.deepEqual(h.forbidden,[]);
});
test('device changes apply only until the visitor chooses a theme', () => {
  const h = harness();h.load();h.os(true);assert.equal(h.root.getAttribute('data-theme'),'dark');
  h.buttons()[0].events.click();h.os(true);assert.equal(h.root.getAttribute('data-theme'),'light');
  assert.equal(h.root.getAttribute('data-theme-preference'),'light');
});
test('blocked storage does not break toggling or let device changes erase the in-memory choice', () => {
  const h = harness({blocked:true});h.load();h.buttons()[0].events.click();h.os(false);
  assert.equal(h.root.getAttribute('data-theme'),'dark');assert.deepEqual(h.writes,[]);
});
test('cross-tab changes synchronize, removal resumes device preference, unrelated storage is ignored', () => {
  const h = harness();h.load();
  h.events.storage({key:'metcalf-theme',newValue:'dark',storageArea:h.storage});assert.equal(h.root.getAttribute('data-theme'),'dark');
  h.events.storage({key:'unrelated',newValue:'light'});assert.equal(h.root.getAttribute('data-theme'),'dark');
  h.events.storage({key:'metcalf-theme',newValue:'light',storageArea:{}});assert.equal(h.root.getAttribute('data-theme'),'dark');
  h.events.storage({key:'metcalf-theme',newValue:null,storageArea:h.storage});assert.equal(h.root.getAttribute('data-theme'),'light');
  assert.equal(h.root.getAttribute('data-theme-preference'),'auto');h.os(true);assert.equal(h.root.getAttribute('data-theme'),'dark');
  h.events.storage({key:null,newValue:null,storageArea:h.storage});assert.equal(h.root.getAttribute('data-theme-preference'),'auto');
});
