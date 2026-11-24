// ==UserScript==
// @name         WhatsApp Web – Block accidental deletion
// @namespace    whatsapp-web-userscripts
// @version      1.0
// @description  Disables "Delete chat", "Clear chat" and "Delete for me" on chats and single messages (plus the delete-chat shortcut) on WhatsApp Web, showing a notice when blocked
// @author       Pierpaolo Tommasi
// @license      MIT
// @homepageURL  https://github.com/ptommasi/whatsapp-web-userscripts
// @supportURL   https://github.com/ptommasi/whatsapp-web-userscripts/issues
// @match        https://web.whatsapp.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // Exact menu labels to block (English + Italian UI)
  const LABELS = [
    'delete chat', 'elimina chat',
    'clear chat', 'svuota chat',
    'delete for me', 'elimina per me',
  ];
  const SEL = 'li, button, [role="menuitem"], [role="button"]';
  const MESSAGE = 'Blocked by a userscript to prevent accidental deletion';

  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();

  // --- Notice -------------------------------------------------------------
  let toast, hideTimer, lastShown = 0;
  const notify = () => {
    const now = Date.now();
    if (now - lastShown < 800) return; // one notice per click, not per event
    lastShown = now;
    if (!toast) {
      toast = document.createElement('div');
      toast.textContent = MESSAGE;
      Object.assign(toast.style, {
        position: 'fixed', bottom: '32px', left: '50%', transform: 'translateX(-50%)',
        background: '#323232', color: '#fff', padding: '12px 20px', borderRadius: '8px',
        font: '14px/1.4 system-ui, sans-serif', boxShadow: '0 4px 12px rgba(0,0,0,.3)',
        zIndex: 2147483647, pointerEvents: 'none', transition: 'opacity .2s', opacity: '0',
      });
      document.body.appendChild(toast);
    }
    toast.style.opacity = '1';
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => { toast.style.opacity = '0'; }, 2500);
  };

  // --- Detection ----------------------------------------------------------
  // True if the element's visible text or screen-reader label is a blocked entry
  const isBlocked = (node) =>
    LABELS.includes(norm(node.getAttribute('aria-label'))) ||
    LABELS.includes(norm(node.textContent));

  // Return the menu item element if `el` is (inside) a blocked entry
  const findBlockedItem = (el) => {
    if (!(el instanceof Element)) return null;
    let node = el.closest(SEL);
    while (node) {
      if (isBlocked(node)) return node;
      node = node.parentElement && node.parentElement.closest(SEL);
    }
    return null;
  };

  // 1) Block clicks / taps / Enter on the items (capture phase, before WhatsApp sees them)
  const block = (e) => {
    const isKey = e.type === 'keydown';
    if (isKey && e.key !== 'Enter' && e.key !== ' ') return;
    const target = isKey ? document.activeElement : e.target;
    if (findBlockedItem(target)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      notify();
    }
  };
  ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'keydown']
    .forEach((t) => window.addEventListener(t, block, true));

  // 2) Block the delete-chat shortcut (Ctrl+Alt+Backspace on Win/Linux, Cmd+Ctrl+Backspace on Mac)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && ((e.ctrlKey && e.altKey) || (e.metaKey && e.ctrlKey))) {
      e.preventDefault();
      e.stopImmediatePropagation();
      notify();
    }
  }, true);

  // 3) Visually grey out the items whenever a menu opens. Re-checked on every pass:
  // WhatsApp may reuse an element for a different label, which must then look normal again.
  let scheduled = false;
  const mark = () => {
    scheduled = false;
    document.querySelectorAll(SEL).forEach((item) => {
      if (isBlocked(item)) {
        if (item.dataset.noDelete) return;
        item.dataset.noDelete = '1';
        item.style.opacity = '0.35';
        item.style.cursor = 'not-allowed';
        item.style.filter = 'grayscale(1)';
      } else if (item.dataset.noDelete) {
        delete item.dataset.noDelete;
        item.style.removeProperty('opacity');
        item.style.removeProperty('cursor');
        item.style.removeProperty('filter');
      }
    });
  };
  const start = () => {
    new MutationObserver(() => {
      if (!scheduled) { scheduled = true; requestAnimationFrame(mark); }
    }).observe(document.body, { childList: true, characterData: true, subtree: true });
  };
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);
})();
