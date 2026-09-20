import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
const port = Number(process.env.PORT || 8092);
process.env.APP_ORIGIN = `http://127.0.0.1:${port}`;
process.env.NODE_ENV = "development";
const { default: handler } = await import("../api/product.mjs");
const publicRoot = path.resolve("public");
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".json": "application/json",
};
http
  .createServer(async (req, res) => {
    try {
      const url = new URL(req.url, process.env.APP_ORIGIN);
      if (url.pathname === "/api/product") return handler(req, res);
      let local = decodeURIComponent(url.pathname);
      if (local === "/") local = "/index.html";
      if (!path.extname(local)) local += ".html";
      const file = path.resolve(publicRoot, "." + local);
      if (!file.startsWith(publicRoot + path.sep)) {
        res.writeHead(403).end();
        return;
      }
      const body = await fs.readFile(file);
      res.setHeader(
        "Content-Type",
        mime[path.extname(file)] || "application/octet-stream",
      );
      res.end(body);
    } catch {
      res.writeHead(404).end("Not found");
    }
  })
  .listen(port, "127.0.0.1", () =>
    console.log(`Product development server: http://127.0.0.1:${port}`),
  );
