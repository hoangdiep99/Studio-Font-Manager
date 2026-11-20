const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const APP_DIR = __dirname;
const ICO_PATH = path.join(APP_DIR, 'app.ico');
const CS_PATH = path.join(APP_DIR, 'StudioFontManager.cs');
const EXE_PATH = path.join(APP_DIR, 'StudioFontManager.exe');

// 1. Create a valid 32x32 32-bit BMP inside an ICO container (crimson wedding theme with gold/white 'F')
function createAppIcon() {
  const w = 32, h = 32;
  const pixelData = Buffer.alloc(w * h * 4);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // BMP is bottom-up
      const py = h - 1 - y;
      const idx = (py * w + x) * 4;

      // Rounded rect mask
      const dx = Math.max(0, Math.max(4 - x, x - (w - 5)));
      const dy = Math.max(0, Math.max(4 - y, y - (h - 5)));
      if (dx * dx + dy * dy > 16) {
        pixelData[idx + 0] = 0;
        pixelData[idx + 1] = 0;
        pixelData[idx + 2] = 0;
        pixelData[idx + 3] = 0;
        continue;
      }

      // Crimson gradient background (#be123c -> #881337)
      let r = Math.round(190 - (y / h) * 50);
      let g = 18;
      let b = Math.round(60 - (y / h) * 10);

      // Gold border ring
      if (x === 2 || x === w - 3 || y === 2 || y === h - 3) {
        r = 251; g = 191; b = 36;
      }

      // Draw a bold 'F' (Font) in white/gold in center
      const inFStem = (x >= 10 && x <= 14 && y >= 7 && y <= 25);
      const inFTop = (x >= 10 && x <= 23 && y >= 7 && y <= 11);
      const inFMid = (x >= 10 && x <= 20 && y >= 15 && y <= 18);
      const inSerifTop = (x >= 8 && x <= 16 && y >= 7 && y <= 8);
      const inSerifBot = (x >= 8 && x <= 16 && y >= 24 && y <= 25);

      if (inFStem || inFTop || inFMid || inSerifTop || inSerifBot) {
        r = 255; g = 250; b = 240;
      }

      pixelData[idx + 0] = b; // Blue
      pixelData[idx + 1] = g; // Green
      pixelData[idx + 2] = r; // Red
      pixelData[idx + 3] = 255; // Alpha
    }
  }

  const andMask = Buffer.alloc((w * h) / 8, 0);
  const bih = Buffer.alloc(40);
  bih.writeUInt32LE(40, 0); // header size
  bih.writeInt32LE(w, 4);
  bih.writeInt32LE(h * 2, 8); // height * 2 for ICO
  bih.writeUInt16LE(1, 12); // planes
  bih.writeUInt16LE(32, 14); // bpp
  bih.writeUInt32LE(0, 16); // compression
  bih.writeUInt32LE(pixelData.length + andMask.length, 20);

  const imageBytes = Buffer.concat([bih, pixelData, andMask]);

  const icoHeader = Buffer.alloc(6 + 16);
  icoHeader.writeUInt16LE(0, 0);
  icoHeader.writeUInt16LE(1, 2); // type 1 = icon
  icoHeader.writeUInt16LE(1, 4); // 1 image
  icoHeader.writeUInt8(w, 6);
  icoHeader.writeUInt8(h, 7);
  icoHeader.writeUInt8(0, 8);
  icoHeader.writeUInt8(0, 9);
  icoHeader.writeUInt16LE(1, 10);
  icoHeader.writeUInt16LE(32, 12);
  icoHeader.writeUInt32LE(imageBytes.length, 14);
  icoHeader.writeUInt32LE(22, 18);

  fs.writeFileSync(ICO_PATH, Buffer.concat([icoHeader, imageBytes]));
  console.log('Created app.ico');
}

const csCode = `using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Reflection;
using System.Threading;
using System.Windows.Forms;

[assembly: AssemblyTitle("STUDIO FONT MANAGER")]
[assembly: AssemblyProduct("STUDIO FONT MANAGER")]
[assembly: AssemblyDescription("STUDIO FONT MANAGER - Phần mềm Quản lý & Xem trước Phông chữ")]
[assembly: AssemblyVersion("1.3.0.0")]

namespace StudioFontManager
{
    static class Program
    {
        private static Process nodeProcess = null;
        private static NotifyIcon trayIcon = null;
        private static readonly string AppUrl = "http://localhost:3456";
        private static string BaseDir = AppDomain.CurrentDomain.BaseDirectory;

        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            bool createdNew;
            using (Mutex mutex = new Mutex(true, "StudioFontManager_SingleInstance_Mutex", out createdNew))
            {
                EnsureEmbeddedFilesExtracted();

                if (!IsServerRunning())
                {
                    StartNodeServer();
                    WaitForServer(4000);
                }

                // Always launch the UI window when user double-clicks the .exe
                OpenAppWindow();

                // If another instance is already holding the tray icon, exit quietly after popping open the window
                if (!createdNew)
                {
                    return;
                }

                // Setup System Tray Icon so user can manage or quit anytime without a black CMD window
                trayIcon = new NotifyIcon();
                try
                {
                    trayIcon.Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
                }
                catch
                {
                    trayIcon.Icon = SystemIcons.Application;
                }
                trayIcon.Text = "STUDIO FONT MANAGER";
                trayIcon.Visible = true;

                ContextMenu menu = new ContextMenu();
                MenuItem itemOpenApp = new MenuItem("💍 Mở STUDIO FONT MANAGER", (s, e) => OpenAppWindow());
                itemOpenApp.DefaultItem = true;
                menu.MenuItems.Add(itemOpenApp);

                menu.MenuItems.Add(new MenuItem("🌐 Mở Trên Trình Duyệt Mặc Định", (s, e) => {
                    try { Process.Start(AppUrl); } catch { }
                }));

                menu.MenuItems.Add(new MenuItem("📂 Mở Thư Mục Font (./fonts)", (s, e) => {
                    string fontsDir = Path.Combine(BaseDir, "fonts");
                    if (!Directory.Exists(fontsDir)) Directory.CreateDirectory(fontsDir);
                    try { Process.Start("explorer.exe", "\\"" + fontsDir + "\\""); } catch { }
                }));

                menu.MenuItems.Add("-");

                menu.MenuItems.Add(new MenuItem("❌ Thoát Phần Mềm", (s, e) => {
                    ExitApplication();
                }));

                trayIcon.ContextMenu = menu;
                trayIcon.DoubleClick += (s, e) => OpenAppWindow();

                trayIcon.ShowBalloonTip(
                    2500,
                    "Studio Font Manager đang chạy",
                    "Nháy đúp vào biểu tượng ở góc màn hình để mở lại bất cứ lúc nào.",
                    ToolTipIcon.Info
                );

                Application.ApplicationExit += (s, e) => StopNodeServer();
                Application.Run();
            }
        }

        private static void EnsureEmbeddedFilesExtracted()
        {
            try
            {
                string serverPath = Path.Combine(BaseDir, "server.js");
                if (!File.Exists(serverPath))
                {
                    ExtractResource("server.js", serverPath);
                }

                string publicDir = Path.Combine(BaseDir, "public");
                if (!Directory.Exists(publicDir)) Directory.CreateDirectory(publicDir);

                string indexPath = Path.Combine(publicDir, "index.html");
                if (!File.Exists(indexPath))
                {
                    ExtractResource("index.html", indexPath);
                }

                string dataDir = Path.Combine(BaseDir, "data");
                if (!Directory.Exists(dataDir)) Directory.CreateDirectory(dataDir);

                string metaPath = Path.Combine(dataDir, "metadata.json");
                if (!File.Exists(metaPath))
                {
                    ExtractResource("metadata.json", metaPath);
                }
            }
            catch { }
        }

        private static void ExtractResource(string resName, string outPath)
        {
            using (Stream s = Assembly.GetExecutingAssembly().GetManifestResourceStream(resName))
            {
                if (s == null) return;
                using (FileStream fs = new FileStream(outPath, FileMode.Create, FileAccess.Write))
                {
                    s.CopyTo(fs);
                }
            }
        }

        private static bool IsServerRunning()
        {
            try
            {
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create(AppUrl + "/api/fonts");
                req.Timeout = 700;
                using (HttpWebResponse res = (HttpWebResponse)req.GetResponse())
                {
                    return res.StatusCode == HttpStatusCode.OK;
                }
            }
            catch
            {
                return false;
            }
        }

        private static void WaitForServer(int maxWaitMs)
        {
            int waited = 0;
            while (waited < maxWaitMs)
            {
                if (IsServerRunning()) return;
                Thread.Sleep(150);
                waited += 150;
            }
        }

        private static void StartNodeServer()
        {
            try
            {
                string nodeExe = FindNodeExecutable();
                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = nodeExe,
                    Arguments = "\\"" + Path.Combine(BaseDir, "server.js") + "\\"",
                    WorkingDirectory = BaseDir,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    WindowStyle = ProcessWindowStyle.Hidden
                };
                nodeProcess = Process.Start(psi);
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    "Không khởi động được Node.js server: " + ex.Message,
                    "Studio Font Manager",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
            }
        }

        private static string FindNodeExecutable()
        {
            string[] candidates = new string[]
            {
                @"C:\\Program Files\\nodejs\\node.exe",
                @"C:\\Program Files (x86)\\nodejs\\node.exe",
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "nodejs", "node.exe")
            };
            foreach (string c in candidates)
            {
                if (File.Exists(c)) return c;
            }
            return "node";
        }

        private static void OpenAppWindow()
        {
            try
            {
                // Prefer opening in standalone desktop app mode (--app=...) via Edge or Chrome so it looks like a native Windows app!
                string[] browsers = new string[]
                {
                    @"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
                    @"C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
                    @"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
                    @"C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
                };

                foreach (string b in browsers)
                {
                    if (File.Exists(b))
                    {
                        Process.Start(new ProcessStartInfo
                        {
                            FileName = b,
                            Arguments = "--app=" + AppUrl + " --start-maximized",
                            UseShellExecute = true
                        });
                        return;
                    }
                }

                // Fallback to default browser
                Process.Start(AppUrl);
            }
            catch
            {
                try { Process.Start(AppUrl); } catch { }
            }
        }

        private static void StopNodeServer()
        {
            try
            {
                if (nodeProcess != null && !nodeProcess.HasExited)
                {
                    nodeProcess.Kill();
                    nodeProcess.Dispose();
                    nodeProcess = null;
                }
            }
            catch { }
        }

        private static void ExitApplication()
        {
            if (trayIcon != null)
            {
                trayIcon.Visible = false;
                trayIcon.Dispose();
            }
            StopNodeServer();
            Application.Exit();
        }
    }
}
`;

createAppIcon();
fs.writeFileSync(CS_PATH, '\uFEFF' + csCode, 'utf8');
console.log('Created StudioFontManager.cs');

const cscPath = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe';
const cmd = `"${cscPath}" /nologo /target:winexe /optimize+ /out:"${EXE_PATH}" /win32icon:"${ICO_PATH}" /resource:"${path.join(APP_DIR, 'server.js')}",server.js /resource:"${path.join(APP_DIR, 'public', 'index.html')}",index.html /resource:"${path.join(APP_DIR, 'data', 'metadata.json')}",metadata.json /reference:System.dll /reference:System.Drawing.dll /reference:System.Windows.Forms.dll "${CS_PATH}"`;

console.log('Compiling StudioFontManager.exe...');
const output = execSync(cmd, { encoding: 'utf8' });
console.log(output || 'Compiled successfully!');
