import fs from "node:fs";
const [file, out] = process.argv.slice(2);
const t = await (await fetch("http://127.0.0.1:9351/json/new?about:blank", { method: "PUT" })).json();
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let id = 0; const p = new Map(); ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (p.has(m.id)) { p.get(m.id)(m.result); p.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; p.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send("Page.enable"); await send("Page.navigate", { url: "file://" + file }); await new Promise((r) => setTimeout(r, 2000));
const r = await send("Page.printToPDF", { printBackground: true, preferCSSPageSize: true });
fs.writeFileSync(out, Buffer.from(r.data, "base64")); ws.close();
