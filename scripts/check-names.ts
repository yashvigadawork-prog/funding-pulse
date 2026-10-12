import { execSync } from "node:child_process";
import { readText, repoFiles } from "./files";

// The forbidden words are assembled from fragments so this file never contains them.
const forbidden = [["rain", "matter"].join(""), ["zero", "dha"].join("")];
const re = new RegExp(forbidden.join("|"), "i");

const hits: string[] = [];
for (const f of repoFiles()) {
  const lines = readText(f).split("\n");
  lines.forEach((line, i) => {
    if (re.test(line)) hits.push(`${f}:${i + 1}`);
  });
  if (re.test(f)) hits.push(`${f} (file name)`);
}

// Commit messages count too.
try {
  const log = execSync("git log --format=%B", { encoding: "utf8" });
  if (re.test(log)) hits.push("git commit messages");
} catch {
  /* no commits yet */
}

if (hits.length) {
  console.error("check:names FAILED. A forbidden name was found in:");
  for (const h of hits.slice(0, 30)) console.error("  " + h);
  process.exit(1);
}
console.log("check:names passed: no forbidden names found.");
