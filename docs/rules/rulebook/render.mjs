// Renders the SLL-2 rule book: letterhead.html -> PNG band, then rulebook.html
// -> A4 PDF with that band as the header and a page-numbered footer on every
// page. Needs headless Chrome on CDP port 9351.
//   node render.mjs "<out.pdf>"
import fs from "node:fs";
import path from "node:path";
const dir = path.dirname(new URL(import.meta.url).pathname);
const out = process.argv[2] || path.join(dir, "SLL-2 Rule Book.pdf");
const crest = fs.readFileSync(path.join(dir, "crest.b64"), "utf8").trim();
const wm = fs.readFileSync(path.join(dir, "wm.b64"), "utf8").trim();

async function tab() {
  const t = await (await fetch("http://127.0.0.1:9351/json/new?about:blank", { method: "PUT" })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let id = 0; const p = new Map();
  ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (p.has(m.id)) { p.get(m.id)(m.result); p.delete(m.id); } });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; p.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await send("Page.enable");
  return { send, close: () => ws.close() };
}
const tmp = (name, html) => { const f = path.join(dir, name); fs.writeFileSync(f, html); return f; };

// 1. letterhead band at 2x
const lh = tmp(".lh.html", fs.readFileSync(path.join(dir, "letterhead.html"), "utf8").replace("CREST", crest));
let t = await tab();
await t.send("Emulation.setDeviceMetricsOverride", { width: 794, height: 150, deviceScaleFactor: 2, mobile: false });
await t.send("Page.navigate", { url: "file://" + lh }); await new Promise((r) => setTimeout(r, 2500));
const band = (await t.send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: 794, height: 150, scale: 1 } })).data;
t.close();

// 2. the book
const book = tmp(".book.html", fs.readFileSync(path.join(dir, "rulebook.html"), "utf8").replace("WATERMARK", wm));
t = await tab();
await t.send("Page.navigate", { url: "file://" + book }); await new Promise((r) => setTimeout(r, 2500));
const header = `<div style="width:100%;margin:0;padding:0;-webkit-print-color-adjust:exact"><img src="data:image/png;base64,${band}" style="display:block;width:210mm;height:auto;margin:0"></div>`;
const footer = `<div style="width:100%;padding:0 20mm;font:8px Arial,sans-serif;color:#4a5672;display:flex;justify-content:space-between;align-items:center;-webkit-print-color-adjust:exact">
<span style="border-top:2px solid #e8352b;padding-top:4px;flex:1">SLL-2 Rules &amp; Regulations &middot; Issued 3 November 2026</span>
<span style="border-top:2px solid #14274e;padding-top:4px">Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`;
const r = await t.send("Page.printToPDF", { printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true, headerTemplate: header, footerTemplate: footer });
fs.writeFileSync(out, Buffer.from(r.data, "base64")); t.close();
for (const f of [lh, book]) fs.unlinkSync(f);
console.log("wrote", out);
