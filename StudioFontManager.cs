using System;
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
                    try { Process.Start("explorer.exe", "\"" + fontsDir + "\""); } catch { }
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
                    Arguments = "\"" + Path.Combine(BaseDir, "server.js") + "\"",
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
                @"C:\Program Files\nodejs\node.exe",
                @"C:\Program Files (x86)\nodejs\node.exe",
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
                    @"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
                    @"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
                    @"C:\Program Files\Google\Chrome\Application\chrome.exe",
                    @"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
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
