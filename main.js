// main.js
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");

// Start the internal API server
require("./api/server.js");

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      sandbox: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, "src", "splash.html"));
}

app.whenReady().then(createWindow);

// IPC handler for showing a message box
ipcMain.handle("show-message", async (event, { message, title = "Info" }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  await dialog.showMessageBox(win, {
    type: "info",
    title,
    message,
    buttons: ["OK"],
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
