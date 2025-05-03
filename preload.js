// preload.js
const { contextBridge, ipcRenderer } = require("electron");
const path = require("path");
const commentsModulePath = path.join(__dirname, "lib", "comments.js");
const { comments } = require(commentsModulePath);

contextBridge.exposeInMainWorld("myAPI", {
  comments: comments,
});
contextBridge.exposeInMainWorld("electronAPI", {
  showMessage: (msg, title) =>
    ipcRenderer.invoke("show-message", { message: msg, title }),

  // any other APIs you already expose...
});
