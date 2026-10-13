import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";

/** Fonts are embedded so the PDF looks the same on any machine, including the server that builds it. */
const FONT_FILES: { family: string; file: string; weight: number; style: "normal" | "italic" }[] = [
  { family: "Instrument Serif", file: "instrument-serif-latin-400-normal.woff2", weight: 400, style: "normal" },
  { family: "Instrument Serif", file: "instrument-serif-latin-400-italic.woff2", weight: 400, style: "italic" },
  { family: "Geist", file: "geist-sans-latin-400-normal.woff2", weight: 400, style: "normal" },
  { family: "Geist", file: "geist-sans-latin-600-normal.woff2", weight: 600, style: "normal" },
];

let fontCss: string | null = null;
function fonts(): string {
  if (fontCss) return fontCss;
  const dir = path.join(process.cwd(), "src/lib/deck/fonts");
  fontCss = FONT_FILES.map((f) => {
    const b64 = readFileSync(path.join(dir, f.file)).toString("base64");
    return `@font-face{font-family:"${f.family}";font-style:${f.style};font-weight:${f.weight};src:url(data:font/woff2;base64,${b64}) format("woff2")}`;
  }).join("\n");
  return fontCss;
}

export const SLIDE_W = 1280;
export const SLIDE_H = 720;

const BASE = `
@page{size:${SLIDE_W}px ${SLIDE_H}px;margin:0}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#fff}
body{font-family:"Geist",-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:#14161C;-webkit-print-color-adjust:exact;print-color-adjust:exact;font-variant-numeric:tabular-nums}
a{color:inherit;text-decoration:none}
.slide{width:${SLIDE_W}px;height:${SLIDE_H}px;position:relative;overflow:hidden;background:#FBFAF7;padding:46px 64px 0;break-after:page;page-break-after:always;display:flex;flex-direction:column}
.slide:last-child{break-after:auto;page-break-after:auto}
.kicker{font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#6B7080;font-weight:600;display:flex;align-items:center;gap:10px}
.kicker i{width:22px;height:3px;border-radius:2px;background:#3B4BDB;display:inline-block}
h2.title{font-family:"Instrument Serif",Georgia,serif;font-weight:400;font-size:46px;line-height:1.08;margin:12px 0 0;max-width:1050px;letter-spacing:-.005em}
h2.title em{font-style:italic;color:#B7791F}
.lede{font-size:19px;line-height:1.5;color:#3A3F4F;margin-top:12px;max-width:980px}
.foot{position:absolute;left:64px;right:64px;bottom:22px;display:flex;justify-content:space-between;font-size:12px;color:#8A8F9E;border-top:1px solid #E6E3DC;padding-top:10px}
.body{flex:1;min-height:0;margin-top:22px;margin-bottom:54px;position:relative}
.cols{display:grid;gap:36px;height:100%}
.bul{list-style:none;display:grid;gap:14px;margin-top:6px}
.bul li{display:flex;gap:12px;font-size:20px;line-height:1.4;color:#23273A}
.bul li:before{content:"";flex:none;width:8px;height:8px;border-radius:50%;background:#3B4BDB;margin-top:11px}
.tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.tile{background:#fff;border:1px solid #E6E3DC;border-radius:16px;padding:16px 18px;min-height:112px;display:flex;flex-direction:column;justify-content:space-between}
.tile .lab{font-size:13px;color:#6B7080;font-weight:600}
.tile .val{font-size:34px;line-height:1.05;font-weight:600;letter-spacing:-.01em;margin-top:6px}
.tile .val.sm{font-size:22px;line-height:1.15}
.tile .sub{font-size:13px;color:#6B7080;margin-top:4px}
.card{background:#fff;border:1px solid #E6E3DC;border-radius:16px}
.row{display:grid;align-items:center;gap:14px}
.dot{display:inline-block;width:10px;height:10px;border-radius:50%;flex:none}
.chip{display:inline-block;font-size:12px;font-weight:600;border-radius:999px;padding:3px 10px;white-space:nowrap}
.chip.up{background:#FDF1DE;color:#8A4E00}.chip.down{background:#EEF0FD;color:#3B4BDB}.chip.flat{background:#EFEEE9;color:#4A4F5E}.chip.back{background:#EEF0FD;color:#3B4BDB}.chip.follow{background:#FDF1DE;color:#8A4E00}
.bars .row{grid-template-columns:230px 1fr 170px;margin-bottom:30px}
.bars .name{font-size:17px;font-weight:600;display:flex;align-items:center;gap:10px}
.track{position:relative;height:40px;border-radius:10px;background:#EFEEE9}
.fill{position:absolute;left:0;top:0;bottom:0;border-radius:10px}
.tick{position:absolute;top:-5px;bottom:-5px;width:3px;border-radius:2px;background:#14161C}
.num{font-size:17px;text-align:right}.num small{display:block;font-size:13px;color:#6B7080}
.note{font-size:13.5px;color:#6B7080;margin-top:6px}
.dumb .row{grid-template-columns:200px 1fr 130px 175px;margin-bottom:26px}
.line{position:absolute;top:50%;height:4px;margin-top:-2px;border-radius:2px}
.pt{position:absolute;top:50%;width:20px;height:20px;margin:-10px 0 0 -10px;border-radius:50%}
.pt.hollow{background:#fff;border:3px solid}
.cols-chart{display:flex;align-items:flex-end;gap:26px;height:300px;border-bottom:2px solid #E6E3DC;padding:0 10px}
.colbar{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%}
.colbar b{font-size:22px;margin-bottom:6px}
.colbar div{width:100%;max-width:110px;border-radius:10px 10px 0 0}
.collab{display:flex;gap:26px;padding:8px 10px 0}.collab span{flex:1;text-align:center;font-size:14px;font-weight:600;color:#3A3F4F}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.chips span{background:#fff;border:1px solid #E6E3DC;border-radius:999px;padding:6px 14px;font-size:15px}
.fit .item{display:grid;grid-template-columns:44px 1fr 150px;gap:16px;align-items:start;padding:9px 0;border-bottom:1px solid #E6E3DC}
.fit .item:last-child{border-bottom:0}
.rank{width:36px;height:36px;border-radius:50%;background:#EEF0FD;color:#3B4BDB;font-weight:600;display:grid;place-items:center;font-size:16px}
.fit .co{font-size:19px;font-weight:600;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.fit .meta{font-size:14px;color:#6B7080;margin-top:3px}
.fit .desc{font-size:15px;color:#3A3F4F;margin-top:2px;line-height:1.35}
.fit .amt{text-align:right;font-size:20px;font-weight:600}.fit .amt small{display:block;font-size:13px;color:#6B7080;font-weight:400}
.src{font-size:12.5px;color:#3B4BDB;margin-top:3px}
table.t{width:100%;border-collapse:collapse;font-size:15px}
table.t th{text-align:left;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6B7080;padding:0 8px 8px;border-bottom:2px solid #E6E3DC}
table.t td{padding:8px;border-bottom:1px solid #EDEBE5;vertical-align:top}
table.t td.r,table.t th.r{text-align:right}
.mut{color:#6B7080}
.cover{background:#14161C;color:#F2F1EC;padding:64px 80px}
.cover .kicker{color:#9AA0B4}.cover .kicker i{background:#F2B75A}
.cover h1{font-family:"Instrument Serif",Georgia,serif;font-weight:400;font-size:96px;line-height:1;margin-top:150px;letter-spacing:-.01em}
.cover h1 em{color:#F2B75A}
.cover .sub{font-size:26px;line-height:1.4;color:#C9CCD8;max-width:900px;margin-top:26px}
.cover .meta{position:absolute;left:80px;right:80px;bottom:56px;display:flex;justify-content:space-between;font-size:15px;color:#9AA0B4;border-top:1px solid #2C3140;padding-top:16px}
.empty{font-size:20px;color:#6B7080;padding:30px 0}
@media screen{body{background:#E9E8E3}.slide{margin:24px auto;box-shadow:0 8px 30px rgba(20,22,28,.12);zoom:var(--z,1)}}
@media print{.slide{margin:0;box-shadow:none}}
`;

export function deckCss(): string {
  return `${fonts()}\n${BASE}`;
}
