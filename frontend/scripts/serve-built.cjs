"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const admin = process.argv.includes("--admin");
const port = admin ? 4301 : 4300;
const root = path.resolve(__dirname, admin ? "../dist/admin/browser" : "../dist/frontend/browser");
if (!fs.existsSync(path.join(root, "index.html"))) throw new Error("Build the requested portal before browser testing.");
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml" };
http.createServer((req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, "http://127.0.0.1").pathname);
    let file = path.resolve(root, "." + pathname);
    if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) file = path.join(root, "index.html");
    res.setHeader("Content-Type", mime[path.extname(file)] || "application/octet-stream");
    fs.createReadStream(file).on("error", () => { res.statusCode = 500; res.end(); }).pipe(res);
  } catch { res.writeHead(400); res.end(); }
}).listen(port, "127.0.0.1");
