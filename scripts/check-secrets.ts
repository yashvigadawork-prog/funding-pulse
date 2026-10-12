import { readText, repoFiles } from "./files";

const patterns: [string, RegExp][] = [
  ["Google API key", /AIza[0-9A-Za-z_-]{30,}/],
  ["Resend key", /\bre_[A-Za-z0-9]{16,}/],
  ["Tavily key", /\btvly-[A-Za-z0-9_-]{16,}/],
  ["Database URL with password", /postgres(?:ql)?:\/\/[^\s'"`:@/]+:[^\s'"`@]{4,}@/],
  ["GitHub token", /\bgh[pousr]_[A-Za-z0-9]{20,}/],
  ["Generic secret key", /\bsk-[A-Za-z0-9_-]{20,}/],
  ["Private key block", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["Long secret assignment", /\b(?:API_KEY|SECRET|TOKEN|PASSWORD)\s*=\s*["']?[A-Za-z0-9_\-]{24,}/],
];

const hits: string[] = [];
for (const f of repoFiles()) {
  const text = readText(f);
  for (const [name, re] of patterns) {
    const m = text.match(re);
    if (m) hits.push(`${f}: looks like a ${name}`);
  }
}

if (hits.length) {
  console.error("check:secrets FAILED:");
  for (const h of hits) console.error("  " + h);
  process.exit(1);
}
console.log("check:secrets passed: no keys or passwords found in the repo files.");
