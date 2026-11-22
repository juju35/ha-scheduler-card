// The captures of the README, shared by the screenshot scripts and the test that flags orphan files.
import { at, MULTI_ACTIONS } from "./mock.mjs";

const pair = (file, extra = {}) => [
  { file, theme: "light", ...extra },
  { file: `${file}-dark`, theme: "dark", ...extra },
];
const HEATING = '.row[data-open="switch.schedule_living_room_heating"]';
const AWAY = '.row[data-open="switch.schedule_away_mode"]';
const GARDEN = '.row[data-open="switch.schedule_garden_lights"]';

export const FULL = 460;

// The condition status captures: the heating's conditions met, the water heater waiting for its tracked condition,
// the garden lights skipped (an untracked condition not met).
export const CONDITIONS_HASS = {
  values: { "sensor.outdoor_temperature": "18" },
  conditions: {
    water_heater: { track: true },
    garden_lights: { conditions: [{ entity_id: "sensor.outdoor_temperature", match_type: "below", value: 10 }] },
  },
};
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
  // The garden lights on two lights with their own brightness (#23): the schedule's entities above the times, with
  // the picker opened by Change…
  ...pair("card-edit-entities", {
    tag: "scheduler-card",
    config: {},
    hass: { actions: MULTI_ACTIONS },
    clicks: [GARDEN, '.blk[data-slot="0"]', '[data-action="change-entities"]'],
  }),
  // …and the slot's action, entity by entity (the popup scrolled down).
  ...pair("card-edit-actions", { tag: "scheduler-card", config: {}, hass: { actions: MULTI_ACTIONS }, clicks: [GARDEN, '.blk[data-slot="0"]'], scroll: ".modal" }),
  // show_entities: the entities' names under each tile's state line.
  ...pair("card-entities", { tag: "scheduler-card", config: { show_entities: true }, hass: { actions: MULTI_ACTIONS } }),
  // A new schedule.
  ...pair("card-new", { tag: "scheduler-card", config: {}, clicks: ['[data-action="new"]'], min: 720 }),
  // At night: the timeline under a night sky (forced: automatic follows the theme alone).
  ...pair("card-night", { tag: "scheduler-card", config: { illustration_theme: "night" }, now: at("23:10") }),
  // show_condition_status (still: no pulse).
  ...pair("card-conditions", {
    tag: "scheduler-card",
    config: { show_condition_status: true, condition_status_animation: false },
    hass: CONDITIONS_HASS,
  }),
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
  // show_condition_status: the dot of conditions met pulsing.
  ...pair("condition-status"),
];

export const FILES = [...SHOTS.map((s) => `${s.file}.png`), ...GIFS.map((g) => `${g.file}.gif`)];
