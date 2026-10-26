#!/usr/bin/env python3
"""Generate the three Recruiting Partner tier pages and the client strip snippet.

Shared parts (head boilerplate, base CSS, nav, footer, nav scripts) are cut
byte for byte from services.html so sitewide find-and-replace edits keep
working. Only the per-tier content below differs between the three pages.

Page order (the page sells first and explains second): nav, hero with the
Activate button, capsule, checkout card (#checkout), client strip as a proof
band, who it is for, what a month buys, what happens after you click, the
result with the math box, repeat call to action, three questions, billing
terms, footer. Prices come from MONTHLY alone.

The pages are public: indexable, listed in sitemap.xml, linked from the
homepage tier cards, /activate and /services. GA4: view_item once per page
view, begin_checkout on the first click of an Activate button or focus in the
checkout form (once per page view), purchase on /onboarding/ once Stripe reports the session paid.

Usage: python3 build_tiers.py /root/metcalf-site
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "/root/metcalf-site")
ORIGIN = "https://metcalfsearch.com"

services = (ROOT / "services.html").read_text(encoding="utf-8")
lines = services.split("\n")


def cut(first, last, starts, ends):
    """Return services.html lines first..last (1-based, inclusive), checked."""
    chunk = "\n".join(lines[first - 1:last])
    assert chunk.startswith(starts), (first, chunk[:80])
    assert chunk.endswith(ends), (last, chunk[-80:])
    return chunk


HEAD_TOP = cut(1, 5, "<!DOCTYPE html>", 'initial-scale=1.0">')
FONTS = cut(20, 22, '<link rel="preconnect" href="https://fonts.googleapis.com">', 'display=swap" rel="stylesheet">')
LOCAL_BUSINESS = cut(24, 24, '<script type="application/ld+json">{"@context":"https://schema.org","@type":"LocalBusiness"', "</script>")
GA = cut(30, 31, '<script async src="https://www.googletagmanager.com/gtag/js?id=G-0R74SX6WZX"></script>', "</script>")
BASE_STYLE = cut(32, 102, "<style>\n:root{", "</style>")
FAVICONS = cut(103, 108, '<link rel="icon" type="image/svg+xml"', '<meta name="theme-color" content="#6f9b7c">')
HAMBURGER_CSS = cut(110, 150, '<style id="metcalf-hamburger-css">', "</style>")
FAQ_CSS = cut(151, 184, '<style id="metcalf-faq-card-behavior">', "</style>")
NAV = cut(189, 191, '<nav class="topnav" id="topnav">', "</div></nav>")
FOOTER = cut(274, 276, '<footer class="foot">', "</footer>")
NAV_SCRIPT = cut(278, 278, "<script>const nav=document.getElementById('topnav');", "</script>")
HAMBURGER_SCRIPT = cut(326, 400, "<script>\n(function(){\n  function init(){", "})();\n</script>")

assert 'Start a Conversation</a>' in NAV and 'href="/contact" class="nav-cta"' in NAV
# Stripe publishable key (live mode) for the embedded checkout. It used to be
# read from the pricing table on activate.html, which now links to the tier
# pages instead. A publishable key is public by design.
KEY = "pk_live_51QXRhxAoR3j4s929w8XwWnB5SbgUlJUiUwgxIs0jaX1qqvs51ZisxvWcY2CzcijtzAY25SRdmUJsK1NLRcFOQWnW001YnWf7Hg"
assert re.fullmatch(r"pk_live_[A-Za-z0-9]+", KEY)

# ---------------------------------------------------------------- CSS

TIER_CSS = """<style id="metcalf-tier-page">
/* Tier pages: layout shared by recruiting-partner, recruiting-partner-plus and recruiting-partner-pro. */
.page-hero h1{text-wrap:balance;}
.page-hero h1 .accent{padding-right:0.1em;}
.eyebrow-part,.nowrap{white-space:nowrap;}
/* Hero buttons: .hero-cta, .btn-solid and .btn-textlink as on index.html, minus the entrance animation. */
.hero-cta{display:flex;gap:28px;align-items:center;justify-content:center;flex-wrap:wrap;margin-top:38px;}
.btn-solid{display:inline-block;font-family:var(--body);font-size:15px;font-weight:500;letter-spacing:0.02em;border-radius:2px;padding:14px 26px;background:var(--ink);color:var(--paper);transition:background 0.25s ease;}
.btn-solid:hover{background:var(--brick);}
.btn-textlink{font-family:var(--body);font-size:15px;font-weight:500;letter-spacing:0.02em;color:var(--brick);border-bottom:1px solid var(--brick);padding-bottom:2px;transition:opacity 0.2s ease;}
.btn-textlink:hover{opacity:0.7;}
.prose h2 .accent{font-style:italic;font-weight:400;}
.prose .buys{list-style:none;padding:0;margin-top:28px;border-top:1px solid var(--rule);}
.prose .buys li{position:relative;margin:0;padding:20px 0 20px 36px;border-bottom:1px solid var(--rule);font-size:16px;line-height:1.6;color:var(--ink-soft);}
.prose .buys li::before{content:"";position:absolute;left:3px;top:27px;width:13px;height:7px;border-left:2px solid var(--celadon-deep);border-bottom:2px solid var(--celadon-deep);transform:rotate(-45deg);}
.prose .buys strong{display:block;margin-bottom:4px;font-family:var(--display);font-weight:500;font-size:20px;line-height:1.3;letter-spacing:-0.01em;color:var(--ink);}
.prose .timeline{list-style:none;padding:0;margin-top:32px;}
.prose .timeline li{position:relative;margin:0;padding:0 0 30px 36px;}
.prose .timeline li:last-child{padding-bottom:0;}
.prose .timeline li::before{content:"";position:absolute;left:5px;top:16px;bottom:-5px;width:1px;background:var(--celadon);}
.prose .timeline li:last-child::before{display:none;}
.prose .timeline li::after{content:"";position:absolute;left:0;top:5px;width:11px;height:11px;border-radius:50%;background:var(--paper);border:2px solid var(--celadon-deep);}
.timeline-when{display:block;margin-bottom:4px;font-family:var(--body);font-size:12px;font-weight:600;line-height:1.75;letter-spacing:0.16em;text-transform:uppercase;color:var(--celadon-deep);}
.prose .result-line{font-family:var(--display);font-size:clamp(22px,2.4vw,26px);line-height:1.45;letter-spacing:-0.01em;color:var(--ink);}
.mathbox{background:var(--paper-warm);border:1px solid var(--rule);border-radius:2px;padding:24px 28px;margin:32px 0;font-family:var(--body);font-size:15px;line-height:1.8;}
.prose .mathbox h3{margin:0 0 8px;font-family:var(--display);font-weight:500;font-size:22px;line-height:1.3;letter-spacing:-0.01em;color:var(--ink);}
.mathbox h3 .accent{font-style:italic;}
.prose .mathbox p{margin:0;font-size:16px;line-height:1.75;color:var(--ink-soft);}
.mathbox strong{font-weight:600;color:var(--ink);white-space:nowrap;}
/* Checkout card: the buy sits directly under the capsule. The section is the #checkout scroll target. */
.capsule{margin-bottom:40px;}
.checkout{margin:24px 0 0;padding:64px 32px;background:var(--paper-warm);scroll-margin-top:var(--nav-h);}
.checkout-card{max-width:1040px;margin:0 auto;background:#fff;border-radius:14px;box-shadow:0 1px 2px rgba(31,36,33,0.06),0 12px 40px rgba(31,36,33,0.08);padding:52px 48px 40px;}
.section-head{text-align:center;max-width:720px;margin:0 auto 40px;}
.section-eyebrow{font-family:var(--body);font-size:12px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:var(--celadon-deep);margin-bottom:14px;}
.section-h2{font-family:var(--display);font-optical-sizing:auto;font-variation-settings:"opsz" 96;font-weight:400;font-size:clamp(30px,3.8vw,44px);line-height:1.15;letter-spacing:-0.02em;color:var(--ink);}
.section-h2 .accent{font-style:italic;font-weight:400;}
.section-sub{font-family:var(--body);font-size:17px;line-height:1.6;color:var(--ink-soft);margin-top:14px;}
.price-line{max-width:620px;margin:24px auto 0;font-family:var(--display);font-optical-sizing:auto;font-weight:400;font-size:clamp(19px,2vw,22px);line-height:1.5;letter-spacing:-0.005em;color:var(--ink);text-wrap:balance;}
.price-line strong{font-weight:600;white-space:nowrap;}
@media(min-width:721px){.price-terms{white-space:nowrap;}}
.checkout-form{max-width:480px;margin:0 auto;}
.checkout-form[hidden]{display:none;}
.checkout-label{display:block;margin:0 0 6px;font-family:var(--body);font-size:13px;font-weight:500;line-height:1.4;color:var(--ink-soft);}
.checkout-input{display:block;width:100%;box-sizing:border-box;margin:0 0 16px;padding:12px 14px;font-family:var(--body);font-size:15px;line-height:1.4;color:var(--ink);background:var(--paper);border:1px solid var(--rule);border-radius:4px;box-shadow:none;outline:none;-webkit-appearance:none;appearance:none;transition:border-color 0.15s ease;}
.checkout-input::placeholder{color:var(--ink-faint);}
.checkout-input:focus{border-color:var(--celadon-deep);}
.checkout-input[aria-invalid="true"]{border-color:var(--brick);}
.checkout-mount{min-height:180px;}
.checkout-submit{display:block;width:100%;margin:24px 0 0;border:0;cursor:pointer;text-align:center;line-height:1.4;}
.checkout-submit:disabled{cursor:default;opacity:0.6;}
.checkout-submit:disabled:hover{background:var(--ink);}
.checkout-error{margin:12px 0 0;font-family:var(--body);font-size:14px;line-height:1.5;color:var(--brick);}
.checkout-error[hidden]{display:none;}
.checkout-terms{margin:14px 0 0;text-align:center;font-family:var(--body);font-size:13px;line-height:1.5;color:var(--ink-faint);}
/* The client strip as a quiet proof band right under the checkout card. */
.client-strip.client-strip--hero{background:none;border:0;padding:44px 0 0;margin:0 -32px;}
.client-strip--hero .client-strip__label{margin-bottom:18px;}
.client-strip--hero img{opacity:0.7;}
/* Repeat call to action after the math box. */
.cta-band{margin:0;padding:72px 32px 76px;background:var(--celadon-mist);border-top:1px solid var(--celadon);border-bottom:1px solid var(--celadon);text-align:center;}
.cta-band .section-h2{margin-bottom:28px;}
.cta-band-note{margin-top:18px;font-family:var(--body);font-size:15px;line-height:1.6;color:var(--ink-soft);}
.checkout-fallback{max-width:600px;margin:0 auto;text-align:center;font-family:var(--body);font-size:15px;line-height:1.6;color:var(--ink-soft);}
.checkout-fallback[hidden]{display:none;}
.checkout-alt{max-width:600px;margin:20px auto 0;text-align:center;font-family:var(--body);font-size:15px;line-height:1.6;color:var(--ink-soft);}
.checkout-fallback a,.checkout-alt a,.faq-answer a,.terms-body a{color:var(--brick);border-bottom:1px solid rgba(168,62,44,0.3);transition:border-color 0.2s ease;}
.checkout-fallback a:hover,.checkout-alt a:hover,.faq-answer a:hover,.terms-body a:hover{border-bottom-color:var(--brick);}
.faq-section{max-width:720px;margin:96px auto 0;padding:0 32px;}
.faq-section h2{margin:0 0 28px;font-family:var(--display);font-optical-sizing:auto;font-variation-settings:"opsz" 96;font-weight:400;font-size:clamp(28px,3.6vw,40px);line-height:1.2;letter-spacing:-0.02em;color:var(--ink);}
.faq-section h2 .accent{font-style:italic;font-weight:400;}
.faq-section .faq-list{grid-template-columns:1fr !important;}
.faq-item summary,.terms-fold summary{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;cursor:pointer;list-style:none;transition:color 0.2s ease;}
.faq-item summary::-webkit-details-marker,.terms-fold summary::-webkit-details-marker{display:none;}
.faq-item summary::after,.terms-fold summary::after{content:"";flex:none;width:9px;height:9px;margin:7px 4px 0 0;border-right:2px solid var(--celadon-deep);border-bottom:2px solid var(--celadon-deep);transform:rotate(45deg);transition:transform 0.2s ease;}
.faq-item[open] summary::after,.terms-fold[open] summary::after{margin-top:11px;transform:rotate(-135deg);}
.faq-item summary:hover,.terms-fold summary:hover{color:var(--brick);}
.faq-item summary{font-family:var(--display);font-weight:500;font-size:20px;line-height:1.35;color:var(--ink);}
.faq-answer{margin-top:14px;font-family:var(--body);font-size:17px;line-height:1.65;color:var(--ink-soft);}
.terms-fold{margin-top:32px;border-top:1px solid var(--rule);border-bottom:1px solid var(--rule);}
.terms-fold summary{padding:18px 0;font-family:var(--body);font-size:15px;font-weight:500;line-height:1.5;color:var(--ink-soft);}
.terms-fold summary::after{margin-top:5px;}
.terms-fold[open] summary::after{margin-top:9px;}
.terms-body{padding:0 0 20px;font-family:var(--body);font-size:15px;line-height:1.65;color:var(--ink-soft);}
@media(max-width:720px){.hero-cta{display:block;margin-top:32px;}.hero-cta .btn-solid{display:block;margin-bottom:20px;text-align:center;}.checkout{padding:32px 12px;}.checkout-card{padding:36px 12px 28px;border-radius:10px;}.client-strip.client-strip--hero{padding-top:32px;margin:0 -16px;}.cta-band{padding:56px 24px 60px;}.cta-band .btn-solid{display:block;}.faq-section{margin-top:72px;}.mathbox{padding:20px;}.prose .buys strong{font-size:18px;}.faq-item summary{font-size:18px;}}
</style>"""

STRIP_CSS = """<style id="metcalf-client-strip">
/* Client logo strip. Filled by /assets/clients/ticker.js from /assets/clients/clients.js. */
.client-strip{margin:0;padding:48px 0 52px;background:var(--paper-warm);border-top:1px solid var(--rule);border-bottom:1px solid var(--rule);}
.client-strip:empty{padding:0;border:0;}
.client-strip[hidden]{display:none;}
.client-strip__label{margin:0 0 28px;padding:0 24px;text-align:center;text-wrap:balance;font-family:var(--body);font-size:12px;font-weight:600;line-height:1.5;letter-spacing:0.18em;text-transform:uppercase;color:var(--ink-faint);}
.client-strip__viewport{overflow:hidden;-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 12%,#000 88%,transparent 100%);mask-image:linear-gradient(90deg,transparent 0,#000 12%,#000 88%,transparent 100%);}
.client-strip__track{display:flex;align-items:center;gap:56px;width:max-content;padding-right:56px;animation:client-strip-scroll var(--strip-duration,22.4s) linear infinite;}
.client-strip img{display:block;flex:none;width:auto;max-width:none;opacity:0.82;}
.client-strip__viewport:hover .client-strip__track,.client-strip__viewport:focus-within .client-strip__track{animation-play-state:paused;}
@keyframes client-strip-scroll{from{transform:translateX(0);}to{transform:translateX(-50%);}}
@media(max-width:639px){
  .client-strip__viewport{overflow-x:auto;scroll-snap-type:x mandatory;scroll-padding:0 24px;scrollbar-width:none;-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 24px,#000 calc(100% - 24px),transparent 100%);mask-image:linear-gradient(90deg,transparent 0,#000 24px,#000 calc(100% - 24px),transparent 100%);}
  .client-strip__viewport::-webkit-scrollbar{display:none;}
  .client-strip__track{animation:none;padding:0 24px;}
  .client-strip img{scroll-snap-align:start;}
  .client-strip img[aria-hidden="true"]{display:none;}
}
@media(prefers-reduced-motion:reduce){
  .client-strip__viewport{overflow:visible;-webkit-mask-image:none;mask-image:none;}
  .client-strip__track{animation:none;width:auto;flex-wrap:wrap;justify-content:center;row-gap:28px;padding:0 24px;}
  .client-strip img[aria-hidden="true"]{display:none;}
}
</style>"""

STRIP_DIV = '<div class="client-strip" data-client-ticker data-show="7"></div>'
HERO_STRIP_DIV = '<div class="client-strip client-strip--hero" data-client-ticker data-show="7"></div>'
STRIP_SCRIPTS = ('<script src="/assets/clients/clients.js" defer></script>\n'
                 '<script src="/assets/clients/ticker.js" defer></script>')

# ------------------------------------------------------------ checkout JS

CHECKOUT_SCRIPT = """<script>
(function(){
  // Custom checkout: our own form (email, Stripe's Payment Element, our button) on a
  // Checkout Session created with ui_mode "elements" by /api/checkout. Stripe.js is the
  // endive release, matching the Stripe-Version the function pins.
  var section=document.getElementById('checkout');
  var form=document.getElementById('checkout-form');
  if(!section||!form)return;
  var fallback=document.getElementById('checkout-fallback');
  var emailEl=document.getElementById('checkout-email');
  var submitEl=document.getElementById('checkout-submit');
  var errorEl=document.getElementById('checkout-error');
  var tier=section.getAttribute('data-tier');
  var item=section.getAttribute('data-item');
  var price=Number(section.getAttribute('data-price'));
  var baseLabel=submitEl.getAttribute('data-label');
  var KEY='__KEY__';
  var EMAIL=/^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/;
  var started=false,failed=false,ready=false,busy=false,actions=null,lastEmail='';
  var label=submitEl.textContent;
  // GA4: view_item once per page view; begin_checkout once per page view, on the first
  // click of an Activate button or the first focus inside the checkout form.
  function track(name){if(typeof gtag==='function'){gtag('event',name,{currency:'USD',value:price,items:[{item_name:item,price:price}]});}}
  var begun=false;
  function begin(){if(begun)return;begun=true;try{track('begin_checkout');}catch(e){}}
  function showError(msg){errorEl.textContent=msg;errorEl.hidden=!msg;}
  function setBusy(on){busy=on;submitEl.disabled=on;submitEl.textContent=on?'Activating...':label;}
  function fail(err){
    try{console.error('Checkout did not load:',err);}catch(e){}
    if(ready)return;
    failed=true;form.hidden=true;if(fallback)fallback.hidden=false;
  }
  // Stripe requires the page to show the session total it reads from the session.
  function money(t,cur,div){
    var n=t/div;
    try{return new Intl.NumberFormat('en-US',{style:'currency',currency:cur.toUpperCase(),minimumFractionDigits:n%1?2:0,maximumFractionDigits:2}).format(n);}
    catch(e){return '$'+n;}
  }
  function showTotal(session){
    try{
      var t=session.total.total;
      label=baseLabel+', '+money(t.minorUnitsAmount,session.currency,session.minorUnitsAmountDivisor||100)+' a month';
      if(!busy)submitEl.textContent=label;
    }catch(e){}
  }
  function loadStripe(){
    return new Promise(function(resolve,reject){
      if(window.Stripe){resolve(window.Stripe);return;}
      var s=document.createElement('script');
      s.src='https://js.stripe.com/endive/stripe.js';
      s.async=true;
      s.onload=function(){if(window.Stripe)resolve(window.Stripe);else reject(new Error('Stripe.js loaded without Stripe'));};
      s.onerror=function(){reject(new Error('Stripe.js failed to load'));};
      document.head.appendChild(s);
    });
  }
  function fetchSecret(){
    return fetch('/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tier:tier})})
      .then(function(res){if(!res.ok)throw new Error('checkout API answered '+res.status);return res.json();})
      .then(function(data){if(!data||typeof data.clientSecret!=='string')throw new Error('checkout API sent no client secret');return data.clientSecret;});
  }
  var APPEARANCE={
    theme:'flat',
    variables:{
      colorPrimary:'#1f2421',colorBackground:'#fafaf7',colorText:'#1f2421',colorTextSecondary:'#4a534f',
      colorTextPlaceholder:'#8a918d',colorDanger:'#a83e2c',colorIcon:'#4a534f',
      fontFamily:'Geist, system-ui, sans-serif',fontSizeBase:'15px',fontWeightNormal:'400',fontWeightMedium:'500',
      borderRadius:'4px',spacingUnit:'4px',gridRowSpacing:'16px',gridColumnSpacing:'12px',focusBoxShadow:'none',focusOutline:'none'
    },
    rules:{
      '.Input':{border:'1px solid #d8dcd6',boxShadow:'none',padding:'12px 14px',backgroundColor:'#fafaf7',lineHeight:'1.4'},
      '.Input:focus':{border:'1px solid #6f9b7c',boxShadow:'none'},
      '.Input--invalid':{border:'1px solid #a83e2c',boxShadow:'none',color:'#1f2421'},
      '.Label':{fontFamily:'Geist, system-ui, sans-serif',fontSize:'13px',fontWeight:'500',color:'#4a534f',marginBottom:'6px'},
      '.Error':{fontSize:'13px',color:'#a83e2c'},
      '.Tab':{border:'1px solid #d8dcd6',boxShadow:'none',backgroundColor:'#ffffff'},
      '.Tab:hover':{color:'#1f2421'},
      '.Tab--selected':{border:'1px solid #6f9b7c',boxShadow:'none',backgroundColor:'#fafaf7'},
      '.Tab--selected:focus':{boxShadow:'none'},
      '.AccordionItem':{border:'1px solid #d8dcd6',boxShadow:'none',backgroundColor:'#ffffff'},
      '.Block':{border:'1px solid #d8dcd6',boxShadow:'none',backgroundColor:'#fafaf7'},
      '.PickerItem':{border:'1px solid #d8dcd6',boxShadow:'none'},
      '.PickerItem--selected':{border:'1px solid #6f9b7c',boxShadow:'none'},
      '.CheckboxInput':{border:'1px solid #d8dcd6',boxShadow:'none'},
      '.CheckboxInput--checked':{backgroundColor:'#1f2421',borderColor:'#1f2421'}
    }
  };
  function start(){
    if(started)return;
    started=true;
    form.hidden=false;
    try{
      loadStripe().then(function(Stripe){
        var checkout=Stripe(KEY).initCheckoutElementsSdk({
          clientSecret:fetchSecret(),
          elementsOptions:{
            appearance:APPEARANCE,
            fonts:[{cssSrc:'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap'}]
          }
        });
        checkout.on('change',showTotal);
        var payment=checkout.createPaymentElement({layout:{type:'accordion',defaultCollapsed:false,radios:'if_multiple',spacedAccordionItems:true},fields:{billingDetails:{email:'never'}}});
        payment.on('ready',function(){if(failed)return;ready=true;if(fallback)fallback.hidden=true;});
        payment.on('focus',begin);
        payment.on('loaderror',function(ev){fail(ev&&ev.error?ev.error:new Error('Payment Element load error'));});
        payment.mount('#stripe-checkout');
        return checkout.loadActions().then(function(result){
          if(!result||result.type!=='success')throw (result&&result.error)||new Error('Checkout actions did not load');
          actions=result.actions;
          try{showTotal(actions.getSession());}catch(e){}
        });
      }).catch(fail);
    }catch(err){fail(err);}
  }
  function emailValue(){return (emailEl.value||'').trim();}
  function checkEmail(){
    var v=emailValue();
    if(!EMAIL.test(v)){emailEl.setAttribute('aria-invalid','true');return false;}
    emailEl.removeAttribute('aria-invalid');return true;
  }
  form.addEventListener('focusin',begin);
  emailEl.addEventListener('input',function(){if(emailEl.getAttribute('aria-invalid'))checkEmail();});
  emailEl.addEventListener('blur',function(){
    var v=emailValue();
    if(!v||!actions||v===lastEmail)return;
    if(!checkEmail()){showError('Enter a valid email address.');return;}
    showError('');
    lastEmail=v;
    Promise.resolve(actions.updateEmail(v)).then(function(r){
      if(r&&r.type==='error'){lastEmail='';emailEl.setAttribute('aria-invalid','true');showError(r.error&&r.error.message?r.error.message:'Enter a valid email address.');}
    }).catch(function(){lastEmail='';});
  });
  form.addEventListener('submit',function(ev){
    ev.preventDefault();
    begin();
    if(busy)return;
    showError('');
    if(!checkEmail()){showError('Enter a valid email address.');emailEl.focus();return;}
    if(!actions){showError('The checkout is still loading. Try again in a moment.');return;}
    setBusy(true);
    var v=emailValue();
    Promise.resolve(actions.confirm({email:v})).then(function(r){
      // On success Stripe redirects to the return URL; only an error comes back here.
      if(r&&r.type==='error'){showError(r.error&&r.error.message?r.error.message:'The payment did not go through. Check the details and try again.');}
      setBusy(false);
    }).catch(function(err){
      try{console.error('Checkout confirm failed:',err);}catch(e){}
      showError('Something went wrong on our side. Email info@metcalfsearch.com or call 614.434.6646 and we will activate it by hand.');
      setBusy(false);
    });
  });
  try{track('view_item');}catch(e){}
  var buttons=document.querySelectorAll('a.btn-solid[href="#checkout"]');
  for(var i=0;i<buttons.length;i++){buttons[i].addEventListener('click',begin);}
  // The checkout sits right under the capsule, so it loads as soon as the page is ready.
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',start);}else{start();}
})();
</script>""".replace("__KEY__", KEY)

# ------------------------------------------------------------ tier content

MONTHLY = {"partner": 2950, "plus": 5950, "pro": 10950}  # one number per tier drives every price on its page
SALARY, FEE_PERCENT = 65000, 25  # the contingency example in every math box
PER_HIRE = SALARY * FEE_PERCENT // 100  # $16,250 per contingency hire


def money(n):
    return f"${n:,}"


P, PLUS, PRO = MONTHLY["partner"], MONTHLY["plus"], MONTHLY["pro"]
CONTINGENCY = f"contingency hires at a {money(SALARY)} salary and a {FEE_PERCENT} percent fee cost"
MATH_CLOSE = "The fee never moves with the offer. There is no bonus for a bigger salary and every reason to fill fast and right."
FIT_CALL = 'Questions first? <span class="nowrap">Book the thirty-minute fit call.</span>'

PER_HIRE_Q = "Are there any per-hire fees?"
PER_HIRE_A = "No. The monthly subscription is the full cost. A filled role costs the same as an open one, and a bigger offer does not raise our fee."

STEP_TODAY = ("Today", "You activate. A confirmation lands in your inbox within minutes, and you book the kickoff on the next page.")
STEP_FILL = ("Thirty to forty-five days", "Most roles fill. Specialized roles run forty-five to sixty. Then the ninety-day keep plan starts.")

PLUS_LINK = '<a href="/recruiting-partner-plus">Recruiting Partner Plus</a>'
PRO_LINK = '<a href="/recruiting-partner-pro">Recruiting Partner Pro</a>'
PARTNER_LINK = '<a href="/recruiting-partner">Recruiting Partner</a>'


def billing(name, price):
    return (f"{name} is {price} a month, billed monthly in advance, month to month. Move up or down a tier "
            "at any monthly cycle; rates are grandfathered. Cancel with thirty days notice by emailing "
            '<a href="mailto:info@metcalfsearch.com">info@metcalfsearch.com</a>. The partnership agreement, '
            "signed at kickoff, governs the partnership.")


TIERS = [
    {
        "route": "recruiting-partner",
        "key": "partner",
        "name": "Recruiting Partner",
        "price": money(P),
        "value": P,
        "title": f"Recruiting Partner, {money(P)} a Month | Metcalf Search",
        "description": f"Recruiting Partner: one active role at a time, run start to finish by a senior recruiter for a flat {money(P)} a month. No per-hire fees. Activate on this page.",
        "eyebrow": f"RECRUITING PARTNER &middot; {money(P)} A MONTH",
        "h1": 'Recruiting, <span class="accent">done</span> for you.',
        "sub": "One active role at a time, run start to finish by a senior recruiter. You interview a short list. You never wade through a thousand resumes again.",
        "capsule": f"<strong>Recruiting Partner</strong> is the base Metcalf Search tier: one role open at a time, sourced, screened and closed by us, for a flat {money(P)} a month. No per-hire fees. Month to month.",
        "who": "Owners with one seat open now and a few more coming this year. Companies of roughly ten to two hundred people, in any industry, where hiring lands on the owner or on one overloaded HR person. If you usually have two or three roles open at once, " + PLUS_LINK + " fits better.",
        "buys": [
            ("A senior recruiter is your single point of contact.", "One person owns your role start to finish, backed by the Metcalf Search team."),
            ("The full STACK Method on the search.", "A sourcing plan, a tempo commitment, a structured assessment, an offer sequence and a ninety-day keep plan."),
            ("Ad spend, included.", "The job runs where candidates actually look, on our budget, not yours."),
            ("MS Rosie, the full desk, from day one.", "Your branded careers page, applicant tracking and a live view of every candidate in the search."),
            ("A short list, not a pile.", "You see the three or four people worth an hour, with our write-up on each."),
            ("The interviews, the offer and the first ninety days.", "We schedule and prep the interviews, build the offer, and run the thirty, sixty and ninety day check-ins with the hire and the manager."),
            ("One active role at a time.", "When it fills, the next one starts. No per-hire fee when it does."),
        ],
        "timeline": [
            STEP_TODAY,
            ("Within 48 hours", "Kickoff. A ninety-minute intake on the role, the team and the pay. Sourcing starts the same day."),
            ("Five business days", "The first slate of vetted candidates is in front of you."),
            ("Week two", "First interviews. We schedule them, prep both sides and debrief after each one."),
            STEP_FILL,
        ],
        "result": "The seat is filled. The hire is still there at ninety days. You have your week back.",
        "math": (f"Twelve months of Recruiting Partner is <strong>{money(12 * P)}</strong>. Two {CONTINGENCY} <strong>{money(2 * PER_HIRE)}</strong>. "
                 f"The third hire is where contingency stops making sense: <strong>{money(3 * PER_HIRE)}</strong> for three, against the same <strong>{money(12 * P)}</strong>. {MATH_CLOSE}"),
        "faq": [
            ("What if we have two roles open at once?", "Recruiting Partner runs one active role at a time. Move up to " + PLUS_LINK + " for the month and back down when the second role fills. Tiers change at any monthly cycle and your rate is grandfathered."),
            (PER_HIRE_Q, PER_HIRE_A),
            ("What happens right after I pay?", "You land on the kickoff page, book the ninety-minute intake, and get the partnership materials by email within minutes. Kickoff happens within 48 hours and sourcing starts that day."),
        ],
    },
    {
        "route": "recruiting-partner-plus",
        "key": "plus",
        "name": "Recruiting Partner Plus",
        "price": money(PLUS),
        "value": PLUS,
        "title": f"Recruiting Partner Plus, {money(PLUS)} a Month | Metcalf Search",
        "description": f"Recruiting Partner Plus: two to three roles at once, an onsite hour every week and ad spend included, for a flat {money(PLUS)} a month. No per-hire fees. Activate here.",
        "eyebrow": f"RECRUITING PARTNER PLUS &middot; {money(PLUS)} A MONTH",
        "h1": 'Two or three roles at once. Recruiting, <span class="accent">done</span> for you.',
        "sub": "Up to three roles running at the same time, an hour onsite every week and ad spend included. You interview short lists. We handle the rest.",
        "capsule": f"<strong>Recruiting Partner Plus</strong> is the Metcalf Search mid tier: two to three concurrent roles, one onsite hour each week with your hiring managers, for a flat {money(PLUS)} a month. No per-hire fees. Month to month.",
        "who": "Owners and HR managers with hiring that does not stop: two or three seats open most months, several managers to coordinate, and nobody with the hours to run it properly. Companies of roughly ten to two hundred people, in any industry.",
        "buys": [
            ("A senior recruiter is your single point of contact.", "Two to three roles at once, backed by the Metcalf Search team."),
            ("One onsite hour every week.", "Hiring manager time, interview debriefs and the decisions that stall over email. The same hour every week, so it actually happens."),
            ("The full STACK Method on every search.", "A sourcing plan, a tempo commitment, a structured assessment, an offer sequence and a ninety-day keep plan, per role."),
            ("Ad spend for every open role, included.", "Each job runs where candidates actually look, on our budget, not yours."),
            ("MS Rosie, the full desk, from day one.", "Your branded careers page, applicant tracking and a live view of every candidate in every search."),
            ("Short lists, write-ups, interviews, offers and the first ninety days.", "On every hire, with the thirty, sixty and ninety day check-ins run by us."),
            ("Move down when hiring slows, back up when it picks up.", "Tiers change at any monthly cycle and your rate is grandfathered."),
        ],
        "timeline": [
            STEP_TODAY,
            ("Within 48 hours", "Kickoff. A ninety-minute intake on the role, the team and the pay. Sourcing starts the same day."),
            ("Five business days", "The first slates of vetted candidates, one per open role, are in front of you."),
            ("Week two", "First interviews on every role. We schedule them, prep both sides and debrief after each one."),
            STEP_FILL,
        ],
        "result": "Every open seat moving at once. Managers who know where each search stands. Hires still there at ninety days.",
        "math": (f"Twelve months of Recruiting Partner Plus is <strong>{money(12 * PLUS)}</strong>. Five {CONTINGENCY} <strong>{money(5 * PER_HIRE)}</strong>. "
                 f"Six cost <strong>{money(6 * PER_HIRE)}</strong>. The subscription stays at <strong>{money(12 * PLUS)}</strong> whether you hire four people this year or eight. {MATH_CLOSE}"),
        "faq": [
            ("What counts as a concurrent role?", "Any seat we are actively sourcing for. Recruiting Partner Plus runs up to three at once; when one fills, the next opens. More than three open most months is " + PRO_LINK + " territory."),
            (PER_HIRE_Q, PER_HIRE_A),
            ("What does the onsite hour cover?", "One scheduled hour a week with your hiring managers: debriefs, decisions, offer strategy and whatever has stalled over email. It is the same hour every week so it actually happens."),
        ],
    },
    {
        "route": "recruiting-partner-pro",
        "key": "pro",
        "name": "Recruiting Partner Pro",
        "price": money(PRO),
        "value": PRO,
        "title": f"Recruiting Partner Pro, {money(PRO)} a Month | Metcalf Search",
        "description": f"Recruiting Partner Pro: a dedicated recruiter onsite three days a week, every open role, no cap, for a flat {money(PRO)} a month. No per-hire fees. Activate here.",
        "eyebrow": f"RECRUITING PARTNER PRO &middot; {money(PRO)} A MONTH",
        "h1": 'A dedicated recruiter, onsite <span class="accent">three</span> days a week.',
        "sub": "Every open role, no cap, run by a Metcalf Search recruiter embedded with your team three full days a week. The output of a full-time recruiting hire, on a month-to-month subscription.",
        "capsule": f"<strong>Recruiting Partner Pro</strong> is full embedded recruiting: a dedicated Metcalf Search recruiter onsite three days a week, every open role in the company, for a flat {money(PRO)} a month. No per-hire fees. Month to month.",
        "who": "Companies hiring constantly: a plant adding a shift, a branch opening, growth that needs ten or twenty hires this year and a recruiting function that does not exist yet. The alternative is hiring a recruiter, with the salary, tools, ramp and management that come with it.",
        "buys": [
            ("A dedicated recruiter onsite three full days a week.", "Embedded with your managers, on a set schedule, running every open role."),
            ("No cap on roles.", "Whatever is open gets worked."),
            ("The full STACK Method on every search.", "A sourcing plan, a tempo commitment, a structured assessment, an offer sequence and a ninety-day keep plan, per role."),
            ("Ad spend for every open role, included.", "Each job runs where candidates actually look, on our budget, not yours."),
            ("MS Rosie, the full desk, for the whole company.", "Careers page, applicant tracking and hiring numbers you can put in front of the owner."),
            ("A recruiting function your company keeps.", "The process, the scorecards and the pipeline live in your Rosie desk, not in our heads."),
            ("A senior recruiter is your single point of contact.", "The embedded recruiter runs the days. Your senior recruiter runs the plan, backed by the Metcalf Search team."),
        ],
        "timeline": [
            STEP_TODAY,
            ("Within 48 hours", "Kickoff. A ninety-minute intake across every open role, and the onsite schedule set. Sourcing starts the same day."),
            ("Five business days", "The first slates of vetted candidates are in front of you."),
            ("Week two", "First interviews across the open roles. We schedule them, prep both sides and debrief after each one."),
            STEP_FILL,
        ],
        "result": "Every open seat has a recruiter on it. Managers get a person, not a ticket. The function is still there when the hiring wave passes.",
        "math": (f"Twelve months of Recruiting Partner Pro is <strong>{money(12 * PRO)}</strong>. Ten {CONTINGENCY} <strong>{money(10 * PER_HIRE)}</strong>. "
                 f"Twenty cost <strong>{money(20 * PER_HIRE)}</strong>. A full-time in-house recruiter costs salary, payroll taxes, tools and job boards, plus the ninety days before they know your company. Pro starts within 48 hours and leaves when you say so. {MATH_CLOSE}"),
        "faq": [
            ("Who is onsite?", "A Metcalf Search recruiter dedicated to your company, three full days a week, on a set schedule. A senior recruiter is your single point of contact and runs the plan, backed by the Metcalf Search team."),
            (PER_HIRE_Q, PER_HIRE_A),
            ("What if hiring slows down?", "Move down to " + PLUS_LINK + " or " + PARTNER_LINK + " at any monthly cycle. Your rate is grandfathered, and the careers page, pipeline and process stay in your Rosie desk."),
        ],
    },
]


def eyebrow(text):
    """Keep each side of the middle dot on one line."""
    return " &middot; ".join(f'<span class="eyebrow-part">{part}</span>' for part in text.split(" &middot; "))


def plain(html):
    """Visible text of a copy fragment (tags dropped, entities left alone)."""
    return re.sub(r"<[^>]+>", "", html)


def ld(obj):
    return '<script type="application/ld+json">' + json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "</script>"


def page(t):
    url = f"{ORIGIN}/{t['route']}"
    title, desc = t["title"], t["description"]
    assert len(title) <= 62 and 70 <= len(desc) <= 165, t["route"]
    service = {
        "@context": "https://schema.org",
        "@type": "Service",
        "name": t["name"],
        "serviceType": "Fractional Recruiting",
        "url": url,
        "description": plain(t["sub"]),
        "provider": {"@type": "Organization", "name": "Metcalf Search", "url": ORIGIN},
        "areaServed": "United States",
        "offers": {
            "@type": "Offer",
            "url": url,
            "priceSpecification": {
                "@type": "PriceSpecification",
                "priceCurrency": "USD",
                "description": "Flat monthly subscription. No per-hire fees. Current tier pricing is shown on this page.",
            },
        },
    }
    faq_ld = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": plain(a)}}
            for q, a in t["faq"]
        ],
    }
    buys = "\n".join(f"<li><strong>{lead}</strong> {rest}</li>" for lead, rest in t["buys"])
    steps = "\n".join(f'<li><span class="timeline-when">{when}</span><p>{what}</p></li>' for when, what in t["timeline"])
    faqs = "\n".join(
        '<details class="faq-item">\n'
        f"<summary>{q}</summary>\n"
        f'<div class="faq-answer">{a}</div>\n'
        "</details>"
        for q, a in t["faq"]
    )
    head = f"""{HEAD_TOP}
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{url}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:type" content="website">
<meta property="og:url" content="{url}">
<meta property="og:site_name" content="Metcalf Search">
<meta property="og:image" content="https://metcalfsearch.com/og-default.png">
<meta property="og:locale" content="en_US">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{title}">
<meta name="twitter:description" content="{desc}">
<meta name="twitter:image" content="https://metcalfsearch.com/og-default.png">
{FONTS}
{LOCAL_BUSINESS}
{ld(service)}
{ld(faq_ld)}
{GA}
{BASE_STYLE}
{FAVICONS}

{HAMBURGER_CSS}
{FAQ_CSS}
{TIER_CSS}
{STRIP_CSS}
</head>"""
    body = f"""<body>
{NAV}

<section class="page-hero">
<div class="eyebrow">{eyebrow(t['eyebrow'])}</div>
<h1>{t['h1']}</h1>
<p class="sub">{t['sub']}</p>
<div class="hero-cta">
<a href="#checkout" class="btn-solid">Activate {t['name']}</a>
<a href="/contact" class="btn-textlink">{FIT_CALL}</a>
</div>
{HERO_STRIP_DIV}
</section>

<div class="capsule">{t['capsule']}</div>

<section class="checkout" id="checkout" data-tier="{t['key']}" data-item="{t['name']}" data-price="{t['value']}" aria-labelledby="checkout-heading">
<div class="checkout-card">
<div class="section-head">
<div class="section-eyebrow">ACTIVATE</div>
<h2 class="section-h2" id="checkout-heading">Hand us the hiring. Go run your <span class="accent">business</span>.</h2>
<p class="section-sub">Your tier. Your checkout. Right here.</p>
<p class="price-line"><strong>{t['price']} a month.</strong> Month to month. <span class="nowrap">No per-hire fees.</span> <span class="price-terms">Move up or down a tier at any monthly cycle.</span></p>
</div>
<form class="checkout-form" id="checkout-form" novalidate hidden>
<label class="checkout-label" for="checkout-email">Email</label>
<input class="checkout-input" id="checkout-email" name="email" type="email" autocomplete="email" inputmode="email" spellcheck="false" required>
<div id="stripe-checkout" class="checkout-mount"></div>
<button type="submit" class="btn-solid checkout-submit" id="checkout-submit" data-label="Activate {t['name']}">Activate {t['name']}, {t['price']} a month</button>
<p class="checkout-error" id="checkout-error" role="alert" hidden></p>
<p class="checkout-terms">Month to month. Cancel with thirty days notice.</p>
</form>
<p class="checkout-fallback" id="checkout-fallback">If the checkout does not load, email <a href="mailto:info@metcalfsearch.com">info@metcalfsearch.com</a> or call <a href="tel:+16144346646">614.434.6646</a> and we will activate it by hand.</p>
<p class="checkout-alt">Questions first? <a href="/contact">Book the thirty-minute fit call</a>.</p>
</div>
</section>

<article class="prose">
<h2>Who this is <span class="accent">for</span>.</h2>
<p>{t['who']}</p>

<h2>What a month <span class="accent">buys</span>.</h2>
<ul class="buys">
{buys}
</ul>

<h2>What happens after you <span class="accent">click</span>.</h2>
<ol class="timeline">
{steps}
</ol>

<h2>The <span class="accent">result</span>.</h2>
<p class="result-line">{t['result']}</p>
<aside class="mathbox" aria-labelledby="math-heading">
<h3 id="math-heading">The <span class="accent">math</span>.</h3>
<p>{t['math']}</p>
</aside>
</article>

<section class="cta-band" aria-labelledby="cta-band-heading">
<h2 class="section-h2" id="cta-band-heading">Ready when you <span class="accent">are</span>.</h2>
<a href="#checkout" class="btn-solid">Activate {t['name']}</a>
<p class="cta-band-note">Kickoff within 48 hours. First slate within five business days.</p>
</section>

<section class="faq-section" aria-labelledby="faq-heading">
<h2 id="faq-heading">Three <span class="accent">questions</span>.</h2>
<div class="faq-list">
{faqs}
</div>
<details class="terms-fold">
<summary>Billing terms.</summary>
<p class="terms-body">{billing(t['name'], t['price'])}</p>
</details>
</section>

{FOOTER}

{NAV_SCRIPT}
{CHECKOUT_SCRIPT}

{HAMBURGER_SCRIPT}
{STRIP_SCRIPTS}
</body>
</html>
"""
    return head + "\n" + body


SNIPPET = f"""<!--
  Client logo strip, ready to paste into index.html (the same strip the tier
  pages carry). Three pieces:
  1. The style block goes in the head. On index.html, paste it just before
     the single "</style>" + newline + "</head>" at the end of the head.
  2. The placeholder div goes where the strip should sit. On index.html,
     paste it just before <section class="op" id="what"> (right after the hero).
  3. The two script tags go just before </body>.
  The logo list is /assets/clients/clients.js. The strip shows data-show logos
  (default 7) in random order and stays hidden if fewer than three load.
  Every class the script injects has a rule in the style block, so the QA
  gate's class check stays clean.
-->
{STRIP_CSS}

{STRIP_DIV}

{STRIP_SCRIPTS}
"""

if __name__ == "__main__":
    for t in TIERS:
        out = ROOT / f"{t['route']}.html"
        out.write_text(page(t), encoding="utf-8")
        print("wrote", out, out.stat().st_size, "bytes")
    snip = ROOT / "docs" / "snippets" / "client-strip.html"
    snip.parent.mkdir(parents=True, exist_ok=True)
    snip.write_text(SNIPPET, encoding="utf-8")
    print("wrote", snip, snip.stat().st_size, "bytes")
