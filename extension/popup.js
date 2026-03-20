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
 *   Send message to background service worker
 *   {action: "openInIE", url}
 *         │
 *   ┌─────┴──────────────────────────────────┐
 *   │                                        │
 * success                                 error
 *   │                                        │
 *   ▼                               ┌────────┴────────┐
 * show success                 "not found"        other error
 * + auto-close             (host not installed)  show message
 *                               show install guide
 */

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

  // Send to background → native host
  chrome.runtime.sendMessage({ action: 'openInIE', url: tab.url }, (response) => {
    if (chrome.runtime.lastError) {
      handleNativeError(chrome.runtime.lastError.message);
      return;
    }

    if (response?.success) {
      setState('success');
      setTimeout(() => window.close(), 900);
    } else {
      handleNativeError(response?.error || 'Unknown error');
    }
  });
}

function handleNativeError(errorMsg) {
  // Chrome reports this specific message when the host is not registered
  if (
    errorMsg.includes('not found') ||
    errorMsg.includes('Specified native messaging host') ||
    errorMsg.includes('Cannot find native messaging host')
  ) {
    setState('no-host');
  } else {
    setState('error', {
      title: 'Native host error',
      detail: errorMsg,
    });
  }
}

document.addEventListener('DOMContentLoaded', main);
