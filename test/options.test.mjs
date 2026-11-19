// The functions brought from nielsfaber's scheduler-card: times relative to the sun, day presets, a schedule's
// options (conditions, dates, after the last slot), single-time schedules on several entities, splitting, merging,
// duplicating and dragging slots, the filters and sorting of the card, custom actions, and the tiles' badges.
import assert from "node:assert/strict";
import { test } from "node:test";
import { mockHass, NOW } from "../scripts/screenshots/mock.mjs";
import { load } from "./load.mjs";

const sc = load(["splitTime", "joinTime", "optionsOf", "conditionsPayload", "withConditions", "customActions", "pickable", "pickSchedules", "slotsClash", "SchedulerCard"]);
const plain = (v) => JSON.parse(JSON.stringify(v));
const eq = (a, b, msg) => assert.deepEqual(plain(a), plain(b), msg);

const HEATING = "switch.schedule_living_room_heating";
const GARDEN = "switch.schedule_garden_lights";
const AWAY = "switch.schedule_away_mode";
const WATER = "switch.schedule_water_heater";

const hassWith = () => {
  const h = mockHass();
  h.calls = [];
  h.callService = async (domain, service, data) => {
    h.calls.push([domain, service, data]);
  };
  h.callWS = async (msg) => (msg.type === "scheduler" ? h._ws : msg.type === "scheduler/item" ? h._ws.find((s) => s.schedule_id === msg.schedule_id) : null);
  h.formatEntityState = (s) => s.state.charAt(0).toUpperCase() + s.state.slice(1);
  return h;
};
const card = (config = {}, hass = hassWith()) => {
  const el = new sc.SchedulerCard();
  el._nowMs = () => NOW;
  el.setConfig({ type: "custom:x", ...config });
  el._hass = hass;
  el._update = function () {
    this._html = this._render();
  };
  return el;
};

test("times relative to the sun: split for the editor and joined back", () => {
  const sun = { rise: 360, set: 1200 };
  eq(sc.splitTime("sunset-00:30:00", sun), { mode: "sunset", sign: "-", off: "00:30", time: "19:30" });
  eq(sc.splitTime("sunrise+1:15:00", sun), { mode: "sunrise", sign: "+", off: "01:15", time: "07:15" });
  eq(sc.splitTime("07:30:00", sun), { mode: "time", sign: "-", off: "00:00", time: "07:30" });
  eq(sc.splitTime(null, sun).time, "");
  assert.equal(sc.joinTime("sunset", "", "-", "00:30"), "sunset-00:30:00");
  assert.equal(sc.joinTime("sunrise", "", "+", "1:05"), "sunrise+01:05:00");
  assert.equal(sc.joinTime("sunrise", "", "+", "junk"), "sunrise+00:00:00");
  assert.equal(sc.joinTime("time", "08:00"), "08:00:00");
  assert.equal(sc.joinTime("time", ""), "");
});

test("a schedule's options read from the websocket, and its conditions for the services", () => {
  const h = hassWith();
  const o = sc.optionsOf(h._ws.find((x) => x.entity_id === HEATING));
  eq([o.name, o.tags, o.condType, o.conds, o.period, o.repeat], ["Living room heating", ["heating"], "and", [{ entity: "group.family", match: "is", value: "home" }], false, "repeat"]);
  const away = sc.optionsOf(h._ws.find((x) => x.entity_id === AWAY));
  eq([away.period, away.from, away.to, away.repeat], [true, "2026-12-20", "2027-01-04", "pause"]);
  // Numbers stay numbers, words stay words; an empty condition is an error.
  eq(sc.conditionsPayload({ conds: [{ entity: "sensor.t", match: "below", value: "15" }, { entity: "group.family", match: "is", value: "home" }] }).conds, [
    { entity_id: "sensor.t", value: 15, match_type: "below" },
    { entity_id: "group.family", value: "home", match_type: "is" },
  ]);
  assert.equal(sc.conditionsPayload({ conds: [{ entity: "", match: "is", value: "x" }] }).error, "err_condition");
  // Put on every slot, or removed from all.
  const slots = [{ start: "07:00:00", actions: [], conditions: [{ entity_id: "a", value: 1, match_type: "is" }], condition_type: "and" }];
  eq(sc.withConditions(slots, { condType: "or", track: true }, [{ entity_id: "b", value: 2, match_type: "above" }]), [
    { start: "07:00:00", actions: [], conditions: [{ entity_id: "b", value: 2, match_type: "above" }], condition_type: "or", track_conditions: true },
  ]);
  eq(sc.withConditions(slots, { condType: "and" }, []), [{ start: "07:00:00", actions: [] }]);
});

test("filters: tags none / enabled / disabled, exclude_tags; sorting by the next action", () => {
  const el = card();
  el._render();
  const all = el._all;
  const ids = (config) => sc.pickSchedules(all, config).map((m) => m.id);
  assert.ok(ids({ tags: "none" }).every((id) => !all.find((m) => m.id === id).tags.length));
  assert.ok(!ids({ tags: ["enabled"] }).includes(AWAY));
  eq(ids({ tags: ["disabled"] }), [AWAY]);
  assert.ok(!ids({ exclude_tags: "heating" }).includes(HEATING));
  // Monday 17:40: the garden lights come on at 18:00 first, then the blinds close at 18:45.
  const next = card({ sort_by: "next" });
  next._render();
  eq(next._list.slice(0, 2).map((m) => m.id), [GARDEN, "switch.schedule_living_room_blinds"]);
  assert.equal(next._list.at(-1).id, AWAY, "disabled last");
});

test("the entities a new schedule can act on: include / exclude by id or domain; custom actions", () => {
  const h = hassWith();
  assert.ok(sc.pickable(h, {}).includes("light.garden"));
  assert.ok(!sc.pickable(h, {}).some((id) => id.startsWith("switch.schedule_")));
  eq(sc.pickable(h, { include: ["light", "climate.bedroom"] }), ["climate.bedroom", "light.garden"]);
  assert.ok(!sc.pickable(h, { exclude: "climate" }).some((id) => id.startsWith("climate.")));
  const custom = { customize: { "light.garden": [{ name: "Dim", service: "light.turn_on", service_data: { brightness_pct: 20 } }], light: [{ service: "light.toggle" }, { name: "bad" }] } };
  eq(sc.customActions(custom, "light.garden"), [
    { service: "light.turn_on", data: { brightness_pct: 20 }, name: "Dim" },
    { service: "light.toggle", data: {}, name: "" },
  ]);
  const el = card(custom);
  el._render();
  const opts = el._newOptions("light.garden");
  assert.equal(opts[0].label, "Dim");
  assert.ok(opts.some((o) => o.service === "light.turn_off"));
});

test("badges of the tiles, and a schedule starting on a later date", async () => {
  const el = card();
  await el._loadItems();
  const html = el._render();
  assert.match(html, /class="bdg b-days">Workdays</);
  assert.match(html, /class="bdg b-cond">Family is Home</);
  assert.match(html, /class="bdg b-cond">Outdoor temperature below 15</);
  assert.match(html, /class="bdg b-period">Until Dec 31</);
  assert.match(html, /class="bdg b-period">Dec 20 → Jan 4</);
  assert.match(html, /class="bdg b-repeat">Once · then stop</);
  assert.match(html, /class="bdg b-sun">Sunrise \+03:13</);
  assert.ok(!/class="bdgs"/.test(card({ show_badges: false })._render()));
  // The away mode, enabled: it starts on 20 December, nothing before.
  const h = hassWith();
  h.states[AWAY] = { ...h.states[AWAY], state: "on" };
  const on = card({}, h);
  await on._loadItems();
  assert.match(on._render(), /Starts Sun, Dec 20|Starts Sun Dec 20/);
  assert.ok(!on._models().find((m) => m.id === AWAY).enabled || !/Away mode[^<]*<\/span><span class="stl">[^<]*at/.test(on._render()));
});

test("a slot relative to the sun, a day preset and options, saved with scheduler.edit", async () => {
  const h = hassWith();
  const el = card({}, h);
  el._render();
  await el._openSlot(AWAY, 0);
  const e = el._edit;
  eq([e.draft.startMode, e.draft.startSign, e.draft.startOff, e.draft.dayMode], ["sunrise", "+", "03:13", "custom"]);
  assert.match(el._render(), /≈ 09:00 today/);
  // Unchanged: the stored time is sent back as it is.
  assert.equal(el._slotsAfterEdit(e).slots[0].start, "sunrise+03:13:00");
  Object.assign(e.draft, { startMode: "sunset", startSign: "-", startOff: "01:00", stopMode: "time", stop: "23:00", dayMode: "weekend" });
  e.opts.name = "Holidays";
  e.opts.tags.push("away");
  e.opts.repeat = "single";
  e.opts.conds.push({ entity: "group.family", match: "not", value: "home" });
  e.opts.to = "2027-01-10";
  await el._save();
  const [, service, data] = h.calls.at(-1);
  assert.equal(service, "edit");
  eq(data, {
    entity_id: AWAY,
    weekdays: ["weekend"],
    timeslots: [
      {
        start: "sunset-01:00:00",
        stop: "23:00:00",
        actions: [{ service: "input_boolean.turn_on", entity_id: "input_boolean.away_mode" }],
        conditions: [{ entity_id: "group.family", value: "home", match_type: "not" }],
        condition_type: "and",
      },
    ],
    start_date: "2026-12-20",
    end_date: "2027-01-10",
    name: "Holidays",
    tags: ["away"],
    repeat_type: "single",
  });
  // Dates the wrong way round: refused.
  await el._openSlot(AWAY, 0);
  Object.assign(el._edit.opts, { from: "2027-02-01", to: "2027-01-01" });
  await el._save();
  assert.equal(el._edit.error, "The end date must come after the start date.");
});

test("the options alone (from the weekly grid) and duplicating a schedule", async () => {
  const h = hassWith();
  const el = card({}, h);
  el._render();
  await el._openSlot(WATER, null, null, true);
  assert.ok(el._edit.optsOnly);
  assert.match(el._render(), /data-action="duplicate"/);
  el._edit.opts.conds = [];
  await el._save();
  const [, service, data] = h.calls.at(-1);
  assert.equal(service, "edit");
  assert.ok(!("weekdays" in data));
  assert.ok(data.timeslots.every((s) => !("conditions" in s)), "conditions removed from every slot");
  await el._openSlot(WATER, null, null, true);
  await el._duplicate();
  eq(h.calls.at(-1), ["scheduler", "copy", { entity_id: WATER, name: "Water heater (copy)" }]);
});

test("a new single-time schedule on two lights, after sunset, with a condition and a period", async () => {
  const h = hassWith();
  h.states["light.terrace"] = { entity_id: "light.terrace", state: "off", attributes: { friendly_name: "Terrace" } };
  const el = card({ tags: ["garden", "none"] }, h);
  el._render();
  el._openNew();
  const e = el._edit;
  eq(e.opts.tags, ["garden"], "the card's tags, special values left out");
  Object.assign(e.draft, { entity: "light.garden", kind: "single", startMode: "sunset", startSign: "+", startOff: "00:15", dayMode: "workday" });
  e.draft.action = el._newOptions("light.garden").find((o) => o.service === "light.turn_off").key;
  // A second light is added; an entity of another kind is not.
  for (const id of ["light.terrace", "climate.bedroom"]) el._input({ composedPath: () => [{ dataset: { more: "1" }, value: id }] }, true);
  eq(e.draft.more, ["light.terrace"]);
  Object.assign(e.opts, { period: true, from: "2026-07-01", conds: [{ entity: "sensor.outdoor_temperature", match: "above", value: "10" }] });
  await el._save();
  eq(h.calls.at(-1), [
    "scheduler",
    "add",
    {
      weekdays: ["workday"],
      timeslots: [
        {
          start: "sunset+00:15:00",
          actions: [
            { service: "light.turn_off", entity_id: "light.garden" },
            { service: "light.turn_off", entity_id: "light.terrace" },
          ],
          conditions: [{ entity_id: "sensor.outdoor_temperature", value: 10, match_type: "above" }],
          condition_type: "and",
        },
      ],
      start_date: "2026-07-01",
      tags: ["garden"],
      repeat_type: "repeat",
    },
  ]);
});

test("splitting and merging slots; a day of a preset turns it into chosen days", async () => {
  const h = hassWith();
  const el = card({}, h);
  el._render();
  await el._openSlot(HEATING, 3);
  assert.match(el._render(), /data-action="split"/);
  assert.match(el._render(), /data-action="merge"/);
  await el._splitMerge("split");
  let ts = h.calls.at(-1)[2].timeslots;
  eq(
    ts.map((s) => [s.start, s.stop]),
    [
      ["00:00:00", "06:30:00"],
      ["06:30:00", "08:30:00"],
      ["08:30:00", "17:30:00"],
      ["17:30:00", "20:00:00"],
      ["20:00:00", "22:30:00"],
      ["22:30:00", "00:00:00"],
    ],
  );
  await el._openSlot(HEATING, 3);
  await el._splitMerge("merge");
  ts = h.calls.at(-1)[2].timeslots;
  eq(ts[3].start, "17:30:00");
  eq(ts[3].stop, "00:00:00");
  assert.equal(ts.length, 4);
  // A click on Saturday while on « Workdays »: chosen days from Monday to Saturday.
  await el._openSlot(HEATING, 3);
  el._clickEdit({}, [{ dataset: { dayt: "5" } }], undefined);
  eq([el._edit.draft.dayMode, [...el._edit.draft.days].sort()], ["custom", [0, 1, 2, 3, 4, 5]]);
  eq(el._weekdaysOf(el._edit), ["mon", "tue", "wed", "thu", "fri", "sat"]);
});

test("dragging a slot's edge saves its new time, refused when it overlaps", async () => {
  const h = hassWith();
  const el = card({}, h);
  el._render();
  el._view = GARDEN;
  assert.match(el._render(), /data-drag="0:a"/);
  await el._moveEdge(GARDEN, 0, "a", 17 * 60 + 15);
  eq(h.calls.at(-1)[2].timeslots[0].start, "17:15:00");
  el._view = HEATING;
  const n = h.calls.length;
  await el._moveEdge(HEATING, 3, "b", 23 * 60);
  assert.equal(h.calls.length, n);
  assert.equal(el._notice, "This slot overlaps another one.");
  assert.ok(sc.slotsClash([{ start: "08:00:00", stop: "10:00:00" }, { start: "09:00:00" }], 0, { rise: 360, set: 1200 }));
});
