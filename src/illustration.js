// ---------------------------------------------------------------------------
// The illustration: today's timeline of the schedules, with a "now" cursor
// ---------------------------------------------------------------------------
import { esc } from "./helpers.js";
import { DAY } from "./time.js";

// Every animation of the illustration lasts a divisor of 12 s, so a recording of 12 s loops.

// The hours written under the timeline.
export const SCENE_HOURS = [0, 6, 12, 18, 24];
export const pctOf = (v) => ((v / DAY) * 100).toFixed(2);

// One row of the illustration: a schedule's icon in its colour, its track, today's blocks (the one running now
// pulses), dots for its one-off actions. `rows`: [{ icon, color, on, bits: [{ a, b, c, now } | { at, c }] }].
export const sceneHtml = (rows, nowMin) => {
  const n = Math.max(1, rows.length);
  // The rows centred in the 54 px between the top of the scene and the hours.
  const top0 = 4 + (54 - (n * 18 - 10)) / 2;
  const rowHtml = rows
    .map((r, i) => {
      const bits = r.bits
        .map((b) =>
          b.at !== undefined
            ? `<i class="pt" style="left:${pctOf(b.at)}%;--c:${b.c}"></i>`
            : `<i class="bk${b.now ? " on" : ""}" style="left:${pctOf(b.a)}%;width:${pctOf(b.b - b.a)}%;--c:${b.c}"></i>`,
        )
        .join("");
      return `<div class="tr${r.on ? "" : " off"}" style="top:${(top0 + i * 18).toFixed(1)}px;--b:${r.color}">
        <span class="ri"><ha-icon icon="${esc(r.icon)}"></ha-icon></span><span class="tk">${bits}</span></div>`;
    })
    .join("");
  return `<div class="scene" aria-hidden="true"><div class="in">
      ${SCENE_HOURS.map((h) => `<span class="gl" style="left:${(h / 24) * 100}%"></span><span class="hr" style="left:${(h / 24) * 100}%">${String(h).padStart(2, "0")}h</span>`).join("")}
      ${rowHtml}
      <span class="cur" style="left:${pctOf(nowMin)}%"></span>
    </div></div>`;
};
