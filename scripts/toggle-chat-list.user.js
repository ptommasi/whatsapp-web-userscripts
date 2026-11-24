// ==UserScript==
// @name         WhatsApp Web – Toggle chat list
// @namespace    whatsapp-web-userscripts
// @version      1.0
// @description  Hide/show the WhatsApp Web chat list with a button
// @author       Pierpaolo Tommasi
// @license      MIT
// @homepageURL  https://github.com/ptommasi/whatsapp-web-userscripts
// @supportURL   https://github.com/ptommasi/whatsapp-web-userscripts/issues
// @match        https://web.whatsapp.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(() => {
  'use strict';

  // Chat list starts visible; only the button collapses it.
  let collapsed = false;
  let pane = null;

  const shouldHide = () => collapsed;

  // WhatsApp leaves an empty wrapper (a blank <span>) inside the drawer when nothing is open.
  const isEmptyDrawer = el =>
    el.innerText.trim() === '' &&
    !el.querySelector('img, svg, input, textarea, button, canvas, video, [role], [contenteditable]');

  // Find the left column: start at #side and climb through wrappers that are the same width.
  // Avoids relying on WhatsApp's obfuscated class names, which change often.
  function getPane() {
    if (pane && pane.isConnected) return pane;
    let el = document.getElementById('side');
    if (!el || el.getBoundingClientRect().width === 0) return null;
    while (
      el.parentElement && el.parentElement !== document.body &&
      el.parentElement.getBoundingClientRect().width - el.getBoundingClientRect().width < 2
    ) el = el.parentElement;
    return (pane = el);
  }

  // The empty left drawer (used for Settings, New chat, etc.) leaves a border line behind.
  // Hide it while empty; let it show again if WhatsApp puts a panel in it.
  function hideDividers() {
    document.querySelectorAll('[data-testid="drawer-left"]').forEach(el => {
      if (isEmptyDrawer(el)) {
        el.style.setProperty('display', 'none', 'important');
        el.dataset.waDivider = '1';
      } else if (el.dataset.waDivider) {
        el.style.removeProperty('display');
        delete el.dataset.waDivider;
      }
    });
  }

  function showDividers() {
    document.querySelectorAll('[data-wa-divider]').forEach(el => {
      el.style.removeProperty('display');
      delete el.dataset.waDivider;
    });
  }

  function hide(p) {
    const parent = p.parentElement;
    if (!p.dataset.waHidden) {
      p.style.setProperty('display', 'none', 'important');
      p.dataset.waHidden = '1';
    }
    // WhatsApp sets a min-width (~748px) on the layout container, so the chat pane
    // overflows and gets cut off in narrow windows. Let it shrink to the window.
    if (parent && !parent.dataset.waMinW) {
      parent.dataset.waMinW = '1';
      parent.style.setProperty('min-width', '0', 'important');
      parent.style.setProperty('width', '100%', 'important');
    }
    hideDividers(); // re-run each time: WhatsApp may re-render or fill the drawer
  }

  function show(p) {
    const parent = p.parentElement;
    if (p.dataset.waHidden) {
      p.style.removeProperty('display');
      delete p.dataset.waHidden;
    }
    if (parent && parent.dataset.waMinW) {
      parent.style.removeProperty('min-width');
      parent.style.removeProperty('width');
      delete parent.dataset.waMinW;
    }
    showDividers();
  }

  // ---- Toggle button at the bottom of the left icon rail's top group, after a divider ----
  // Sidebar icon; the chevron points left (hide) or right (show).
  const icon = dir => `
    <div style="display:flex;align-items:center;justify-content:center;width:100%;height:24px">
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor"
           stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="4" width="18" height="16" rx="3"/>
        <line x1="9" y1="4" x2="9" y2="20"/>
        <polyline points="${dir === 'left' ? '15.5 10 13.5 12 15.5 14' : '13.5 10 15.5 12 13.5 14'}"/>
      </svg>
    </div>`;

  // Clone WhatsApp's own divider and last rail item so the button gets native size and hover style.
  // Cloned nodes carry no React handlers, so clicking ours never triggers the original item.
  function mountButton() {
    let item = document.getElementById('wa-toggle-item');
    if (item && item.isConnected) return item;
    const group = document.querySelector('[data-testid="navbar-primary-section"]')?.firstElementChild;
    if (!group) return null;
    const items = [...group.children].filter(c => c.querySelector('button'));
    const template = items[items.length - 1];
    const hr = group.querySelector(':scope > hr');
    if (!template) return null;

    document.getElementById('wa-toggle-hr')?.remove(); // drop a leftover divider from a previous mount
    if (hr) {
      const hr2 = hr.cloneNode(true);
      hr2.id = 'wa-toggle-hr';
      group.appendChild(hr2);
    }
    item = template.cloneNode(true);
    item.id = 'wa-toggle-item';
    item.querySelectorAll('[role="status"]').forEach(x => x.remove()); // drop any unread badge
    const b = item.querySelector('button');
    [...b.attributes].forEach(a => { if (a.name !== 'class') b.removeAttribute(a.name); });
    b.type = 'button';
    b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); toggle(); });
    group.appendChild(item);
    return item;
  }

  function updateButton() {
    const item = mountButton();
    if (!item) return;
    const b = item.querySelector('button');
    const state = shouldHide() ? 'collapsed' : 'open';
    if (b.dataset.state === state) return; // avoid DOM writes that would retrigger the observer
    b.dataset.state = state;
    b.innerHTML = icon(shouldHide() ? 'right' : 'left');
    const label = (shouldHide() ? 'Show' : 'Hide') + ' chat list';
    b.title = label;
    b.setAttribute('aria-label', label);
  }

  function apply() {
    updateButton();
    const p = getPane();
    if (!p) return;
    shouldHide() ? hide(p) : show(p);
  }

  function toggle() {
    collapsed = !collapsed;
    apply();
  }

  // WhatsApp loads asynchronously and re-renders often: re-apply when the DOM changes
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; apply(); });
  }).observe(document.body, { childList: true, subtree: true });

  apply();
})();
