import { app, BrowserWindow } from "electron";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;
const VITE_PORT = 5173;
const SERVER_PORT = 3456;

let mainWindow;
let serverProcess;
let viteProcess;

function startServer() {
  serverProcess = spawn("node", [join(__dirname, "server.js")], {
    stdio: "inherit",
    env: { ...process.env },
    windowsHide: true,
  });
}

function startViteDev() {
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  viteProcess = spawn(npx, ["vite"], {
    stdio: "inherit",
    cwd: __dirname,
    windowsHide: true,
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "校正ビューワー",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (isDev) {
    // Dev: use Vite dev server
    const tryLoad = () => {
      mainWindow.loadURL(`http://localhost:${VITE_PORT}`).catch(() => {
        setTimeout(tryLoad, 1000);
      });
    };
    tryLoad();
  } else {
    // Production: serve built files
    mainWindow.loadFile(join(__dirname, "dist", "index.html"));
  }

  mainWindow.on("closed", () => { mainWindow = null; });
}

app.whenReady().then(() => {
  startServer();
  if (isDev) startViteDev();
  // Wait a moment for server to start
  setTimeout(createWindow, 1500);
});

app.on("window-all-closed", () => {
  if (serverProcess) serverProcess.kill();
  if (viteProcess) viteProcess.kill();
  app.quit();
});

app.on("before-quit", () => {
  if (serverProcess) serverProcess.kill();
  if (viteProcess) viteProcess.kill();
});
