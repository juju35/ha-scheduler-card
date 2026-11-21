// Shared by the screenshot scripts: theme variables, <ha-card> / <ha-icon> / <ha-switch> stand-ins, a fixed clock
// and the render loop.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as mdi from "@mdi/js";
import { chromium } from "playwright";
import { mockHass, NOW } from "./mock.mjs";

export const root = fileURLToPath(new URL("../..", import.meta.url));
// The captures' folder (not in git until the first capture is committed).
mkdirSync(`${root}screenshots`, { recursive: true });
// Read on first use: the tests import writeIfChanged without a built bundle.
let bundle;
const cardJs = () => (bundle ??= readFileSync(`${root}dist/scheduler-card.js`, "utf8"));

// Every mdi:* icon the card or the mock data can use, as SVG paths for the <ha-icon> stand-in.
const iconsFor = (extra) => {
  const icons = {};
  for (const name of new Set([...cardJs().match(/mdi:[a-z0-9-]+/g), ...extra])) {
    const key = `mdi${name.slice(4).replace(/(^|-)([a-z0-9])/g, (_, __, c) => c.toUpperCase())}`;
    if (mdi[key]) icons[name.slice(4)] = mdi[key];
  }
  return icons;
};

const THEMES = {
  light: {
    "--primary-background-color": "#e8eaed", "--secondary-background-color": "#f1f1f1", "--card-background-color": "#ffffff",
    "--primary-text-color": "#212121", "--secondary-text-color": "#727272", "--divider-color": "rgba(0,0,0,.12)",
  },
  dark: {
    "--primary-background-color": "#111111", "--secondary-background-color": "#282828", "--card-background-color": "#1c1c1c",
    "--primary-text-color": "#e1e1e1", "--secondary-text-color": "#9b9b9b", "--divider-color": "rgba(225,225,225,.12)",
  },
};
const COMMON = { "--primary-color": "#03a9f4", "--success-color": "#43a047", "--warning-color": "#ffa600", "--error-color": "#db4437" };

// <ha-switch> like Home Assistant's: a 36 × 14 track and a 20 px knob, the primary colour when on; a click toggles
// it and fires "change".
export const HA_ELEMENTS = (icons) => `
{
const MOCK_ICONS = ${JSON.stringify(icons)};
customElements.define("ha-card", class extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" }).innerHTML =
      "<style>:host{display:block;background:var(--ha-card-background,var(--card-background-color));" +
      "border-radius:var(--ha-card-border-radius,12px);border:1px solid var(--divider-color);color:var(--primary-text-color);overflow:hidden}</style><slot></slot>";
  }
});
customElements.define("ha-icon", class extends HTMLElement {
  static get observedAttributes() { return ["icon"]; }
  connectedCallback() { this._draw(); }
  attributeChangedCallback() { this._draw(); }
  _draw() {
    const path = MOCK_ICONS[(this.getAttribute("icon") || "").replace("mdi:", "")] || "";
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = '<style>:host{display:inline-flex}</style><svg viewBox="0 0 24 24" style="width:var(--mdc-icon-size,24px);height:var(--mdc-icon-size,24px);fill:currentColor"><path d="' + path + '"/></svg>';
  }
});
customElements.define("ha-switch", class extends HTMLElement {
  static get observedAttributes() { return ["checked"]; }
  constructor() {
    super();
    this.attachShadow({ mode: "open" }).innerHTML =
      "<style>:host{display:inline-block;position:relative;width:36px;height:20px;cursor:pointer}" +
      ".t{position:absolute;left:0;right:0;top:3px;height:14px;border-radius:7px;background:rgba(158,158,158,.5)}" +
      ".k{position:absolute;top:0;left:0;width:20px;height:20px;border-radius:50%;background:#fafafa;box-shadow:0 1px 3px rgba(0,0,0,.3)}" +
      ".on .t{background:color-mix(in srgb,var(--primary-color) 50%,transparent)}.on .k{left:16px;background:var(--primary-color)}</style>" +
      '<span class="w"><span class="t"></span><span class="k"></span></span>';
    this.addEventListener("click", () => { this.checked = !this.checked; this.dispatchEvent(new Event("change", { bubbles: true, composed: true })); });
  }
  attributeChangedCallback() { this.checked = this.hasAttribute("checked"); }
  get checked() { return this._c; }
  set checked(v) { this._c = !!v; this.shadowRoot.querySelector(".w").classList.toggle("on", !!v); }
});
}`;

const pageHtml = (theme, width) => `<!doctype html><html><head><meta charset="utf-8">
<style>
  :root { ${Object.entries({ ...THEMES[theme], ...COMMON }).map(([k, v]) => `${k}:${v};`).join("")} }
  body { margin: 0; padding: 16px; background: var(--primary-background-color); color: var(--primary-text-color);
         font-family: Roboto, "Segoe UI", Helvetica, Arial, sans-serif; width: ${width}px; }
</style></head><body><div id="root"></div></body></html>`;

// A light shot and its dark twin, both in English.
export const pair = (file, extra = {}) => [
  { file, theme: "light", ...extra },
  { file: `${file}-dark`, theme: "dark", ...extra },
];

export const launch = () => chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

// A page ready to host a card, its clock fixed at `now` (the mock's NOW by default).
export const openPage = async (browser, { theme, width, label = "", now = NOW }) => {
  const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 1000, height: 1600 } });
  page.on("pageerror", (err) => console.error(`pageerror${label ? ` (${label})` : ""}: ${err.message}`));
  await page.clock.setFixedTime(new Date(now));
  await page.setContent(pageHtml(theme, width));
  await page.addScriptTag({ content: HA_ELEMENTS(iconsFor(["mdi:fire", "mdi:blinds", "mdi:lightbulb", "mdi:water", "mdi:home"])) });
  await page.addScriptTag({ content: PAGE_HASS });
  await page.addScriptTag({ content: cardJs() });
  return page;
};

// The functions of the mock hass, added in the page: the websocket commands, the services (no-op) and the
// entity state formatter.
const PAGE_HASS = `window.__mockHass = (h) => {
  h.callService = async () => {};
  h.callWS = async (msg) => (msg.type === "scheduler" ? h._ws : msg.type === "scheduler/item" ? h._ws.find((s) => s.schedule_id === msg.schedule_id) : null);
  h.formatEntityState = (s) => {
    const v = String(s.state).replace(/_/g, " ");
    return v.charAt(0).toUpperCase() + v.slice(1);
  };
  return h;
};`;

// Creates the card in the page, then clicks each selector of `clicks` (a mouse click: no focus ring in the shot).
export const mountCard = (page, { tag, config, dark = false, now = NOW, clicks = [], hass: extra = {} }) =>
  page.evaluate(
    async ({ tag, config, hass, clicks }) => {
      const el = document.createElement(tag);
      el.setConfig({ type: `custom:${tag}`, ...config });
      el.hass = window.__mockHass(hass);
      document.getElementById("root").appendChild(el);
      for (const sel of clicks) {
        el.shadowRoot.querySelector(sel).dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true, detail: 1 }));
        await new Promise((r) => setTimeout(r, 30));
      }
    },
    { tag, config, hass: mockHass({ dark, now, ...extra }), clicks },
  );

// Moves the page's clock and gives the card a hass of that moment (the sun's state follows).
export const setClock = async (page, now, dark = false) => {
  await page.clock.setFixedTime(new Date(now));
  await page.evaluate(
    (hass) => {
      document.querySelector("#root > *").hass = window.__mockHass(hass);
    },
    mockHass({ dark, now }),
  );
};

// Clicks a selector of the card's shadow tree.
export const click = (page, sel) =>
  page.evaluate((sel) => {
    const el = document.querySelector("#root > *");
    el.shadowRoot.querySelector(sel).dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true, detail: 1 }));
  }, sel);

// The card on the theme background, with the body's 16px padding around it; `banner` clips to the illustration.
export const cardClip = async (page, width, { banner = false, min = 0 } = {}) => {
  const box = await page.locator("#root").boundingBox();
  if (!banner) return { x: 0, y: 0, width: width + 32, height: Math.max(min, Math.ceil(box.height) + 32) };
  const h = await page.evaluate(() => document.querySelector("#root > *").shadowRoot.querySelector(".banner").getBoundingClientRect().bottom);
  return { x: 0, y: 0, width: width + 32, height: Math.ceil(h) + 16 };
};

// The period every animation of the card divides.
export const PERIOD = 12000;

// Pauses every CSS animation of the page at `frac` of the period (every animation of the card lasts a divisor of
// it, so a recording stepped this way loops seamlessly at its real speed). The card's shadow trees are walked by hand.
export const freeze = (page, frac, { offset = 3 } = {}) =>
  page.evaluate(
    ({ f, period, offset }) => {
      const anims = [];
      const walk = (root) => {
        for (const el of root.querySelectorAll("*")) {
          anims.push(...el.getAnimations());
          if (el.shadowRoot) walk(el.shadowRoot);
        }
      };
      walk(document);
      for (const a of anims) {
        a.pause();
        a.currentTime = offset * period + f * period;
      }
    },
    { f: frac, period: PERIOD, offset },
  );

// Writes a PNG screenshot to `path` only when its pixels differ from the file already there. PNG encoding is not
// byte-stable from one run (or machine) to the next: comparing bytes would commit pictures that did not change.
export const writeIfChanged = async (page, path, png) => {
  if (existsSync(path)) {
    const same = await page.evaluate(
      async ([a, b]) => {
        const pixels = async (b64) => {
          const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
          const bmp = await createImageBitmap(blob, { colorSpaceConversion: "none", premultiplyAlpha: "none" });
          const ctx = new OffscreenCanvas(bmp.width, bmp.height).getContext("2d");
          ctx.drawImage(bmp, 0, 0);
          return { w: bmp.width, h: bmp.height, d: ctx.getImageData(0, 0, bmp.width, bmp.height).data };
        };
        const [x, y] = await Promise.all([pixels(a), pixels(b)]);
        if (x.w !== y.w || x.h !== y.h) return false;
        for (let i = 0; i < x.d.length; i++) if (x.d[i] !== y.d[i]) return false;
        return true;
      },
      [readFileSync(path).toString("base64"), png.toString("base64")],
    );
    if (same) return false;
  }
  writeFileSync(path, png);
  return true;
};
