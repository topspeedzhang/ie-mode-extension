'use strict';

/**
 * Background service worker
 *
 * NOTE: The native messaging call was moved to popup.js (direct
 * sendNativeMessage) to avoid "Could not establish connection" errors
 * caused by the MV3 service worker being terminated while the popup
 * is open. This file is kept for any future background tasks but is
 * not currently used in the main flow.
 */

const NATIVE_HOST = 'com.iemode.host';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action !== 'openInIE') return;

  chrome.runtime.sendNativeMessage(
    NATIVE_HOST,
    { url: message.url },
    (response) => {
      if (chrome.runtime.lastError) {
        sendResponse({
          success: false,
          error: chrome.runtime.lastError.message,
        });
        return;
      }

      if (response && response.status === 'ok') {
        sendResponse({ success: true });
      } else {
        sendResponse({
          success: false,
          error: response?.message || 'Native host returned an error.',
        });
      }
    }
  );

  // Return true to keep the message channel open for the async callback
  return true;
});
