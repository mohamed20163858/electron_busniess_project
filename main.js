// main.js
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const ExcelJS = require("exceljs");

// Start the internal API server
require("./api/server.js");
let mainWindow, loadingWindow;
let loadingTimeout = null;
const LOADER_DELAY = 1000; // Show loader after 300ms delay

function updateLoadingWindowSize() {
  if (!loadingWindow || loadingWindow.isDestroyed()) return;

  // Get latest parent dimensions
  const parentBounds = mainWindow.getBounds();

  // Resize loading window to match parent
  loadingWindow.setBounds({
    x: 0,
    y: 0,
    width: parentBounds.width,
    height: parentBounds.height,
  });

  // Re-center the window (optional but ensures proper positioning)
  loadingWindow.center();
}

function createLoadingWindow() {
  const parentBounds = mainWindow.getBounds();

  loadingWindow = new BrowserWindow({
    width: parentBounds.width, // Match initial parent width
    height: parentBounds.height, // Match initial parent height
    parent: mainWindow, // Center over main window
    modal: true,
    show: false,
    frame: false,
    transparent: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      sandbox: false,
    },
  });

  loadingWindow.loadFile(path.join(__dirname, "src", "loading.html"));
  // Update loading window size when parent resizes
  mainWindow.on("resize", updateLoadingWindowSize);
  mainWindow.on("maximize", updateLoadingWindowSize);
  mainWindow.on("unmaximize", updateLoadingWindowSize);
}
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    backgroundColor: "rgba(201, 43, 44, 0.4)",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      sandbox: false,
    },
  });
  createLoadingWindow();
  mainWindow.webContents.on("did-start-loading", () => {
    // Schedule loader to appear after delay
    // console.log("start loading");
    loadingTimeout = setTimeout(() => {
      if (loadingWindow && !loadingWindow.isDestroyed()) {
        console.log("Loading window created");
        loadingWindow.show();
      }
    }, LOADER_DELAY);
  });

  mainWindow.webContents.on("did-stop-loading", () => {
    // Cancel pending loader display
    // console.log("stop loading");
    if (loadingTimeout) {
      clearTimeout(loadingTimeout);
      loadingTimeout = null;
    }
    // Hide loader if it was shown
    if (loadingWindow && !loadingWindow.isDestroyed()) {
      loadingWindow.hide();
    }
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
// Handle PDF export
ipcMain.handle("export-pdf", async () => {
  // you can tweak these options as you like
  const pdfBuffer = await mainWindow.webContents.printToPDF({
    printBackground: true,
    marginsType: 1,
    pageSize: "A4",
  });
  return pdfBuffer;
});
ipcMain.handle("save-pdf", async (_event, pdfBuffer) => {
  const { filePath } = await dialog.showSaveDialog({
    defaultPath: `report-${Date.now()}.pdf`,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (filePath) {
    fs.writeFileSync(filePath, pdfBuffer);
    return { saved: true };
  }
  return { saved: false };
});

// ipcMain.handle(
//   "export-excel",
//   async (event, { sheetName, headers, rows, defaultPath }) => {
//     // 1) Ask the user where to save
//     const { canceled, filePath } = await dialog.showSaveDialog({
//       title: "حفظ كملف Excel",
//       defaultPath: defaultPath || `${sheetName}.xlsx`,
//       filters: [{ name: "Excel Workbook", extensions: ["xlsx"] }],
//     });
//     if (canceled || !filePath) return { canceled: true };

//     // 2) Build workbook
//     const wb = new ExcelJS.Workbook();
//     const ws = wb.addWorksheet(sheetName);

//     // 3) Add header row
//     ws.addRow(headers);

//     // 4) Add your data rows
//     rows.forEach((r) => ws.addRow(r));

//     // 5) Write to disk
//     await wb.xlsx.writeFile(filePath);
//     return { canceled: false, filePath };
//   }
// );
// Listen for renderer asking to show a save dialog:
ipcMain.handle("show-save-dialog", async (event, options) => {
  // Use the sender’s BrowserWindow as the parent
  const win = BrowserWindow.fromWebContents(event.sender);
  return dialog.showSaveDialog(win, options);
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
