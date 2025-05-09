// preload.js
const { contextBridge, ipcRenderer } = require("electron");
const path = require("path");
const commentsModulePath = path.join(__dirname, "lib", "comments.js");
const { comments } = require(commentsModulePath);
const readXlsxFile = require("read-excel-file");

contextBridge.exposeInMainWorld("myAPI", {
  comments: comments,
});
contextBridge.exposeInMainWorld("electronAPI", {
  showMessage: (msg, title) =>
    ipcRenderer.invoke("show-message", { message: msg, title }),
  readXlsxFile, // ✅ expose the function
  // any other APIs you already expose...
  exportPDF: () => ipcRenderer.invoke("export-pdf"),
  savePDF: (buffer) => ipcRenderer.invoke("save-pdf", buffer),
  exportExcel: (sheetName, headers, rows, defaultPath) =>
    ipcRenderer.invoke("export-excel", {
      sheetName,
      headers,
      rows,
      defaultPath,
    }),
});
