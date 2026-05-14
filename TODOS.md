# TODOS

## ~~P1 — Store listing assets~~ (cancelled — project open-sourced on GitHub instead)

~~Create required promotional images, screenshots, and icon assets for Chrome Web Store and Edge Add-ons store submissions.~~

## Completed

### Mac/Linux platform detection

**What:** Detect non-Windows platforms at runtime and show "IE mode is only available on Windows" instead of a confusing error.
**Completed:** v1.0.0 — `isWindowsPlatform()` implemented in popup.js; `no-windows` state with dedicated UI now activates correctly.

### Parameterized installer

**What:** Accept `-ExtensionId` command-line parameter in `install.ps1` for silent/automated installs.
**Completed:** v1.0.0 — `param([string]$ExtensionId = "")` added; skips interactive prompt when ID is supplied.

### Extension ID display in popup

**What:** Show the current extension ID in the "no-host" error state so users can copy it without hunting through `chrome://extensions`.
**Completed:** v1.0.0 — `#ext-id-field` auto-populated from `chrome.runtime.id`; one-click Copy button with visual confirmation.

### Pre-compiled IEModeHost.exe

**What:** Ship a ready-to-run `IEModeHost.exe` so users never need Visual Studio or .NET SDK.
**Completed:** v1.0.0 — Release binary committed at `native/IEModeHost/bin/Release/IEModeHost.exe`.

### Timeout guard in popup

**What:** Auto-fail with "Request timed out" if the native host doesn't respond within 10 seconds, preventing the popup from spinning indefinitely.
**Completed:** v1.0.0 — `setTimeout` 10 000 ms guard implemented in popup.js.
