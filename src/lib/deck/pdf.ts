import "server-only";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { HttpError } from "@/lib/api";
import { SLIDE_H, SLIDE_W } from "./styles";

const LOCAL_CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

/** Turns the deck's HTML into a PDF with one slide per page. On Vercel it uses a bundled headless Chromium. */
export async function htmlToPdf(html: string): Promise<Buffer> {
  const onVercel = !!process.env.VERCEL;
  let browser: Awaited<ReturnType<typeof puppeteer.launch>>;
  try {
    browser = await puppeteer.launch(
      onVercel
        ? { args: await puppeteer.defaultArgs({ args: chromium.args, headless: "shell" }), executablePath: await chromium.executablePath(), headless: "shell" }
        : { args: ["--no-sandbox"], executablePath: LOCAL_CHROME, headless: true },
    );
  } catch (e) {
    const why = e instanceof Error ? e.message.replace(/\s+/g, " ").slice(0, 180) : "unknown";
    console.error("[deck] browser did not start:", why);
    throw new HttpError(503, `The PDF builder could not start (${why}). Open Preview and use Save as PDF instead.`);
  }
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: SLIDE_W, height: SLIDE_H, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: "load", timeout: 20_000 });
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({ width: `${SLIDE_W}px`, height: `${SLIDE_H}px`, printBackground: true, preferCSSPageSize: true });
    return Buffer.from(pdf);
  } finally {
    await browser.close().catch(() => undefined);
  }
}
