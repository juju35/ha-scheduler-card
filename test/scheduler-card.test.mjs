import assert from "node:assert/strict";
import { test } from "node:test";
import { at, mockHass, NOW } from "../scripts/screenshots/mock.mjs";
import { load } from "./load.mjs";

const sc = load([
  "parseTime",
  "slotsOf",
  "runsOn",
  "actionInfo",
  "segmentsOf",
  "defaultValue",
  "scheduleModel",
  "pickSchedules",
  "upcoming",
  "weekTotals",
  "cleanSlot",
  "weekdaysPayload",
  "domainActions",
  "discover",
  "zoned",
  "STRINGS",
  "SchedulerCard",
  "SchedulerMiniCard",
  "SchedulerCardEditor",
  "SchedulerMiniCardEditor",
  "document",
  "window",
]);

// Values built in the card's context have its own Array and Object: compared as plain data.
const plain = (v) => JSON.parse(JSON.stringify(v));
const eq = (actual, expected, msg) => assert.deepEqual(plain(actual), plain(expected), msg);

const HEATING = "switch.schedule_living_room_heating";
const BLINDS = "switch.schedule_living_room_blinds";
const GARDEN = "switch.schedule_garden_lights";
const WATER = "switch.schedule_water_heater";
const AWAY = "switch.schedule_away_mode";
const BEDROOM = "switch.schedule_bedroom_heating";

// The mock hass with its functions: the websocket answers, recorded service calls, the state formatter.
const hassWith = (opts = {}) => {
  const h = mockHass(opts);
  h.calls = [];
  h.callService = async (domain, service, data) => {
    h.calls.push([domain, service, data]);
  };
  h.callWS = async (msg) => (msg.type === "scheduler" ? h._ws : msg.type === "scheduler/item" ? h._ws.find((s) => s.schedule_id === msg.schedule_id) : null);
  h.formatEntityState = (s) => s.state.charAt(0).toUpperCase() + s.state.slice(1);
  return h;
};

const card = (Cls = sc.SchedulerCard, config = {}, hass = hassWith(), now = NOW) => {
  const el = new Cls();
  el._nowMs = () => now;
  el.setConfig({ type: "custom:x", ...config });
  el._hass = hass;
  // No DOM in these tests: a render only builds the HTML.
  el._update = function () {
    this._html = this._render();
  };
  return el;
};
const tr = (k, v = {}) => String(sc.STRINGS.en[k]).replace(/\{(\w+)\}/g, (m, x) => (x in v ? v[x] : m));
const model = (id, hass = hassWith(), config = {}) => sc.scheduleModel(hass, config, id, tr, "en");
const nowIn = (ms = NOW) => sc.zoned(ms, "Europe/Paris");

test("times: fixed, relative to the sun, midnight as the end of the day, and invalid ones", () => {
  const sun = { rise: 360, set: 1200 };
  eq(sc.parseTime("07:30:00", sun), { min: 450, sun: false });
  assert.equal(sc.parseTime("7:05", sun).min, 425);
  eq(sc.parseTime("sunrise+00:30:00", sun), { min: 390, sun: true });
  assert.equal(sc.parseTime("sunset-01:00:00", sun).min, 1140);
  assert.equal(sc.parseTime("24:00:00", sun).min, 1440);
  assert.equal(sc.parseTime("noon", sun), null);
  assert.equal(sc.parseTime("12:75", sun), null);
});

test("slots: read from the timeslots and actions attributes, an end at midnight closes the day", () => {
  const h = hassWith();
  const slots = sc.slotsOf(h.states[HEATING].attributes, { rise: 360, set: 1200 });
  assert.equal(slots.length, 5);
  eq([slots[1].start, slots[1].stop], [390, 510]);
  assert.equal(slots[4].stop, 1440);
  assert.equal(slots[1].action.service, "climate.set_temperature");
  assert.equal(slots[1].action.data.temperature, 20);
  const blinds = sc.slotsOf(h.states[BLINDS].attributes, { rise: 360, set: 1200 });
  eq(
    blinds.map((s) => [s.start, s.stop]),
    [
      [450, null],
      [1125, null],
    ],
  );
});

test("days: daily, a list, workday and weekend from the workday sensor (today from its state)", () => {
  const h = hassWith();
  assert.ok([0, 1, 2, 3, 4, 5, 6].every((d) => sc.runsOn(["daily"], d, h)));
  eq(
    [0, 1, 2, 3, 4, 5, 6].filter((d) => sc.runsOn(["mon", "wed"], d, h)),
    [0, 2],
  );
  eq(
    [0, 1, 2, 3, 4, 5, 6].filter((d) => sc.runsOn(["workday"], d, h)),
    [0, 1, 2, 3, 4],
  );
  eq(
    [0, 1, 2, 3, 4, 5, 6].filter((d) => sc.runsOn(["weekend"], d, h)),
    [5, 6],
  );
  // A public holiday on a Monday: the workday sensor is off today.
  h.states["binary_sensor.workday_sensor"] = { ...h.states["binary_sensor.workday_sensor"], state: "off" };
  assert.equal(sc.runsOn(["workday"], 0, h, true), false);
  assert.equal(sc.runsOn(["weekend"], 0, h, true), true);
});

test("actions in words: temperatures, brightness, covers, presets, scripts and other services", () => {
  const h = hassWith();
  h.services = { notify: { mobile_app_phone: { name: "Send a notification" } } };
  const info = (service, data = {}, entity) => sc.actionInfo(h, tr, "en", { service, data }, entity);
  const t20 = info("climate.set_temperature", { temperature: 20 }, "climate.living_room");
  eq([t20.label, t20.short, t20.num, t20.off], ["20 °C", "20°", 20, false]);
  assert.equal(info("climate.set_temperature", { temperature: 20.5 }).label, "20.5 °C");
  assert.equal(info("light.turn_on", { brightness_pct: 60 }).label, "On 60 %");
  assert.equal(info("light.turn_on", { brightness: 255 }).short, "100 %");
  eq([info("light.turn_off").label, info("light.turn_off").off, info("light.turn_off").verb], ["Off", true, true]);
  assert.equal(info("cover.close_cover").off, true);
  assert.equal(info("cover.set_cover_position", { position: 40 }).label, "Position 40 %");
  assert.equal(info("climate.set_preset_mode", { preset_mode: "comfort" }).label, "Comfort");
  assert.equal(info("climate.set_hvac_mode", { hvac_mode: "off" }).off, true);
  assert.equal(info("script.morning_routine").label, "Run");
  assert.equal(info("scene.turn_on").label, "Activate");
  assert.equal(info("input_number.set_value", { value: 3 }).label, "3");
  assert.equal(info("notify.mobile_app_phone", { message: "hi" }).label, "Send a notification");
  // Same service and data, same key, whatever the order of the data.
  assert.equal(info("light.turn_on", { a: 1, b: 2 }).key, info("light.turn_on", { b: 2, a: 1 }).key);
});

test("spans: a slot with an end, a single action until the next one turns it off, a slot over midnight", () => {
  const h = hassWith();
  const m = model(BLINDS, h);
  const { spans, points } = sc.segmentsOf(m.slots, m.infos);
  eq(
    spans.map((s) => [s.a, s.b]),
    [[450, 1125]],
  );
  eq(
    points.map((p) => p.at),
    [1125],
  );
  const night = [{ i: 0, start: 1320, stop: 120, action: { service: "light.turn_on", data: {} } }];
  const infos = new Map([[0, sc.actionInfo(h, tr, "en", night[0].action)]]);
  eq(
    sc.segmentsOf(night, infos).spans.map((s) => [s.a, s.b]),
    [
      [1320, 1440],
      [0, 120],
    ],
  );
});

test("the value of a schedule covering the whole day the longest is its background; colours warm to cool", () => {
  const m = model(HEATING);
  const t17 = [...m.infos.values()].find((i) => i.num === 17);
  const t20 = [...m.infos.values()].find((i) => i.num === 20);
  assert.equal(m.def, t17.key);
  assert.equal(m.colors.get(t20.key), "#ff9800");
  assert.equal(m.colors.get(t17.key), "#00acc1");
  // Gaps in the day: no background.
  assert.equal(model(GARDEN).def, null);
  assert.equal(model(BLINDS).def, null);
});

test("discovery: the scheduler platform's registry entries, else the switch.schedule_* entities", () => {
  const h = hassWith();
  const fallback = sc.discover(h);
  assert.equal(fallback.length, 6);
  // In the registry: only the registered schedules, whatever their entity id, while their state exists.
  const reg = { "switch.heating_plan": { entity_id: "switch.heating_plan", platform: "scheduler" }, "switch.gone": { entity_id: "switch.gone", platform: "scheduler" } };
  const withReg = { ...h, entities: reg, states: { ...h.states, "switch.heating_plan": { entity_id: "switch.heating_plan", state: "on", attributes: {} } } };
  eq(sc.discover(withReg), ["switch.heating_plan"]);
  // Same registry, states changed: the scan is kept, the states are read again.
  eq(sc.discover({ ...withReg, states: h.states }), fallback);
});

test("filters: tags, entities (the schedule's or those it acts on), disabled schedules", () => {
  const h = hassWith();
  const all = sc.discover(h).map((id) => model(id, h));
  assert.equal(all.length, 6);
  const names = (config) => sc.pickSchedules(all, config).map((m) => m.id);
  eq(names({ tags: ["heating"] }), [BEDROOM, HEATING]);
  eq(names({ entities: ["light.garden", BLINDS] }), [GARDEN, BLINDS]);
  assert.ok(!names({ show_disabled: false }).includes(AWAY));
  // Disabled ones last, the others by name.
  assert.equal(names({}).at(-1), AWAY);
  assert.equal(names({})[0], BEDROOM);
});

test("state lines of today's timeline", () => {
  const el = card();
  el._models();
  const line = (id) => el._stateLine(el._all.find((m) => m.id === id), nowIn());
  assert.equal(line(HEATING), "20 °C now · 17 °C at 22:30");
  assert.equal(line(GARDEN), "Off · on at 18:00");
  assert.equal(line(BLINDS), "Open · close at 18:45");
  assert.equal(line(WATER), "Done today · next 02:00");
  assert.equal(line(AWAY), "Disabled");
  assert.equal(line(BEDROOM), "Heat · Comfort at 21:00");
  // Late in the evening: the next action is tomorrow, with its weekday.
  const late = card(sc.SchedulerCard, {}, hassWith({ now: at("23:40") }), at("23:40"));
  late._models();
  assert.equal(late._stateLine(late._all.find((m) => m.id === GARDEN), nowIn(at("23:40"))), "Done today · next 18:00");
  assert.equal(late._stateLine(late._all.find((m) => m.id === AWAY), nowIn(at("23:40"))), "Disabled");
});

test("the next actions of every enabled schedule, soonest first", () => {
  const h = hassWith();
  const models = sc.discover(h).map((id) => model(id, h));
  const next = sc.upcoming(models, nowIn(), h, 3);
  eq(
    next.map((o) => [o.m.name, o.slot.start]),
    [
      ["Garden lights", 1080],
      ["Living room blinds", 1125],
      ["Bedroom heating", 1260],
    ],
  );
  // The disabled away mode is never listed.
  assert.ok(sc.upcoming(models, nowIn(), h, 30).every((o) => o.m.id !== AWAY));
});

test("weekly total: the hours of the values standing out of the background", () => {
  const h = hassWith();
  const m = model(HEATING, h);
  const totals = sc.weekTotals(m, h, m.def);
  eq([...totals.values()], [5 * 7 * 60]);
});

test("timeslots cleaned for the services: no null end, empty conditions or null attribute", () => {
  const out = sc.cleanSlot({
    start: "07:00:00",
    stop: null,
    conditions: [],
    condition_type: null,
    track_conditions: false,
    actions: [{ service: "light.turn_on", entity_id: "light.garden", service_data: {} }],
  });
  eq(JSON.parse(JSON.stringify(out)), { start: "07:00:00", actions: [{ service: "light.turn_on", entity_id: "light.garden" }] });
  const cond = sc.cleanSlot({
    start: "07:00:00",
    stop: "08:00:00",
    conditions: [{ entity_id: "sensor.x", value: 3, match_type: "above", attribute: null }],
    condition_type: "and",
    track_conditions: true,
    actions: [],
  });
  eq(JSON.parse(JSON.stringify(cond.conditions)), [{ entity_id: "sensor.x", value: 3, match_type: "above" }]);
  assert.equal(cond.condition_type, "and");
  assert.equal(cond.track_conditions, true);
});

test("weekdays for the services: daily, the schedule's workday kept, else the days", () => {
  const h = hassWith();
  eq([...sc.weekdaysPayload(new Set([0, 1, 2, 3, 4, 5, 6]), ["mon"], h)], ["daily"]);
  eq([...sc.weekdaysPayload(new Set([0, 1, 2, 3, 4]), ["workday"], h)], ["workday"]);
  eq([...sc.weekdaysPayload(new Set([5, 6]), ["weekend"], h)], ["weekend"]);
  eq([...sc.weekdaysPayload(new Set([4, 0]), ["daily"], h)], ["mon", "fri"]);
});

test("the editor's actions for an entity: on/off, temperature to enter, presets", () => {
  const h = hassWith();
  const climate = sc.domainActions(h, "climate.bedroom");
  assert.ok(climate.some((a) => a.service === "climate.set_temperature" && a.input.field === "temperature" && a.input.min === 7));
  assert.ok(climate.some((a) => a.service === "climate.set_preset_mode" && a.data.preset_mode === "eco"));
  eq(
    sc.domainActions(h, "light.garden").map((a) => a.service),
    ["light.turn_on", "light.turn_off"],
  );
  assert.ok(sc.domainActions(h, "cover.living_room_blinds").some((a) => a.service === "cover.set_cover_position"));
});

test("editing a slot: loaded from the websocket, checked for overlaps, saved with scheduler.edit", async () => {
  const h = hassWith();
  const el = card(sc.SchedulerCard, {}, h);
  el._render();
  el._view = HEATING;
  await el._openSlot(HEATING, 3);
  const e = el._edit;
  assert.equal(e.loading, false);
  eq([e.draft.start, e.draft.stop], ["17:30", "22:30"]);
  assert.ok(el._render().includes('class="modal"'));
  // 17:30 – 23:00 runs into the 22:30 slot.
  e.draft.stop = "23:00";
  assert.equal(el._slotsAfterEdit(e).error, "This slot overlaps another one.");
  e.draft.stop = "22:30";
  e.draft.start = "18:00";
  const r = el._slotsAfterEdit(e);
  assert.equal(r.error, undefined);
  assert.equal(r.slots.length, 5);
  assert.equal(r.slots[3].start, "18:00:00");
  // The end was not changed: kept as stored.
  assert.equal(r.slots[3].stop, "22:30:00");
  eq(JSON.parse(JSON.stringify(r.slots[3].actions)), [{ service: "climate.set_temperature", entity_id: "climate.living_room", service_data: { temperature: 20 } }]);
  // The gap left between 17:30 and 18:00 is fine; the other slots stay as they were (their condition kept), without
  // null fields.
  assert.ok(r.slots.every((s) => s.conditions?.[0]?.entity_id === "group.family" && s.stop !== null));
  await el._save();
  const [domain, service, data] = h.calls.at(-1);
  eq([domain, service, data.entity_id], ["scheduler", "edit", HEATING]);
  // Days unchanged: the schedule's own workday is sent back, and no dates (none set).
  eq([...data.weekdays], ["workday"]);
  assert.ok(!("start_date" in data) && !("end_date" in data));
  assert.equal(el._edit, null);
});

test("a temperature entered for a slot, and a new slot added at a time of the grid", async () => {
  const h = hassWith();
  const el = card(sc.SchedulerCard, {}, h);
  el._render();
  await el._openSlot(BEDROOM, null, 12 * 60);
  const e = el._edit;
  eq([e.draft.start, e.draft.stop], ["12:00", "13:00"]);
  e.draft.action = "climate.set_temperature#temperature";
  e.draft.value = "21.5";
  const r = el._slotsAfterEdit(e);
  assert.equal(r.error, undefined);
  assert.equal(r.slots.length, 5);
  const added = r.slots.find((s) => s.start === "12:00:00");
  assert.equal(added.actions[0].service_data.temperature, 21.5);
  assert.equal(added.actions[0].entity_id, "climate.bedroom");
  // Sorted by start: after 07:30, before 21:00.
  eq(
    r.slots.map((s) => s.start),
    ["06:00:00", "07:30:00", "12:00:00", "21:00:00", "23:00:00"],
  );
  // The heating covers the whole day: a new slot always overlaps one.
  await el._openSlot(HEATING, null, 12 * 60);
  assert.equal(el._slotsAfterEdit(el._edit).error, "This slot overlaps another one.");
});

test("deleting: a slot with scheduler.edit, the last one removes the schedule (asked twice)", async () => {
  const h = hassWith();
  const el = card(sc.SchedulerCard, {}, h);
  el._render();
  await el._openSlot(GARDEN, 0);
  await el._delete();
  assert.equal(h.calls.length, 0, "first click only asks");
  assert.ok(el._render().includes("Delete it?"));
  await el._delete();
  eq(h.calls.at(-1).slice(0, 2), ["scheduler", "remove"]);
  assert.equal(h.calls.at(-1)[2].entity_id, GARDEN);
  await el._openSlot(BLINDS, 1);
  await el._delete();
  await el._delete();
  const [, service, data] = h.calls.at(-1);
  assert.equal(service, "edit");
  assert.equal(data.timeslots.length, 1);
});

test("a new schedule: scheduler.add with the entity, the action, the days and the card's tags", async () => {
  const h = hassWith();
  const el = card(sc.SchedulerCard, { tags: ["garden"] }, h);
  el._render();
  el._openNew();
  const d = el._edit.draft;
  Object.assign(d, { entity: "light.garden", start: "19:00", stop: "23:00", dayMode: "custom" });
  el._edit.opts.name = "Porch light";
  d.action = el._newOptions("light.garden")[0].key;
  d.days = new Set([5, 6]);
  await el._save();
  const [domain, service, data] = h.calls.at(-1);
  eq([domain, service], ["scheduler", "add"]);
  eq(JSON.parse(JSON.stringify(data)), {
    weekdays: ["sat", "sun"],
    timeslots: [{ start: "19:00:00", actions: [{ service: "light.turn_on", entity_id: "light.garden" }], stop: "23:00:00" }],
    repeat_type: "repeat",
    name: "Porch light",
    tags: ["garden"],
  });
  // Without an entity: an error, nothing called.
  el._openNew();
  const n = h.calls.length;
  await el._save();
  assert.equal(h.calls.length, n);
  assert.equal(el._edit.error, "Choose an entity.");
});

test("a schedule's switch enables and disables it with switch.turn_on / turn_off", () => {
  const h = hassWith();
  const el = card(sc.SchedulerCard, {}, h);
  const sw = { dataset: { toggle: GARDEN }, checked: false };
  el._change({ composedPath: () => [sw], stopPropagation() {} });
  eq(h.calls.at(-1), ["switch", "turn_off", { entity_id: GARDEN }]);
});

test("show_header_toggle: one switch for the card's schedules, off by default, mixed turns them all off", async () => {
  assert.ok(!/data-toggle-all/.test(card()._render()));
  // Every schedule, the away mode disabled: a mixed state, the switch on, a click disables the enabled ones only.
  const h = hassWith();
  const el = card(sc.SchedulerCard, { show_header_toggle: true }, h);
  const html = el._render();
  assert.match(html, /<ha-switch data-toggle-all="1" checked aria-label="Disable all">/);
  el._change({ composedPath: () => [{ dataset: { toggleAll: "1" } }], stopPropagation() {} });
  await new Promise((r) => setTimeout(r));
  assert.equal(h.calls.length, 5);
  assert.ok(h.calls.every((c) => c[1] === "turn_off" && c[2].entity_id !== AWAY));
  // All enabled (the heating tag): the switch on, a click disables those schedules and nothing else.
  const h2 = hassWith();
  const heat = card(sc.SchedulerCard, { show_header_toggle: true, tags: ["heating"] }, h2);
  assert.match(heat._render(), /<ha-switch data-toggle-all="1" checked aria-label="Disable all">/);
  await heat._toggleAll();
  eq(h2.calls.map((c) => c[2].entity_id).sort(), [BEDROOM, HEATING].sort());
  assert.ok(h2.calls.every((c) => c[0] === "switch" && c[1] === "turn_off"));
});

test("show_header_toggle: disabled schedules hidden or tagged by state still turned back on, failures reported", async () => {
  // show_disabled: false and the `enabled` state tag hide the away mode, the switch still reaches it: with every
  // schedule disabled it shows off and turns them all back on, hidden ones included.
  for (const config of [{ show_disabled: false }, { tags: ["enabled"] }]) {
    const h = hassWith();
    for (const id of sc.discover(h)) h.states[id] = { ...h.states[id], state: "off" };
    const el = card(sc.SchedulerCard, { show_header_toggle: true, ...config }, h);
    assert.match(el._render(), /data-toggle-all="1" aria-label="Enable all"/);
    await el._toggleAll();
    assert.ok(h.calls.some((c) => c[1] === "turn_on" && c[2].entity_id === AWAY));
  }
  // A failed call: the others done, the failures counted.
  const h = hassWith();
  h.callService = async (_d, _s, data) => {
    h.calls.push(data.entity_id);
    if (data.entity_id === BEDROOM) throw new Error("boom");
  };
  const el = card(sc.SchedulerCard, { show_header_toggle: true, tags: ["heating"] }, h);
  el._render();
  await el._toggleAll();
  eq(h.calls.sort(), [BEDROOM, HEATING].sort());
  assert.match(el._render(), /class="err">1 of 2 schedules could not be changed — Could not save: boom/);
});

test("editable: false greys every switch, the header one included, and changes nothing", async () => {
  const h = hassWith();
  const el = card(sc.SchedulerCard, { show_header_toggle: true, editable: false }, h);
  const html = el._render();
  assert.match(html, /data-toggle-all="1"( checked)? disabled/);
  assert.equal((html.match(/data-toggle="[^"]+"( checked)? disabled/g) || []).length, 6);
  await el._toggleAll();
  el._change({ composedPath: () => [{ dataset: { toggle: GARDEN }, checked: false }], stopPropagation() {} });
  eq(h.calls, []);
});

test("show_header_toggle on the mini card's expanded view", () => {
  const el = card(sc.SchedulerMiniCard, { show_header_toggle: true });
  assert.ok(!/data-toggle-all/.test(el._render()));
  el._zoomed = true;
  assert.match(el._render(), /data-toggle-all="1"/);
});

test("timeline and weekly grid render", () => {
  const el = card();
  const html = el._render();
  assert.match(html, /5 enabled/);
  assert.match(html, /1 disabled/);
  assert.equal((html.match(/class="row[ "]/g) || []).length, 6);
  assert.match(html, /New schedule/);
  assert.match(html, /Monday/);
  assert.match(html, /Next 18:00/);
  el._view = HEATING;
  const week = el._render();
  assert.equal((week.match(/class="day/g) || []).length, 7);
  assert.match(week, /17 °C \(default\)/);
  assert.match(week, /20 °C 35 h \/ week/);
  assert.match(week, /class="tab back"/);
  // Saturday and Sunday: no slot (a workday schedule).
  assert.equal((week.match(/class="day off"/g) || []).length, 2);
  // Not editable: no add button, no clickable blocks.
  const ro = card(sc.SchedulerCard, { editable: false });
  ro._view = HEATING;
  assert.ok(!/data-slot=/.test(ro._render()) && !/New schedule/.test(card(sc.SchedulerCard, { editable: false })._render()));
});

test("day and night: the theme alone makes the night banner, the sun left aside", () => {
  // After sunset, a light theme keeps the day picture; a dark theme shows the night one.
  const late = hassWith({ now: at("23:00") });
  assert.match(card(sc.SchedulerCard, {}, late, at("23:00"))._render(), /class="banner"/);
  late.themes = { darkMode: true };
  assert.match(card(sc.SchedulerCard, {}, late, at("23:00"))._render(), /class="banner night"/);
  assert.match(card(sc.SchedulerCard, { illustration_theme: "night" })._render(), /class="banner night"/);
  assert.ok(!/class="banner/.test(card(sc.SchedulerCard, { illustration: false })._render()));
});

test("the illustrated header: today's timeline, the slot running now, the status colour, day, evening and night", () => {
  // Monday 17:40: the blinds are open and the living room heating runs its comfort slot: the first two rows, their blocks pulsing.
  const html = card()._render();
  assert.match(html, /class="banner"/);
  assert.equal((html.match(/class="tr[ "]/g) || []).length, 3);
  assert.match(html, /class="tr" style="[^"]*"[^>]*>\s*<span class="ri"><ha-icon icon="mdi:blinds"/);
  assert.equal((html.match(/class="bk on"/g) || []).length, 2);
  assert.match(html, /class="cur" style="left:73\.61%"/);
  assert.match(html, /class="strip g-timeline"/);
  assert.match(html, /class="badge st-active"/);
  // The status pill right after the title, in the icon's colour.
  assert.match(html, /<div class="trow"><div class="name">Schedules<\/div><span class="chip status st-active"[^>]*><span class="dot"><\/span><span class="txt">Running</);
  // Nothing running at 01:30: an idle, grey icon.
  const idle = card(sc.SchedulerCard, {}, hassWith({ now: at("01:30") }), at("01:30"))._render();
  assert.ok(!/class="bk on"/.test(idle));
  assert.match(idle, /class="badge st-idle"/);
  assert.match(idle, /class="chip status st-idle"[^>]*><span class="dot"><\/span><span class="txt">Idle</);
  // No schedule matching the filters: amber.
  assert.match(card(sc.SchedulerCard, { tags: ["no-such-tag"] })._render(), /class="badge st-warn"/);
  // Two hours before sunset (21:56): the evening sky, unless forced to day.
  assert.match(card(sc.SchedulerCard, {}, hassWith({ now: at("20:30") }), at("20:30"))._render(), /class="banner evening"/);
  assert.match(card(sc.SchedulerCard, { illustration_theme: "day" }, hassWith({ now: at("20:30") }), at("20:30"))._render(), /class="banner"/);
  // Without sun.sun, Home Assistant's dark mode makes it night.
  const dark = hassWith();
  delete dark.states["sun.sun"];
  dark.themes = { darkMode: true };
  assert.match(card(sc.SchedulerCard, {}, dark)._render(), /class="banner night"/);
  // The dark mode makes it night while the sun is up too, unless forced to day.
  const darkDay = hassWith();
  darkDay.themes = { darkMode: true };
  assert.match(card(sc.SchedulerCard, {}, darkDay)._render(), /class="banner night"/);
  assert.match(card(sc.SchedulerCard, { illustration_theme: "day" }, darkDay)._render(), /class="banner"/);
  // The mini card: the same banner, the next action on its sky, the status on its icon.
  const mini = card(sc.SchedulerMiniCard)._render();
  assert.match(mini, /class="mini-card illustrated"[\s\S]*class="banner"[\s\S]*class="badge st-active"/);
  assert.ok(!/class="banner/.test(card(sc.SchedulerMiniCard, { illustration: false })._render()));
});

test("a click outside closes the popup first, then folds the weekly grid back; leaving the page resets both", async () => {
  const el = card();
  el._render();
  el._showWeek(HEATING);
  await el._openSlot(HEATING, 1);
  const ev = { composedPath: () => [] };
  el._onOutside(ev);
  assert.equal(el._edit, null);
  assert.equal(el._view, HEATING);
  el._onOutside(ev);
  assert.equal(el._view, null);
  el._showWeek(HEATING);
  el._edit = { mode: "new", draft: {} };
  el.disconnectedCallback();
  eq([el._edit, el._view], [null, null]);
});

test("mini card: the next actions, the detail button to the full card, folded back by a click elsewhere", () => {
  const el = card(sc.SchedulerMiniCard);
  const html = el._render();
  assert.equal((html.match(/class="nr"/g) || []).length, 3);
  assert.match(html, /Next 18:00/);
  assert.match(html, /Garden lights[\s\S]*Living room blinds[\s\S]*Bedroom heating/);
  assert.match(html, /class="zoom/);
  assert.equal((card(sc.SchedulerMiniCard, { next_actions: 5 })._render().match(/class="nr"/g) || []).length, 5);
  el._click({ composedPath: () => [{ classList: { contains: (c) => c === "zoom" } }], stopPropagation() {}, detail: 1 });
  assert.equal(el._zoomed, true);
  assert.match(el._render(), /class="banner/);
  el._onFold({ composedPath: () => [] });
  assert.equal(el._zoomed, false);
  assert.ok(!/class="zoom/.test(card(sc.SchedulerMiniCard, { zoom: false })._render()));
});

test("visual editors: defaults left out of the YAML, the mini editor with the full card's options", () => {
  const ed = new sc.SchedulerMiniCardEditor();
  ed.setConfig({ type: "custom:scheduler-mini-card" });
  ed.hass = hassWith();
  const names = JSON.stringify(ed._schema());
  for (const k of ["title", "illustration_theme", "next_actions", "illustration", "show_disabled", "editable", "show_header_toggle", "zoom", "language"]) assert.ok(names.includes(`"${k}"`), k);
  assert.ok(!JSON.stringify(new sc.SchedulerCardEditor()._schema.call({ _hass: null, _config: {}, constructor: sc.SchedulerCardEditor })).includes('"zoom"'));
  let out;
  ed.dispatchEvent = (ev) => {
    out = ev.detail.config;
  };
  const form = { listeners: {} };
  ed._form = null;
  sc.document.createElement = () => ({
    addEventListener: (type, fn) => {
      form.listeners[type] = fn;
    },
  });
  ed._render();
  form.listeners["value-changed"]({
    stopPropagation() {},
    detail: { value: { type: "custom:scheduler-mini-card", illustration: true, zoom: true, next_actions: 3, illustration_theme: "auto", title: "", editable: false, show_header_toggle: false } },
  });
  eq(JSON.parse(JSON.stringify(out)), { type: "custom:scheduler-mini-card", editable: false });
});
