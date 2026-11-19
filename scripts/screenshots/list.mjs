// The captures of the README, shared by the screenshot scripts and the test that flags orphan files.
import { at } from "./mock.mjs";

const pair = (file, extra = {}) => [
  { file, theme: "light", ...extra },
  { file: `${file}-dark`, theme: "dark", ...extra },
];
const HEATING = '.row[data-open="switch.schedule_living_room_heating"]';
const AWAY = '.row[data-open="switch.schedule_away_mode"]';

export const FULL = 460;
export const MINI = 380;

export const SHOTS = [
  // Today's timeline, Monday 17:40: the heating in its comfort slot, the garden lights due at 18:00.
  ...pair("card", { tag: "scheduler-card", config: {} }),
  // The weekly grid of a schedule, opened by a click on its row.
  ...pair("card-week", { tag: "scheduler-card", config: {}, clicks: [HEATING] }),
  // The slot editor, at the top of the card.
  ...pair("card-edit", { tag: "scheduler-card", config: {}, clicks: [HEATING, '.blk[data-slot="3"]'], min: 520 }),
  // A slot starting after sunrise (with today's time), and the day presets.
  ...pair("card-edit-sun", { tag: "scheduler-card", config: {}, clicks: [AWAY, '.blk[data-slot="0"]'], min: 620 }),
  // A schedule's options: name, tags, conditions, dates, after the last slot.
  ...pair("card-options", { tag: "scheduler-card", config: {}, clicks: [HEATING, '.blk[data-slot="3"]', '[data-mtab="options"]'], min: 760 }),
  // A new schedule.
  ...pair("card-new", { tag: "scheduler-card", config: {}, clicks: ['[data-action="new"]'], min: 720 }),
  // At night: the timeline under a night sky (forced: automatic follows the theme alone).
  ...pair("card-night", { tag: "scheduler-card", config: { illustration_theme: "night" }, now: at("23:10") }),
  // Without the illustration.
  ...pair("card-classic", { tag: "scheduler-card", config: { illustration: false } }),
  // The mini card, and unfolded by its detail button.
  ...pair("mini-card", { tag: "scheduler-mini-card", config: {}, width: MINI }),
  ...pair("mini-card-zoom", { tag: "scheduler-mini-card", config: {}, clicks: [".zoom"] }),
];

export const GIFS = [
  // The timeline through the day: its "now" cursor moving, the running slots pulsing, day, evening and night skies.
  ...pair("day-cycle"),
  // Today's timeline → a schedule's weekly grid → another schedule's tab → back.
  ...pair("view-switch"),
];

export const FILES = [...SHOTS.map((s) => `${s.file}.png`), ...GIFS.map((g) => `${g.file}.gif`)];
