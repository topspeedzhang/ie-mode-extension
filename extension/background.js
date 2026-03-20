'use strict';

/**
 * Background service worker — native messaging relay
 *
 *   popup.js  --[sendMessage]--> background.js
 *                                     |
 *                         sendNativeMessage("com.iemode.host")
 *                                     |
 *                               IEModeHost.exe
 *                               (Mode A: reads URL,
 *                                spawns viewer process,
 *                                sends {"status":"ok"},
 *                                exits)
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
