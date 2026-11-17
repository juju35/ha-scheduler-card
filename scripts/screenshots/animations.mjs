// Records the card's animations into screenshots/*.gif, light and dark (needs ffmpeg).
// Usage: npm install && npm run build && node scripts/screenshots/animations.mjs
// The CSS animations are paused and stepped frame by frame (every looping animation of the card lasts a divisor of
// its 12 s period), and the clock is moved by hand, so every GIF is the same on every machine.
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cardClip, click, launch, mountCard, openPage, PERIOD, root, setClock } from "./harness.mjs";
import { FULL, GIFS } from "./list.mjs";
import { at } from "./mock.mjs";

const FPS = 10;
const frameName = (i) => `f${String(i).padStart(3, "0")}.png`;

// Every decoded frame (RGBA) and its timing, as ffmpeg's per-frame MD5 list: equal lists, same animation.
const decodedFrames = (file) =>
  execFileSync("ffmpeg", ["-loglevel", "error", "-i", file, "-pix_fmt", "rgba", "-f", "framemd5", "-"], { encoding: "utf8" })
    .split("\n")
    .filter((line) => line && !line.startsWith("#"))
    .join("\n");

// A deterministic GIF: the palette computed from the frames only, ordered (Bayer) dithering, bit-exact muxing. The file
// in place is only replaced when its decoded frames differ.
const encode = (dir, out, width) => {
  const gif = join(dir, "out.gif");
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error", "-framerate", String(FPS), "-i", join(dir, "f%03d.png"),
    "-vf", `scale=${width + 32}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=4`,
    "-fflags", "+bitexact", "-flags", "+bitexact", "-loop", "0", gif,
  ]);
  const target = `${root}${out}`;
  const same = existsSync(target) && decodedFrames(target) === decodedFrames(gif);
  if (!same) copyFileSync(gif, target);
  console.log(`${out}${same ? " (unchanged)" : ""}`);
};

// Pauses every animation: the looping ones at `t` ms of their period, the view's slide-in at `sinceView` ms.
const step = (page, t, sinceView) =>
  page.evaluate(
    ({ t, sinceView, period }) => {
      const walk = (root, out) => {
        for (const el of root.querySelectorAll("*")) {
          out.push(...el.getAnimations());
          if (el.shadowRoot) walk(el.shadowRoot, out);
        }
        return out;
      };
      for (const a of walk(document, [])) {
        a.pause();
        a.currentTime = a.animationName === "sc-in" ? Math.max(0, sinceView) : 3 * period + (t % period);
      }
    },
    { t, sinceView, period: PERIOD },
  );

const record = async (page, dir, frames, clip, onFrame) => {
  for (let i = 0; i < frames; i++) {
    await onFrame(i);
    await page.screenshot({ path: join(dir, frameName(i)), clip, animations: "allow" });
  }
};

const browser = await launch();
for (const g of GIFS) {
  const dark = g.theme === "dark";
  const page = await openPage(browser, { theme: g.theme, width: FULL, label: g.file });
  const dir = mkdtempSync(join(tmpdir(), "sc-frames-"));
  if (g.file.startsWith("day-cycle")) {
    // 48 frames, every half hour of the day: the "now" cursor crosses the timeline, under the day, evening and night skies.
    await mountCard(page, { tag: "scheduler-card", config: {}, dark, now: at("00:00") });
    await page.waitForTimeout(300);
    const clip = await cardClip(page, FULL, { banner: true });
    const frames = 48;
    await record(page, dir, frames, clip, async (i) => {
      await setClock(page, at("00:00") + i * 30 * 60000, dark);
      await step(page, (i / frames) * PERIOD, 1e6);
    });
  } else {
    // 12 s: the timeline, a click on the heating row, its tab bar to the garden lights, then back.
    await mountCard(page, { tag: "scheduler-card", config: {}, dark });
    await page.waitForTimeout(300);
    const clip = await cardClip(page, FULL);
    const frames = (PERIOD / 1000) * FPS;
    const script = {
      30: '.row[data-open="switch.schedule_living_room_heating"]',
      65: '.tab[data-tab="switch.schedule_garden_lights"]',
      90: '[data-action="back"]',
    };
    let viewAt = -1e6;
    await record(page, dir, frames, clip, async (i) => {
      if (script[i]) {
        await click(page, script[i]);
        viewAt = i;
      }
      await step(page, (i / FPS) * 1000, ((i - viewAt) / FPS) * 1000);
    });
  }
  encode(dir, `screenshots/${g.file}.gif`, FULL);
  rmSync(dir, { recursive: true });
  await page.close();
}
await browser.close();
