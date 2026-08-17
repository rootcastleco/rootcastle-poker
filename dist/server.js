import { createServer } from "node:http";
import { readFile } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { PokerGame } from "./poker.js";
const PORT = 8787;
const HOST = "127.0.0.1";
const MAX_BODY_BYTES = 8192;
const game = new PokerGame();
const currentFile = fileURLToPath(import.meta.url);
const projectRoot = normalize(join(currentFile, "..", ".."));
const publicRoot = join(projectRoot, "public");
function log(event, fields = {}) { console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...fields })); }
function headers(res) { res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"); res.setHeader("X-Content-Type-Options", "nosniff"); res.setHeader("Referrer-Policy", "no-referrer"); res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()"); res.setHeader("Cache-Control", "no-store"); }
function sendJson(res, status, payload) { headers(res); res.statusCode = status; res.setHeader("Content-Type", "application/json; charset=utf-8"); res.end(JSON.stringify(payload)); }
function isJsonObject(value) { return typeof value === "object" && value !== null && !Array.isArray(value); }
async function readJsonBody(req) { return await new Promise((resolve, reject) => { const chunks = []; let total = 0; req.on("data", chunk => { total += chunk.byteLength; if (total > MAX_BODY_BYTES) {
    reject(new Error("İstek gövdesi çok büyük."));
    return;
} chunks.push(chunk); }); req.on("end", () => { try {
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.byteLength;
    }
    const text = new TextDecoder().decode(merged);
    const parsed = text.length === 0 ? {} : JSON.parse(text);
    if (!isJsonObject(parsed)) {
        reject(new Error("JSON nesnesi bekleniyor."));
        return;
    }
    resolve(parsed);
}
catch (error) {
    reject(error instanceof Error ? error : new Error("JSON çözümlenemedi."));
} }); req.on("error", () => reject(new Error("İstek okunamadı."))); }); }
function parseAction(body) { const action = body.action; if (action !== "fold" && action !== "check" && action !== "call" && action !== "raise")
    throw new Error("Geçersiz aksiyon."); const amount = body.amount; if (amount !== undefined && (typeof amount !== "number" || !Number.isInteger(amount) || amount < 0 || amount > 1_000_000))
    throw new Error("Geçersiz bahis miktarı."); return amount === undefined ? { action } : { action, amount }; }
function contentType(path) { const ext = extname(path); if (ext === ".html")
    return "text/html; charset=utf-8"; if (ext === ".css")
    return "text/css; charset=utf-8"; if (ext === ".js")
    return "text/javascript; charset=utf-8"; if (ext === ".png")
    return "image/png"; return "application/octet-stream"; }
function serveStatic(requestPath, res) { const safe = requestPath === "/" ? "/index.html" : requestPath; const relative = normalize(safe).replace(/^(\.\.[/\\])+/g, ""); const absolute = join(publicRoot, relative); if (!absolute.startsWith(publicRoot)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
} readFile(absolute, (error, data) => { if (error !== null) {
    sendJson(res, 404, { error: "Not found" });
    return;
} headers(res); res.statusCode = 200; res.setHeader("Content-Type", contentType(absolute)); res.end(data); }); }
function events(req, res) { headers(res); res.statusCode = 200; res.setHeader("Content-Type", "text/event-stream; charset=utf-8"); res.setHeader("Connection", "keep-alive"); res.setHeader("Cache-Control", "no-cache, no-transform"); res.write(": connected\n\n"); const unsubscribe = game.subscribe(state => res.write(`event: state\ndata: ${JSON.stringify(state)}\n\n`)); req.on("close", () => unsubscribe()); }
async function api(req, res, path) { if (req.method === "GET" && path === "/api/health") {
    sendJson(res, 200, { ok: true, service: "rootcastle-poker", now: new Date().toISOString() });
    return;
} if (req.method === "GET" && path === "/api/state") {
    sendJson(res, 200, game.getPublicState());
    return;
} if (req.method === "GET" && path === "/api/events") {
    events(req, res);
    return;
} try {
    if (req.method === "POST" && path === "/api/action") {
        const action = parseAction(await readJsonBody(req));
        game.performHumanAction(action);
        sendJson(res, 200, { ok: true, state: game.getPublicState() });
        log("player_action", { action: action.action, amount: action.amount ?? 0 });
        return;
    }
    if (req.method === "POST" && path === "/api/new-hand") {
        game.startHand();
        sendJson(res, 200, { ok: true, state: game.getPublicState() });
        log("new_hand");
        return;
    }
    if (req.method === "POST" && path === "/api/reset") {
        game.resetTable();
        sendJson(res, 200, { ok: true, state: game.getPublicState() });
        log("table_reset");
        return;
    }
    if (req.method === "POST" && path === "/api/chat") {
        const body = await readJsonBody(req);
        if (typeof body.text !== "string")
            throw new Error("Mesaj metni gerekli.");
        game.addHumanChat(body.text);
        sendJson(res, 200, { ok: true });
        return;
    }
}
catch (error) {
    const message = error instanceof Error ? error.message : "Bilinmeyen hata.";
    log("api_rejected", { path, message });
    sendJson(res, 400, { error: message });
    return;
} sendJson(res, 404, { error: "API route not found" }); }
const server = createServer((req, res) => { const method = req.method ?? "GET"; const url = new URL(req.url ?? "/", `http://${HOST}:${PORT}`); const path = url.pathname; if (path.startsWith("/api/")) {
    void api(req, res, path);
    return;
} if (method !== "GET" && method !== "HEAD") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
} serveStatic(path, res); });
server.listen(PORT, HOST, () => { log("server_started", { host: HOST, port: PORT }); console.log(`Rootcastle Poker: http://${HOST}:${PORT}`); });
