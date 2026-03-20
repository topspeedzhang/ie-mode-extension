using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Windows.Forms;
using Microsoft.Win32;

/*
 * IEModeHost.exe — dual-mode executable
 *
 * MODE A  (launched by Chrome/Edge as native messaging host, no args):
 *
 *   Chrome/Edge  ──stdin──>  read 4-byte length + JSON  ──>  parse URL
 *                            spawn self in Mode B with URL arg
 *                 <──stdout── write {"status":"ok"} with 4-byte prefix
 *                            exit
 *
 * MODE B  (launched with "--viewer <url>" args, shows IE window):
 *
 *   Set FEATURE_BROWSER_EMULATION (IE11 mode) in registry
 *   Create WinForms window with System.Windows.Forms.WebBrowser
 *   Navigate to URL using Trident rendering engine
 *   User closes window → process exits
 *
 * Note: WinExe output type suppresses the console window flash.
 *       stdin/stdout streams still work in WinExe mode.
 */

namespace IEModeHost
{
    static class Program
    {
        [STAThread]
        static void Main(string[] args)
        {
            if (args.Length >= 2 && args[0] == "--viewer")
            {
                RunViewerMode(args[1]);
            }
            else
            {
                RunHostMode();
            }
        }

        // ── MODE B: IE Viewer ─────────────────────────────────────────────────

        static void RunViewerMode(string encodedUrl)
        {
            // Decode the URL (Mode A URL-encodes to safely pass via command line)
            string url;
            try
            {
                url = Uri.UnescapeDataString(encodedUrl);
            }
            catch
            {
                url = encodedUrl;
            }

            // Set IE11 rendering mode BEFORE any WebBrowser control is created.
            // Without this, WebBrowser defaults to IE7 compatibility mode.
            SetBrowserEmulationMode();

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new ViewerForm(url));
        }

        static void SetBrowserEmulationMode()
        {
            // 11001 (0x2AF9) = IE11 edge mode — uses the highest available IE engine version
            const int IE11_EDGE_MODE = 11001;
            const string REG_PATH =
                @"SOFTWARE\Microsoft\Internet Explorer\Main\FeatureControl\FEATURE_BROWSER_EMULATION";

            try
            {
                string exeName = Path.GetFileName(Application.ExecutablePath);
                using (RegistryKey key = Registry.CurrentUser.CreateSubKey(REG_PATH))
                {
                    key?.SetValue(exeName, IE11_EDGE_MODE, RegistryValueKind.DWord);
                }
            }
            catch
            {
                // Non-fatal: WebBrowser will still work, just at IE7 compat level
            }
        }

        // ── MODE A: Native Messaging Host ─────────────────────────────────────

        static void RunHostMode()
        {
            Stream stdin  = Console.OpenStandardInput();
            Stream stdout = Console.OpenStandardOutput();

            try
            {
                // Read message: 4-byte LE length + UTF-8 JSON body
                string json = ReadNativeMessage(stdin);

                // Parse URL from {"url":"..."} — manual parse, no NuGet needed
                string url = ExtractUrlFromJson(json);

                if (string.IsNullOrEmpty(url))
                {
                    SendNativeMessage(stdout, @"{""status"":""error"",""message"":""No URL in message""}");
                    return;
                }

                // Launch self in viewer mode as a separate independent process.
                // The viewer runs its own message loop and stays alive after we exit.
                string exePath = Application.ExecutablePath;
                string encoded = Uri.EscapeDataString(url);

                var psi = new ProcessStartInfo
                {
                    FileName  = exePath,
                    Arguments = "--viewer " + encoded,
                    UseShellExecute = false,
                };
                Process.Start(psi);

                // Respond to the extension: launch succeeded
                SendNativeMessage(stdout, @"{""status"":""ok""}");
            }
            catch (Exception ex)
            {
                string safeMsg = ex.Message
                    .Replace("\\", "\\\\")
                    .Replace("\"", "\\\"")
                    .Replace("\r", "")
                    .Replace("\n", " ");
                SendNativeMessage(stdout, $@"{{""status"":""error"",""message"":""{safeMsg}""}}");
            }
        }

        static string ReadNativeMessage(Stream stream)
        {
            // Chrome native messaging wire format:
            //   4 bytes (little-endian uint32) = message length
            //   N bytes                        = UTF-8 JSON
            byte[] lenBuf = new byte[4];
            int read = 0;
            while (read < 4)
            {
                int n = stream.Read(lenBuf, read, 4 - read);
                if (n == 0) throw new EndOfStreamException("stdin closed before length header");
                read += n;
            }

            int length = BitConverter.ToInt32(lenBuf, 0);
            if (length <= 0 || length > 1024 * 1024)
                throw new InvalidDataException($"Invalid message length: {length}");

            byte[] body = new byte[length];
            read = 0;
            while (read < length)
            {
                int n = stream.Read(body, read, length - read);
                if (n == 0) throw new EndOfStreamException("stdin closed mid-message");
                read += n;
            }

            return Encoding.UTF8.GetString(body);
        }

        static void SendNativeMessage(Stream stream, string json)
        {
            byte[] body   = Encoding.UTF8.GetBytes(json);
            byte[] lenBuf = BitConverter.GetBytes(body.Length);
            stream.Write(lenBuf, 0, 4);
            stream.Write(body, 0, body.Length);
            stream.Flush();
        }

        // Parse "url" value from {"url":"<value>"} without a JSON library.
        // The chrome native message is always this exact shape.
        static string ExtractUrlFromJson(string json)
        {
            if (string.IsNullOrEmpty(json)) return null;

            int keyIdx = json.IndexOf("\"url\"", StringComparison.Ordinal);
            if (keyIdx < 0) return null;

            int colonIdx = json.IndexOf(':', keyIdx + 5);
            if (colonIdx < 0) return null;

            // Skip whitespace after colon
            int openQuote = colonIdx + 1;
            while (openQuote < json.Length && json[openQuote] != '"')
                openQuote++;

            if (openQuote >= json.Length) return null;

            // Find closing quote, honouring backslash escapes
            int closeQuote = openQuote + 1;
            while (closeQuote < json.Length)
            {
                if (json[closeQuote] == '\\') { closeQuote += 2; continue; }
                if (json[closeQuote] == '"')  break;
                closeQuote++;
            }

            if (closeQuote >= json.Length) return null;

            string raw = json.Substring(openQuote + 1, closeQuote - openQuote - 1);

            // Un-escape basic JSON sequences in the URL (\\, \", \/)
            return raw
                .Replace("\\/", "/")
                .Replace("\\\"", "\"")
                .Replace("\\\\", "\\");
        }
    }

    // ── Viewer form ───────────────────────────────────────────────────────────

    class ViewerForm : Form
    {
        private readonly WebBrowser _browser;

        public ViewerForm(string url)
        {
            // Window setup
            string host = TryGetHost(url);
            Text        = "IE Mode" + (host != null ? " — " + host : "");
            Width       = 1280;
            Height      = 800;
            StartPosition = FormStartPosition.CenterScreen;

            // Navigation bar
            var navPanel = new Panel { Dock = DockStyle.Top, Height = 36, Padding = new Padding(4) };

            var backBtn = new Button { Text = "◀", Width = 32, Dock = DockStyle.Left };
            var fwdBtn  = new Button { Text = "▶", Width = 32, Dock = DockStyle.Left };
            var urlBox  = new TextBox { Dock = DockStyle.Fill, Text = url };
            var goBtn   = new Button { Text = "Go", Width = 44, Dock = DockStyle.Right };

            navPanel.Controls.Add(urlBox);
            navPanel.Controls.Add(goBtn);
            navPanel.Controls.Add(fwdBtn);
            navPanel.Controls.Add(backBtn);

            // WebBrowser control — uses System.Windows.Forms.WebBrowser (Trident/MSHTML)
            _browser = new WebBrowser
            {
                Dock              = DockStyle.Fill,
                ScriptErrorsSuppressed = true,
                IsWebBrowserContextMenuEnabled = true,
                WebBrowserShortcutsEnabled = true,
            };

            Controls.Add(_browser);      // Add browser first (fills remaining space)
            Controls.Add(navPanel);      // Nav bar on top

            // Wire up navigation bar
            backBtn.Click += (s, e) => { if (_browser.CanGoBack)    _browser.GoBack(); };
            fwdBtn.Click  += (s, e) => { if (_browser.CanGoForward) _browser.GoForward(); };
            goBtn.Click   += (s, e) => NavigateTo(urlBox.Text.Trim());
            urlBox.KeyDown += (s, e) => { if (e.KeyCode == Keys.Return) NavigateTo(urlBox.Text.Trim()); };

            _browser.Navigated += (s, e) =>
            {
                urlBox.Text = _browser.Url?.ToString() ?? "";
                string h = TryGetHost(urlBox.Text);
                Text = "IE Mode" + (h != null ? " — " + h : "");
            };

            // Navigate to initial URL
            NavigateTo(url);
        }

        private void NavigateTo(string url)
        {
            if (string.IsNullOrWhiteSpace(url)) return;
            if (!url.StartsWith("http://", StringComparison.OrdinalIgnoreCase) &&
                !url.StartsWith("https://", StringComparison.OrdinalIgnoreCase) &&
                !url.StartsWith("file://", StringComparison.OrdinalIgnoreCase))
            {
                url = "http://" + url;
            }
            try { _browser.Navigate(url); } catch { /* ignore bad URLs */ }
        }

        private static string TryGetHost(string url)
        {
            try { return new Uri(url).Host; } catch { return null; }
        }
    }
}
