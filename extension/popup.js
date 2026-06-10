'use strict';

/**
 * IE Mode Extension — popup.js
 *
 * Flow:
 *
 *   [DOMContentLoaded]
 *         │
 *         ▼
 *   Windows platform?  ──no──▶ show error (IE Trident is Windows-only)
 *         │yes
 *         ▼
 *   Restricted URL?  ──yes──▶ show error
 *         │no
 *         ▼
 *   sendNativeMessage("com.iemode.host", {url})   ← direct, no background relay
 *         │
 *   ┌─────┴──────────────────────────────────┐
 *   │                                        │
 * {status:"ok"}                           error
 *   │                                        │
 *   ▼                               ┌────────┴────────┐
 * show success                 "not found"        other error
 * + auto-close             (host not installed)  show message
 *                               show install guide
 *
 * Note: popup.js calls sendNativeMessage directly instead of relaying through
 * the background service worker. In MV3, the service worker can be terminated
 * while the popup is open, causing "Could not establish connection" errors.
 * Extension pages (popup) can call sendNativeMessage directly, so the relay
 * is unnecessary.
 */

// Substrings in Chrome's error message when the native host isn't registered.
// These originate from Chrome internals and may vary by version/platform.
const HOST_NOT_FOUND_PATTERNS = [
  'not found',
  'Specified native messaging host',
  'Cannot find native messaging host',
];

const RESTRICTED_SCHEMES = [
  'chrome://',
  'chrome-extension://',
  'edge://',
  'extension://',
  'moz-extension://',
  'about:',
  'data:',
  'javascript:',
];

// ── Platform detection ────────────────────────────────────────────────────────

function isWindowsPlatform() {
  if (navigator.userAgentData?.platform) {
    return navigator.userAgentData.platform === 'Windows';
  }
  return navigator.platform.startsWith('Win');
}

function isRestrictedUrl(url) {
  return RESTRICTED_SCHEMES.some((scheme) => url.startsWith(scheme));
}

// ── UI states ─────────────────────────────────────────────────────────────────

const ALL_STATES = ['loading', 'success', 'error', 'no-host', 'no-windows'];

function setState(active, opts = {}) {
  ALL_STATES.forEach((s) => {
    document.getElementById(`state-${s}`).classList.toggle('active', s === active);
  });

  if (active === 'error') {
    document.getElementById('error-title').textContent = opts.title || 'Something went wrong';
    document.getElementById('error-detail').textContent = opts.detail || '';
  }

  if (active === 'no-host') {
    document.getElementById('ext-id-field').value = chrome.runtime.id;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  setState('loading');

  // Guard: IE rendering (Trident) is Windows-only
  if (!isWindowsPlatform()) {
    setState('no-windows');
    return;
  }

  // Get the active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.url) {
    setState('error', {
      title: 'Cannot read this page',
      detail: 'Try refreshing and clicking again.',
    });
    return;
  }

  // Guard: restricted URLs
  if (isRestrictedUrl(tab.url)) {
    setState('error', {
      title: 'IE mode unavailable here',
      detail: 'This page type cannot be opened in IE mode.',
    });
    return;
  }

  // Call the native host directly from the popup.
  // Guard against the native host never responding (e.g. crash or cold-start
  // timeout). Without this the popup spins indefinitely.
  let responded = false;
  const timeoutId = setTimeout(() => {
    if (!responded) {
      setState('error', {
        title: 'Request timed out',
        detail: 'The native host did not respond. Try again.',
      });
    }
  }, 10000);

  chrome.runtime.sendNativeMessage('com.iemode.host', { url: tab.url }, (response) => {
    clearTimeout(timeoutId);
    responded = true;

    if (chrome.runtime.lastError) {
      handleNativeError(chrome.runtime.lastError.message);
      return;
    }

    if (response?.status === 'ok') {
      setState('success');
      setTimeout(() => window.close(), 900);
    } else {
      handleNativeError(response?.message || 'Unknown error');
    }
  });
}

function handleNativeError(errorMsg) {
  if (HOST_NOT_FOUND_PATTERNS.some((p) => errorMsg.includes(p))) {
    setState('no-host');
  } else {
    setState('error', {
      title: 'Native host error',
      detail: errorMsg,
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  main();

  document.getElementById('copy-id-btn').addEventListener('click', () => {
    navigator.clipboard.writeText(chrome.runtime.id).then(() => {
      const btn = document.getElementById('copy-id-btn');
      btn.textContent = 'Copied!';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = 'Copy';
        btn.classList.remove('copied');
      }, 2000);
    });
  });
});
