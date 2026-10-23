import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AppointmentAgent } from "./agent/appointment-agent.js";
import { AppointmentStore, DomainError } from "./domain/appointment-store.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const publicDir = resolve(__dirname, "..", "public");
const port = Number(process.env.PORT || 3000);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

export function createDemoServer({ now = new Date() } = {}) {
  const store = new AppointmentStore({ now });
  const agent = new AppointmentAgent(store);

  function sendJson(res, status, payload) {
    const body = JSON.stringify(payload);
    res.writeHead(status, {
      "content-type": "application/json; charset=utf-8",
      "content-length": Buffer.byteLength(body),
      "cache-control": "no-store"
    });
    res.end(body);
  }

  async function readJson(req) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 1_000_000) {
        throw new DomainError("PAYLOAD_TOO_LARGE", "请求内容过大", 413);
      }
      chunks.push(chunk);
    }
    if (!chunks.length) return {};
    try {
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw new DomainError("INVALID_JSON", "请求 JSON 格式不正确", 400);
    }
  }

  async function handleApi(req, res, url) {
    if (req.method === "GET" && url.pathname === "/api/health") {
      sendJson(res, 200, {
        status: "ok",
        mode: "local-demo",
        time: new Date().toISOString()
      });
      return true;
    }

    if (req.method === "GET" && url.pathname === "/api/bootstrap") {
      sendJson(
        res,
        200,
        store.getBootstrap({
          activeConversationId: url.searchParams.get("conversationId") || "conv_cus_001"
        })
      );
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/messages") {
      const body = await readJson(req);
      const result = await agent.handleMessage({
        channel: body.channel,
        identifier: body.identifier,
        text: body.text
      });
      sendJson(res, 200, result);
      return true;
    }

    const offerMatch = url.pathname.match(/^\/api\/waitlist\/([^/]+)\/offer$/);
    if (req.method === "POST" && offerMatch) {
      await readJson(req);
      const result = store.offerWaitlistSlot(decodeURIComponent(offerMatch[1]));
      sendJson(res, 200, {
        ...result,
        snapshot: store.getBootstrap({
          activeConversationId: result.conversation.id
        })
      });
      return true;
    }

    const acceptMatch = url.pathname.match(/^\/api\/waitlist\/([^/]+)\/accept$/);
    if (req.method === "POST" && acceptMatch) {
      const body = await readJson(req);
      const result = store.acceptWaitlistSlot(
        decodeURIComponent(acceptMatch[1]),
        String(body.customerId || "")
      );
      sendJson(res, 200, {
        ...result,
        conversationId: `conv_${body.customerId}`,
        snapshot: store.getBootstrap({
          activeConversationId: `conv_${body.customerId}`
        })
      });
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/reset") {
      await readJson(req);
      store.reset();
      agent.reset();
      sendJson(res, 200, {
        snapshot: store.getBootstrap({ activeConversationId: "conv_cus_001" })
      });
      return true;
    }

    return false;
  }

  async function serveStatic(req, res, url) {
    if (!["GET", "HEAD"].includes(req.method)) {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }
    const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
    const decodedPath = decodeURIComponent(requestedPath);
    const filePath = normalize(join(publicDir, decodedPath));
    if (!filePath.startsWith(publicDir)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    try {
      const body = await readFile(filePath);
      res.writeHead(200, {
        "content-type": MIME_TYPES[extname(filePath).toLowerCase()] || "application/octet-stream",
        "content-length": body.length,
        "cache-control": "no-cache"
      });
      if (req.method === "HEAD") res.end();
      else res.end(body);
    } catch (error) {
      if (error.code === "ENOENT" || error.code === "EISDIR") {
        sendJson(res, 404, { error: "Not found" });
        return;
      }
      throw error;
    }
  }

  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      if (url.pathname.startsWith("/api/")) {
        const handled = await handleApi(req, res, url);
        if (!handled) sendJson(res, 404, { error: "API route not found" });
        return;
      }
      await serveStatic(req, res, url);
    } catch (error) {
      const status = error instanceof DomainError ? error.status : 500;
      const message = error instanceof DomainError ? error.message : "服务器内部错误";
      if (status >= 500) console.error(error);
      sendJson(res, status, {
        error: message,
        code: error.code || "INTERNAL_ERROR"
      });
    }
  });
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const server = createDemoServer();
  server.listen(port, "127.0.0.1", () => {
    console.log(`约序 CareFlow demo is running at http://127.0.0.1:${port}`);
  });
}
