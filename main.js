const { app, BrowserWindow } = require("electron");
const path = require("path");

// Import the Express server so it starts with the app.
require("./api/server.js");

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true, // Note: consider security implications for production
      contextIsolation: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, "src", "index.html"));
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
