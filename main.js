// main.js
const { app, BrowserWindow } = require("electron");
const path = require("path");

// Start the internal API server
require("./api/server.js");

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      // In production, consider disabling nodeIntegration and using preload scripts
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false, // disables the remote module

      sandbox: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, "src", "splash.html"));
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
