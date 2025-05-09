// main.js
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const ExcelJS = require("exceljs");

// Start the internal API server
require("./api/server.js");
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
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

ipcMain.handle(
  "export-excel",
  async (event, { sheetName, headers, rows, defaultPath }) => {
    // 1) Ask the user where to save
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: "حفظ كملف Excel",
      defaultPath: defaultPath || `${sheetName}.xlsx`,
      filters: [{ name: "Excel Workbook", extensions: ["xlsx"] }],
    });
    if (canceled || !filePath) return { canceled: true };

    // 2) Build workbook
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(sheetName);

    // 3) Add header row
    ws.addRow(headers);

    // 4) Add your data rows
    rows.forEach((r) => ws.addRow(r));

    // 5) Write to disk
    await wb.xlsx.writeFile(filePath);
    return { canceled: false, filePath };
  }
);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
