/**
 * IE Mode Extension — popup.js
 *
 * Flow:
 *
 *   [DOMContentLoaded]
 *         │
 *         ▼
 *   Platform check
 *   (Windows only)
 *         │
 *         ▼
 *   Get active tab URL
 *   (chrome.tabs.query)
 *         │
 *         ▼
 *   Restricted URL?  ──yes──▶  show error
 *         │no
 *         ▼
 *   isEdgeBrowser()?
 *    │yes          │no (Chrome)
 *    ▼             ▼
 *  Edge path    Chrome path
 *  (open IE    (trigger Edge
 *  mode tab,   protocol, close
 *  close orig)  current tab)
 */

'use strict';

// Schemes that cannot be opened in IE mode
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

// IE Tab reference extension — used in "Install Edge" CTA download link
const EDGE_DOWNLOAD_URL = 'https://www.microsoft.com/en-us/edge';

// ── Detection helpers ────────────────────────────────────────────────────────

function isEdgeBrowser() {
  return navigator.userAgent.includes('Edg/');
}

function isWindowsPlatform() {
  // userAgentData is available in Chrome/Edge 90+; fall back to platform string
  if (navigator.userAgentData && navigator.userAgentData.platform) {
    return navigator.userAgentData.platform === 'Windows';
  }
  return navigator.platform.startsWith('Win');
}

function isRestrictedUrl(url) {
  return RESTRICTED_SCHEMES.some((scheme) => url.startsWith(scheme));
}

// ── UI state helpers ─────────────────────────────────────────────────────────

function showLoading() {
  setActiveState('state-loading');
}

function showSuccess(detail = '') {
  setActiveState('state-success');
  document.getElementById('success-detail').textContent = detail;
}

function showError(title, detail = '') {
  setActiveState('state-error');
  document.getElementById('error-title').textContent = title;
  document.getElementById('error-detail').textContent = detail;
}

function showNoEdge() {
  // Hide all regular states
  ['state-loading', 'state-success', 'state-error'].forEach((id) => {
    document.getElementById(id).classList.remove('active');
  });
  const el = document.getElementById('state-no-edge');
  el.classList.add('active');
  document.getElementById('install-edge-btn').href = EDGE_DOWNLOAD_URL;
}

function setActiveState(activeId) {
  ['state-loading', 'state-success', 'state-error'].forEach((id) => {
    const el = document.getElementById(id);
    if (id === activeId) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });
  // Also hide no-edge panel
  document.getElementById('state-no-edge').classList.remove('active');
}

// ── IE mode trigger ──────────────────────────────────────────────────────────

/**
 * Build the microsoft-edge: protocol URL that opens the given URL in IE mode.
 * NOTE: Test this URL manually in the Edge address bar before relying on it:
 *   microsoft-edge:?launchurl=https://example.com&launchMode=ieMode
 */
function buildIeModeUrl(pageUrl) {
  return `microsoft-edge:?launchurl=${encodeURIComponent(pageUrl)}&launchMode=ieMode`;
}

/**
 * Trigger navigation to a custom protocol URL by clicking a hidden anchor.
 * This is the safest cross-context way to invoke OS protocol handlers from
 * an extension popup without running into MV3 service worker restrictions.
 */
function triggerProtocolUrl(url) {
  const a = document.createElement('a');
  a.href = url;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Edge path:
 *   1. Open a new tab with the IE mode URL (new Edge window with Trident rendering)
 *   2. Close the original normal-mode tab so the user isn't left with a duplicate
 *
 * Why open new + close old rather than navigate in place:
 *   chrome.tabs.update() with a custom protocol URL (microsoft-edge:) is blocked
 *   by the browser's navigation security policy. The anchor-click approach triggers
 *   the OS protocol handler, which opens a new Edge window/tab with IE mode active.
 */
async function openIeModeEdge(currentTab) {
  const ieModeUrl = buildIeModeUrl(currentTab.url);

  // Trigger the protocol — opens new Edge IE mode window
  triggerProtocolUrl(ieModeUrl);

  // Close the original tab after a short delay to let the new window open first
  await new Promise((resolve) => setTimeout(resolve, 400));
  try {
    await chrome.tabs.remove(currentTab.id);
  } catch {
    // Tab may have already been closed or navigated away — not fatal
  }
}

/**
 * Chrome path:
 *   Trigger the microsoft-edge: protocol handler to open the URL in Edge IE mode.
 *   If Edge is not installed, the protocol call will silently fail — we detect
 *   this via a timeout: if no page-unload / window-blur happens within 1.5s,
 *   Edge is likely not installed.
 *
 *   The detection is best-effort. A cleaner solution requires native messaging,
 *   which is deferred to V2. For now, we show a "maybe not installed" message
 *   after the timeout if the window is still open.
 */
async function openIeModeChromeViaEdge(currentTab) {
  const ieModeUrl = buildIeModeUrl(currentTab.url);

  let edgeLaunched = false;

  // If the protocol handler fires successfully, the OS will switch focus to Edge.
  // We can't detect this reliably from the extension, so we use window blur as a proxy.
  window.addEventListener('blur', () => {
    edgeLaunched = true;
  }, { once: true });

  triggerProtocolUrl(ieModeUrl);

  // Wait to see if focus leaves the popup (Edge opened)
  await new Promise((resolve) => setTimeout(resolve, 1500));

  if (!edgeLaunched) {
    showNoEdge();
    return false;
  }

  return true;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  showLoading();

  try {
    // Guard: IE mode is Windows-only
    if (!isWindowsPlatform()) {
      showError(
        'Windows required',
        'IE mode is only available on Windows.'
      );
      return;
    }

    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.url) {
      showError('Cannot read this page', 'Try refreshing and clicking again.');
      return;
    }

    // Guard: restricted URLs (chrome://, edge://, about:, etc.)
    if (isRestrictedUrl(tab.url)) {
      showError(
        'IE mode unavailable here',
        'This page type cannot be opened in IE mode.'
      );
      return;
    }

    if (isEdgeBrowser()) {
      // ── Edge path ──────────────────────────────────────────────────────────
      await openIeModeEdge(tab);
      showSuccess();
      setTimeout(() => window.close(), 800);
    } else {
      // ── Chrome path ────────────────────────────────────────────────────────
      const launched = await openIeModeChromeViaEdge(tab);
      if (launched) {
        showSuccess('Check that Edge opened with the page.');
        setTimeout(() => window.close(), 1400);
      }
      // If not launched, showNoEdge() was already called inside openIeModeChromeViaEdge
    }
  } catch (err) {
    showError('Something went wrong', 'Please try again.');
    console.error('[IE Mode Extension]', err);
  }
}

document.addEventListener('DOMContentLoaded', main);
