import { writeFileSync } from "node:fs";
import { COMPONENTS, FLOW, FLOW_TEXT, KNOWN_LIMITS } from "../src/lib/components-map";

const esc = (s: string) => s.replace(/\|/g, "\\|");
const md = [
  "# Components Map",
  "",
  "_Generated from `src/lib/components-map.ts` by `npm run gen:components-map`. Do not edit by hand._",
  "",
  "## Flow",
  "",
  FLOW.map((n) => n.label).join(" → "),
  "",
  FLOW_TEXT,
  "",
  "## Components",
  "",
  "| Component | Purpose | Inputs | Outputs | External service | Free-tier limit |",
  "| --- | --- | --- | --- | --- | --- |",
  ...COMPONENTS.map((c) => `| ${esc(c.name)} | ${esc(c.purpose)} | ${esc(c.inputs)} | ${esc(c.outputs)} | ${esc(c.service)} | ${esc(c.limit)} |`),
  "",
  "## Known limits",
  "",
  ...KNOWN_LIMITS.map((l) => `- ${l}`),
  "",
].join("\n");
writeFileSync("COMPONENTS_MAP.md", md);
console.log(`COMPONENTS_MAP.md written (${COMPONENTS.length} components).`);
