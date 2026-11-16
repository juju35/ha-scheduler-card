// Browser test (Chromium through Playwright) of the cards' layout: at their minimum width (8 columns of a sections
// view on a phone for the full card, 6 for the mini card) and wider, in long languages and both themes, with and
// without the illustration, on today's timeline and on the weekly grid: nothing leaves the card, no text lies under
// the scenery, the titles keep a few characters, the header icon keeps its 40 px, and the popups open at the top of
// the card. Skipped when Playwright or Chromium is not installed, except in CI, where it must run.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { HA_ELEMENTS } from "../scripts/screenshots/harness.mjs";
import { mockHass, NOW } from "../scripts/screenshots/mock.mjs";

const src = readFileSync(new URL("../src/scheduler-card.js", import.meta.url), "utf8");
const THEMES = {
  light: { "--card-background-color": "#fff", "--primary-text-color": "#212121", "--secondary-text-color": "#727272", "--secondary-background-color": "#f1f1f1" },
  dark: { "--card-background-color": "#1c1c1c", "--primary-text-color": "#e1e1e1", "--secondary-text-color": "#9b9b9b", "--secondary-background-color": "#282828" },
};

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

const measure = async (cases) => {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1200 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.setFixedTime(new Date(NOW));
  await page.setContent("<!doctype html><body style='margin:0;font-family:Roboto,Arial,sans-serif'></body>");
  await page.addScriptTag({ content: HA_ELEMENTS({}) });
  await page.addScriptTag({ content: src });
  const hass = mockHass();
  const out = [];
  for (const c of cases) {
    out.push(
      await page.evaluate(
        async ({ c, hass, THEMES }) => {
          const box = document.createElement("div");
          box.style.cssText = `width:${c.width}px;${Object.entries(THEMES[c.theme]).map(([k, v]) => `${k}:${v}`).join(";")}`;
          document.body.appendChild(box);
          const el = document.createElement(c.type);
          el.setConfig({ type: `custom:${c.type}`, language: c.lang, ...c.config });
          el.hass = {
            ...hass,
            themes: { darkMode: c.theme === "dark" },
            callService: async () => {},
            callWS: async (msg) => (msg.type === "scheduler" ? hass._ws : hass._ws.find((s) => s.schedule_id === msg.schedule_id)),
          };
          box.appendChild(el);
          const sr = el.shadowRoot;
          const click = async (sel) => {
            sr.querySelector(sel)?.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true, detail: 1 }));
            await new Promise((r) => setTimeout(r, 20));
          };
          for (const sel of c.clicks || []) await click(sel);
          const card = sr.querySelector("ha-card").getBoundingClientRect();
          const rect = (n) => n.getBoundingClientRect();
          const shown = (n) => n.getClientRects().length > 0 && getComputedStyle(n).visibility !== "hidden" && getComputedStyle(n).display !== "none";
          // What shows of an element: its box clipped by its ancestors that hide their overflow (an ellipsis, the tab bar).
          const visible = (n) => {
            let { left, right } = rect(n);
            for (let p = n.parentElement; p && p.localName !== "ha-card"; p = p.parentElement) {
              if (getComputedStyle(p).overflowX !== "visible") {
                left = Math.max(left, rect(p).left);
                right = Math.min(right, rect(p).right);
              }
            }
            return { left, right };
          };
          const outside = [...sr.querySelectorAll("*")]
            .filter((n) => shown(n) && !n.closest("svg") && !n.closest(".strip"))
            .filter((n) => {
              const v = visible(n);
              return v.right > v.left && (v.right > card.right + 0.5 || v.left < card.left - 0.5);
            })
            .map((n) => n.className?.baseVal ?? n.className);
          const scene = sr.querySelector(".scene");
          const head = sr.querySelector(".head");
          const under =
            scene && shown(scene) && head
              ? [...head.querySelectorAll("*")].filter((n) => shown(n) && n.children.length === 0 && rect(n).right > rect(scene).left + 0.5).map((n) => n.textContent)
              : [];
          const name = sr.querySelector(".head .name, .header .name, .title");
          const badge = sr.querySelector(".head .badge, .header .badge, .mini .badge");
          const modal = sr.querySelector(".modal");
          const r = {
            outside,
            under,
            nameWidth: name ? rect(name).width : 0,
            ch: name ? parseFloat(getComputedStyle(name).fontSize) * 2 : 0,
            badge: badge ? [Math.round(rect(badge).width), Math.round(rect(badge).height)] : null,
            modalTop: modal ? rect(modal).top - card.top : null,
            modalOut: modal ? rect(modal).right > card.right + 0.5 || rect(modal).left < card.left - 0.5 : false,
          };
          box.remove();
          return r;
        },
        { c, hass, THEMES },
      ),
    );
  }
  await page.close();
  assert.deepEqual(errors, []);
  return out;
};

const LANGS = ["en", "de", "el", "sr", "lv", "hu", "pt"];
const matrix = (variants, widths) => {
  const cases = [];
  for (const v of variants) for (const lang of LANGS) for (const theme of ["light", "dark"]) for (const width of widths) cases.push({ ...v, lang, theme, width });
  return cases;
};
const HEATING = '.row[data-open="switch.schedule_living_room_heating"]';

test("at their minimum width and wider, nothing leaves the card and no text lies under the scenery", { timeout: 180000 }, async (t) => {
  if (skip) return t.skip(skip);
  const cases = [
    ...matrix(
      [
        { type: "scheduler-card", config: {} },
        { type: "scheduler-card", config: {}, clicks: [HEATING] },
        { type: "scheduler-card", config: { illustration: false } },
      ],
      [208, 245, 300, 380, 460, 560],
    ),
    ...matrix([{ type: "scheduler-mini-card", config: {} }], [156, 208, 245, 300, 380]),
    ...matrix([{ type: "scheduler-mini-card", config: {}, clicks: [".zoom"] }], [208, 300, 460]),
  ];
  const results = await measure(cases);
  results.forEach((r, i) => {
    const c = cases[i];
    const at = `${c.type} ${JSON.stringify(c.config)} ${(c.clicks || []).join(" ")} ${c.lang} ${c.theme} ${c.width}px`;
    assert.deepEqual(r.outside, [], `outside the card: ${at}`);
    assert.deepEqual(r.under, [], `text under the scenery: ${at}`);
    assert.ok(r.nameWidth >= r.ch, `title ${r.nameWidth.toFixed(0)} px: ${at}`);
    assert.deepEqual(r.badge, [40, 40], `header icon: ${at}`);
  });
});

test("the popups open at the top of the card and stay in it", { timeout: 120000 }, async (t) => {
  if (skip) return t.skip(skip);
  const cases = matrix(
    [
      { type: "scheduler-card", config: {}, clicks: [HEATING, '.blk[data-slot="3"]'] },
      { type: "scheduler-card", config: {}, clicks: ['[data-action="new"]'] },
      { type: "scheduler-mini-card", config: {}, clicks: [".zoom", '[data-action="new"]'] },
    ],
    [245, 460],
  );
  const results = await measure(cases);
  results.forEach((r, i) => {
    const c = cases[i];
    const at = `${c.type} ${(c.clicks || []).join(" ")} ${c.lang} ${c.theme} ${c.width}px`;
    assert.ok(r.modalTop !== null && r.modalTop <= 12, `popup top ${r.modalTop}: ${at}`);
    assert.equal(r.modalOut, false, `popup outside the card: ${at}`);
  });
});
