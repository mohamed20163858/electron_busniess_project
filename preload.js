// preload.js
const { contextBridge } = require("electron");
const path = require("path");
const commentsModulePath = path.join(__dirname, "lib", "comments.js");
const { comments } = require(commentsModulePath);

contextBridge.exposeInMainWorld("myAPI", {
  comments: comments,
});
