import { execSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";

const BINARY = /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|otf|pdf|zip|gz|lock)$/i;

/** Every file git would include (tracked, plus untracked that are not ignored). */
export function repoFiles(): string[] {
  const out = execSync("git ls-files -co --exclude-standard", { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return out
    .split("\n")
    .filter(Boolean)
    .filter((f) => !BINARY.test(f) && f !== "package-lock.json")
    .filter((f) => {
      try {
        return statSync(f).isFile() && statSync(f).size < 5 * 1024 * 1024;
      } catch {
        return false;
      }
    });
}

export function readText(f: string): string {
  return readFileSync(f, "utf8");
}
