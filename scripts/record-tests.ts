import { execSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/** Runs the tests with a JSON reporter and records the result for the public Method page. */
const out = path.join(tmpdir(), `fp-vitest-${process.pid}.json`);
const r = spawnSync("npx", ["vitest", "run", "--reporter=json", `--outputFile=${out}`], { encoding: "utf8" });
let raw: { numTotalTests: number; numPassedTests: number; numFailedTests: number; testResults: { name: string; assertionResults: { status: string }[] }[] };
try {
  raw = JSON.parse(readFileSync(out, "utf8"));
} catch {
  console.error("Could not read the test results.\n" + (r.stderr || r.stdout));
  process.exit(1);
}
rmSync(out, { force: true });
const cwd = process.cwd();
let commit = "unknown";
try {
  commit = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
} catch {
  /* not a git repo yet */
}
const files = raw.testResults
  .map((f) => ({
    file: path.relative(cwd, f.name),
    total: f.assertionResults.length,
    passed: f.assertionResults.filter((a) => a.status === "passed").length,
    failed: f.assertionResults.filter((a) => a.status === "failed").length,
  }))
  .sort((a, b) => a.file.localeCompare(b.file));
const result = { recordedAt: new Date().toISOString(), commit, total: raw.numTotalTests, passed: raw.numPassedTests, failed: raw.numFailedTests, files };
mkdirSync("src/generated", { recursive: true });
writeFileSync("src/generated/test-results.json", JSON.stringify(result, null, 2) + "\n");
console.log(`Recorded ${result.passed}/${result.total} tests passing at commit ${commit}.`);
if (result.failed > 0) process.exit(1);
