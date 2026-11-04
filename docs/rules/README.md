# SLL-2 rule books

- `SLL-2 Rules.html` — Rules & Regulations, published at https://claude.ai/artifact/64Z8cPbgkG9S58Z64EzPgS
- `Shanti Devi Players Index.html` — SPI methodology + categorisation only, published at https://claude.ai/artifact/52KYBhdN1paNyTtDTqd7sZ
- The PDFs are A4 exports of the same pages (Midnight Stadium brand kit).

These HTML files are the source: edit them directly, republish the artifact from the file, and re-export the PDF.
PDF export: wrap the file in `<!doctype html><html><head><meta charset="utf-8"></head>…</html>` and run
`node pdf.mjs <wrapped.html> <out.pdf>` against headless Chrome on CDP port 9351.

## Rule book on letterhead
`rulebook/` — the formal SLL-2 Rule Book (14 Articles) on the league letterhead. Edit `rulebook.html` (and `letterhead.html` for the band), then `node rulebook/render.mjs "<out.pdf>"`.
