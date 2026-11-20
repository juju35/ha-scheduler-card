// Custom actions with variables: a number or a list chosen in the editor, merged into the action's fixed data.
import assert from "node:assert/strict";
import { test } from "node:test";
import { mockHass, NOW } from "../scripts/screenshots/mock.mjs";
import { load } from "./load.mjs";

const sc = load(["actionVars", "customActions", "matchVars", "varsData", "varDefaults", "SchedulerCard"]);
const plain = (v) => JSON.parse(JSON.stringify(v));
const eq = (a, b, msg) => assert.deepEqual(plain(a), plain(b), msg);

const HEATING = "switch.schedule_living_room_heating";
const HEAT = {
  name: "Heat to…",
  service: "climate.set_temperature",
  service_data: { hvac_mode: "heat" },
  variables: { temperature: { name: "Temperature", min: 16, max: 25, step: 0.5, unit: "°C" } },
};
const FAN = {
  name: "Comfort",
  service: "script.comfort",
  variables: {
    temperature: { min: 16, max: 25, step: 0.5 },
    fan_mode: { name: "Fan", options: [{ value: "low", name: "Low", icon: "mdi:fan-speed-1" }, { value: "high", name: "High" }, "auto"] },
    brightness: { name: "Brightness", min: 0, max: 100, unit: "%", scale_factor: 2.55, optional: true },
  },
};
const config = { customize: { "climate.living_room": [HEAT, { name: "Frost", service: "climate.set_temperature", service_data: { temperature: 7 } }], climate: [FAN] } };

const hassWith = () => {
  const h = mockHass();
  h.calls = [];
  h.callService = async (domain, service, data) => {
    h.calls.push([domain, service, data]);
  };
  h.callWS = async (msg) => (msg.type === "scheduler" ? h._ws : msg.type === "scheduler/item" ? h._ws.find((s) => s.schedule_id === msg.schedule_id) : null);
  return h;
};
const card = (cfg = config, hass = hassWith()) => {
  const el = new sc.SchedulerCard();
  el._nowMs = () => NOW;
  el.setConfig({ type: "custom:x", ...cfg });
  el._hass = hass;
  el._update = function () {
    this._html = this._render();
  };
  return el;
};
const input = (el, attrs, value, change = true, tagName = "INPUT") => el._input({ composedPath: () => [{ dataset: attrs, value, tagName }] }, change);

test("variables are read from the YAML: numbers, lists (plain values too), labels and scale", () => {
  const [fan] = sc.customActions(config, "climate.bedroom");
  eq(
    fan.vars.map((x) => [x.field, x.type, x.label, x.optional]),
    [
      ["temperature", "number", "Temperature", false],
      ["fan_mode", "list", "Fan", false],
      ["brightness", "number", "Brightness", true],
    ],
  );
  eq(fan.vars[1].options, [{ value: "low", label: "Low", icon: "mdi:fan-speed-1" }, { value: "high", label: "High" }, { value: "auto", label: "auto" }]);
  assert.equal(fan.vars[2].scale, 2.55);
  // Fixed custom actions stay as they were; a variable without options or range is a free number.
  eq(sc.customActions(config, "climate.living_room")[1], { service: "climate.set_temperature", data: { temperature: 7 }, name: "Frost" });
  eq(sc.actionVars({ x: {}, y: { options: [] }, z: null }).map((v) => [v.field, v.type]), [["x", "number"]]);
});

test("values are merged into the fixed data, checked, scaled, and read back from a stored action", () => {
  const [fan] = sc.customActions(config, "climate.bedroom");
  eq(sc.varsData(fan, { temperature: "21", fan_mode: "1", brightness: "50" }), { temperature: 21, fan_mode: "high", brightness: 127.5 });
  eq(sc.varsData(fan, { temperature: "21", fan_mode: "0", brightness: "" }), { temperature: 21, fan_mode: "low" }, "an empty optional value is left out");
  assert.equal(sc.varsData(fan, { temperature: "", fan_mode: "0" }), null, "a required value is missing");
  assert.equal(sc.varsData(fan, { temperature: "30", fan_mode: "0" }), null, "out of range");
  assert.equal(sc.varsData(fan, { temperature: "20", fan_mode: "7" }), null, "not an option");
  const m = sc.matchVars(fan, "script.comfort", { temperature: 21, fan_mode: "high", brightness: 127.5, extra: 1 });
  eq(m, { vals: { temperature: "21", fan_mode: "1", brightness: "50" }, keep: { extra: 1 } });
  assert.equal(sc.matchVars(fan, "script.other", { temperature: 21, fan_mode: "high" }), null);
  assert.equal(sc.matchVars(fan, "script.comfort", { fan_mode: "high" }), null, "a required value is missing");
  const [heat] = sc.customActions(config, "climate.living_room");
  assert.equal(sc.matchVars(heat, "climate.set_temperature", { temperature: 21 }), null, "the fixed data must match");
  eq(sc.matchVars(heat, "climate.set_temperature", { hvac_mode: "heat", temperature: 21 }).vals, { temperature: "21" });
  eq(sc.varDefaults(fan), { temperature: "16", fan_mode: "0", brightness: "" });
});

test("a new schedule with a « Heat to… » action stores the fixed mode and the chosen temperature", async () => {
  const h = hassWith();
  const el = card(config, h);
  el._render();
  el._openNew();
  input(el, { field: "entity" }, "climate.living_room");
  const d = el._edit.draft;
  assert.equal(el._newOptions("climate.living_room")[0].label, "Heat to…");
  assert.equal(d.action, el._newOptions("climate.living_room")[0].key);
  eq(d.vals, { temperature: "16" });
  const html = el._render();
  assert.match(html, /<label for="sc-var0">Temperature<\/label><div class="pair"><input id="sc-var0" type="number" inputmode="decimal" data-var="temperature" min="16" max="25" step="0.5" value="16">/);
  input(el, { var: "temperature" }, "21", false);
  await el._save();
  eq(h.calls.at(-1)[2].timeslots[0].actions, [{ service: "climate.set_temperature", entity_id: "climate.living_room", service_data: { hvac_mode: "heat", temperature: 21 } }]);
  // A value out of range is refused.
  el._openNew();
  input(el, { field: "entity" }, "climate.living_room");
  input(el, { var: "temperature" }, "40", false);
  await el._save();
  assert.equal(el._edit.error, "Choose an action.");
});

test("editing a slot shows its stored values, saves the new one and leaves the rest of the schedule alone", async () => {
  const h = hassWith();
  const item = h._ws.find((s) => s.entity_id === HEATING);
  item.timeslots[1].actions = [{ service: "climate.set_temperature", entity_id: "climate.living_room", service_data: { hvac_mode: "heat", temperature: 20.5, target_temp_step: 1 } }];
  const before = plain(item.timeslots);
  const el = card(config, h);
  el._render();
  await el._openSlot(HEATING, 1);
  const e = el._edit;
  const heat = e.options.find((o) => o.label === "Heat to…");
  assert.equal(e.draft.action, heat.key);
  eq(e.draft.vals, { temperature: "20.5" });
  assert.ok(!e.options.some((o) => o.service === "climate.set_temperature" && o.data?.hvac_mode === "heat" && !o.vars), "not offered again as a fixed action");
  assert.match(el._render(), /data-var="temperature"[^>]*value="20.5"/);
  input(el, { var: "temperature" }, "22", false);
  await el._save();
  const slots = h.calls.at(-1)[2].timeslots;
  eq(slots[1].actions[0].service_data, { target_temp_step: 1, hvac_mode: "heat", temperature: 22 }, "unrelated data kept");
  for (const k of [0, 2, 3, 4]) eq(slots[k].actions, before[k].actions);
  // Another action, then back: the stored values and data come back.
  await el._openSlot(HEATING, 1);
  const frost = el._edit.options.find((o) => o.label === "Frost");
  input(el, { field: "action" }, frost.key);
  assert.equal(el._edit.draft.vals, undefined);
  input(el, { field: "action" }, heat.key);
  eq(el._edit.draft.vals, { temperature: "20.5" });
});

test("a list variable is a select of its options, with the chosen option's icon", async () => {
  const el = card();
  el._render();
  el._openNew();
  input(el, { field: "entity" }, "climate.bedroom");
  const d = el._edit.draft;
  d.action = el._newOptions("climate.bedroom").find((o) => o.label === "Comfort").key;
  d.vals = sc.varDefaults(el._newOptions("climate.bedroom").find((o) => o.key === d.action));
  const html = el._render();
  assert.match(html, /<select id="sc-var1" data-var="fan_mode"><option value="0" selected>Low<\/option><option value="1">High<\/option><option value="2">auto<\/option><\/select><ha-icon class="u" icon="mdi:fan-speed-1">/);
  assert.match(html, /data-var="brightness"[^>]*placeholder="—"/);
  input(el, { var: "fan_mode" }, "2", true, "SELECT");
  eq(d.vals.fan_mode, "2");
  assert.ok(!/icon="mdi:fan-speed-1"/.test(el._html));
});
