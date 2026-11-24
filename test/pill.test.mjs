// Browser test (Chromium through Playwright) of the status pill, in en, fr, de, hu, el and ru from 190 to 500 px,
// with the card's own title and a long one, on the full card and the mini card (compact and expanded): the pill sits
// right after the title only beside a whole title (never an ellipsised title next to it), its label is whole or it
// shows its dot alone (always its dot alone at 200 px or less), and nothing of the title block leaves the banner or
// reaches its timeline strip. Skipped when Playwright or Chromium is not installed, except in CI, where it must run.
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { HA_ELEMENTS } from "../scripts/screenshots/harness.mjs";
import { mockHass, NOW } from "../scripts/screenshots/mock.mjs";
import { source } from "./source.mjs";

const src = source;

let browser;
let skip = false;
before(async () => {
  try {
    const { chromium } = await import("playwright");
    browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  } catch (err) {
    if (process.env.CI) throw err;
    skip = `Chromium not available: ${err.message.split("\n")[0]}`;
  }
});
after(() => browser?.close());

// In-page audit of the header (string spliced into page.evaluate): every title block with a status pill —
// the pill on the title row only beside a whole title, its label whole or its dot alone (≤ 200 px: dot alone),
// nothing of the title block below the banner's ground strip or outside the banner.
const pillAudit = (r, width, pillSel, nameSel, groundSel, bannerSel = ".banner") => {
  const res = [];
  const shown = (e) => e && e.getClientRects().length && getComputedStyle(e).visibility !== "hidden";
  const cut = (e) => [e, ...e.querySelectorAll("*")].some((x) => shown(x) && x.clientWidth > 1 && getComputedStyle(x).overflow !== "visible" && x.scrollWidth > x.clientWidth + 1);
  const pills = [...r.querySelectorAll(pillSel)].filter(shown);
  if (!pills.length) return ["no pill"];
  for (const pill of pills) {
    const pb = pill.getBoundingClientRect();
    const dot = pb.width < 30;
    if (width <= 200 && !dot) res.push(`pill "${pill.textContent.trim()}" not a dot at ${width}px`);
    if (!dot && cut(pill)) res.push(`pill "${pill.textContent.trim()}" label cut`);
    const name = pill.parentElement.querySelector(nameSel) || pill.closest(".titles")?.querySelector(nameSel);
    if (shown(name)) {
      const nb = name.getBoundingClientRect();
      const onRow = Math.abs(pb.top + pb.height / 2 - (nb.top + nb.height / 2)) < nb.height / 2;
      const range = document.createRange();
      range.selectNodeContents(name);
      if (onRow && range.getBoundingClientRect().width > nb.width + 0.01) res.push(`title "${name.textContent.trim()}" ellipsised beside the pill`);
    }
    const banner = pill.closest(bannerSel);
    if (!banner) continue;
    const bb = banner.getBoundingClientRect();
    const floor = banner.querySelector(groundSel)?.getBoundingClientRect().top ?? bb.bottom;
    const block = pill.closest(".titles") || pill.parentElement;
    for (const x of [block, ...block.children, ...block.querySelectorAll(":scope > .trow > *")]) {
      if (!shown(x)) continue;
      const xb = x.getBoundingClientRect();
      if (!xb.width || !xb.height) continue;
      if (xb.bottom > floor + 0.5 || xb.top < bb.top - 0.5 || xb.right > bb.right + 0.5 || xb.left < bb.left - 0.5) {
        res.push(`${x.className || x.tagName} outside the banner above its ground strip`);
        break;
      }
    }
  }
  return res;
};

test("status pill beside a whole title or under the statistics, label whole or dot alone, inside the banner", { timeout: 300000 }, async (t) => {
  if (skip) return t.skip(skip);
  const page = await browser.newPage({ viewport: { width: 1200, height: 1200 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.setFixedTime(new Date(NOW));
  await page.setContent("<!doctype html><body style='margin:0;font-family:Roboto,Arial,sans-serif'></body>");
  await page.addScriptTag({ content: HA_ELEMENTS({}) });
  await page.addScriptTag({ content: src });
  const failures = await page.evaluate(
    async ({ hass, audit }) => {
      const pillAudit = new Function(`return (${audit})`)();
      const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const res = [];
      for (const [type, zoom] of [["scheduler-card", false], ["scheduler-mini-card", false], ["scheduler-mini-card", true]])
        for (const language of ["en", "fr", "de", "hu", "el", "ru"])
          for (const width of [190, 245, 300, 400, 460, 500])
            for (const title of [undefined, "Heating and hot water schedules"]) {
              document.body.replaceChildren();
              const box = document.createElement("div");
              box.style.width = `${width}px`;
              document.body.appendChild(box);
              const el = document.createElement(type);
              el.setConfig({ type: `custom:${type}`, language, ...(title ? { title } : {}) });
              el.hass = { ...hass, themes: { darkMode: false }, callService: async () => {}, callWS: async (msg) => (msg.type === "scheduler" ? hass._ws : hass._ws.find((s) => s.schedule_id === msg.schedule_id)) };
              box.appendChild(el);
              if (zoom) el.shadowRoot.querySelector(".zoom").dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true, detail: 1 }));
              await new Promise((r) => setTimeout(r, 20));
              await frame();
              await frame();
              const what = `${type}${zoom ? " zoomed" : ""} ${language} ${width}px${title ? " long title" : ""}`;
              for (const f of pillAudit(el.shadowRoot, width, ".banner .chip.status", ".name", ".strip")) res.push(`${what}: ${f}`);
            }
      return res;
    },
    { hass: mockHass(), audit: pillAudit.toString() },
  );
  await page.close();
  assert.deepEqual([...failures, ...errors], []);
});
