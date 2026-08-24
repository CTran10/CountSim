const http = require("node:http");
const path = require("node:path");

const {
  app,
  BrowserWindow,
  dialog,
  shell,
  utilityProcess
} = require("electron");
const {
  LOCAL_SERVER_PORT,
  isAllowedExternalUrl,
  isAppUrl,
  isRuntimeResponse,
  resolveServerEntry
} = require("./runtime.cjs");

const SERVER_START_TIMEOUT_MS = 20_000;
let appOrigin = "";
let mainWindow = null;
let serverProcess = null;
let quitting = false;

function requestIsReady(port) {
  return new Promise((resolve) => {
    const request = http.get(
      {
        host: "127.0.0.1",
        path: "/",
        port,
        timeout: 750
      },
      (response) => {
        response.resume();
        resolve(
          isRuntimeResponse(
            response.statusCode ?? 500,
            response.headers["x-trueedge-runtime"]
          )
        );
      }
    );
    request.on("error", () => resolve(false));
    request.on("timeout", () => {
      request.destroy();
      resolve(false);
    });
  });
}

async function waitForServer(port) {
  const deadline = Date.now() + SERVER_START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await requestIsReady(port)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("The local TrueEdge server did not start in time.");
}

async function startLocalServer() {
  const resourceRoot = app.isPackaged
    ? path.join(process.resourcesPath, "web")
    : path.join(__dirname, "..", "staged-web");
  const serverEntry = resolveServerEntry(resourceRoot);
  const port = LOCAL_SERVER_PORT;
  const child = utilityProcess.fork(serverEntry, [], {
    env: {
      ...process.env,
      HOSTNAME: "127.0.0.1",
      NODE_ENV: "production",
      PORT: String(port)
    },
    serviceName: "TrueEdge local server"
  });
  serverProcess = child;
  let starting = true;
  const exitBeforeReady = new Promise((_resolve, reject) => {
    child.once("exit", (code) => {
      if (serverProcess === child) serverProcess = null;
      if (starting) {
        reject(
          new Error(
            `The local TrueEdge server stopped before it was ready (code ${code}).`
          )
        );
        return;
      }
      if (!quitting) {
        dialog.showErrorBox(
          "TrueEdge stopped",
          `The local application server exited unexpectedly (code ${code}).`
        );
        app.quit();
      }
    });
  });
  await Promise.race([waitForServer(port), exitBeforeReady]);
  starting = false;
  appOrigin = `http://127.0.0.1:${port}`;
}

function openExternal(candidate) {
  if (isAllowedExternalUrl(candidate)) void shell.openExternal(candidate);
}

function createWindow() {
  const window = new BrowserWindow({
    autoHideMenuBar: process.platform !== "darwin",
    backgroundColor: "#0e120f",
    height: 900,
    minHeight: 680,
    minWidth: 960,
    show: false,
    title: "TrueEdge",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    },
    width: 1400
  });
  mainWindow = window;
  window.webContents.session.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false)
  );
  window.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-attach-webview", (event) => {
    event.preventDefault();
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (isAppUrl(url, appOrigin)) return;
    event.preventDefault();
    openExternal(url);
  });
  window.once("ready-to-show", () => window.show());
  window.on("closed", () => {
    if (mainWindow === window) mainWindow = null;
  });
  void window.loadURL(appOrigin);
}

function stopLocalServer() {
  if (serverProcess !== null) {
    serverProcess.kill();
    serverProcess = null;
  }
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow === null) createWindow();
    else {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app
    .whenReady()
    .then(async () => {
      await startLocalServer();
      createWindow();
    })
    .catch((error) => {
      dialog.showErrorBox(
        "TrueEdge could not start",
        error instanceof Error ? error.message : String(error)
      );
      app.quit();
    });
}

app.on("activate", () => {
  if (mainWindow === null && appOrigin !== "") createWindow();
});
app.on("before-quit", () => {
  quitting = true;
  stopLocalServer();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
