// The condition editor: its own entity filters (`condition_include` / `condition_exclude`, wildcards), and a value
// field guided by the entity (its known states, a number with its unit and range, or a free value).
import assert from "node:assert/strict";
import { test } from "node:test";
import { mockHass, NOW } from "../scripts/screenshots/mock.mjs";
import { load } from "./load.mjs";

const sc = load(["conditionPickable", "conditionValues", "conditionsPayload", "pickable", "SchedulerCard"]);
const plain = (v) => JSON.parse(JSON.stringify(v));
const eq = (a, b, msg) => assert.deepEqual(plain(a), plain(b), msg);
const HEATING = "switch.schedule_living_room_heating";

const st = (entity_id, state, attributes = {}) => ({ entity_id, state, attributes, last_changed: "", last_updated: "" });
const hassWith = () => {
  const h = mockHass();
  Object.assign(h.states, {
    "binary_sensor.bedroom_occupancy": st("binary_sensor.bedroom_occupancy", "off", { friendly_name: "Bedroom occupancy" }),
    "input_boolean.vacation_mode": st("input_boolean.vacation_mode", "off", { friendly_name: "Vacation mode" }),
    "input_select.energy_tariff": st("input_select.energy_tariff", "blue", { friendly_name: "Energy tariff", options: ["blue", "white", "red"] }),
    "input_number.bedroom_target": st("input_number.bedroom_target", "19", { min: 7, max: 25, step: 0.5, unit_of_measurement: "°C" }),
    "person.alex": st("person.alex", "home", {}),
    "zone.work": st("zone.work", "0", { friendly_name: "Work" }),
    "sensor.mode": st("sensor.mode", "eco", {}),
  });
  h.calls = [];
  h.callService = async (domain, service, data) => h.calls.push([domain, service, data]);
  h.callWS = async (msg) => (msg.type === "scheduler" ? h._ws : msg.type === "scheduler/item" ? h._ws.find((s) => s.schedule_id === msg.schedule_id) : null);
  h.formatEntityState = (s) => `«${s.state}»`;
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

test("condition entities: every entity by default, narrowed by their own filters (ids, domains, wildcards)", () => {
  const h = hassWith();
  assert.equal(sc.conditionPickable(h, {}).length, Object.keys(h.states).length);
  eq(sc.conditionPickable(h, { condition_include: ["binary_sensor.bedroom_*", "input_boolean", "input_select.energy_tariff"] }), [
    "binary_sensor.bedroom_occupancy",
    "input_boolean.away_mode",
    "input_boolean.vacation_mode",
    "input_select.energy_tariff",
  ].filter((id) => h.states[id]));
  assert.ok(!sc.conditionPickable(h, { condition_exclude: ["sensor.*", "person"] }).some((id) => id.startsWith("sensor.") || id.startsWith("person.")));
  // The action filters do not narrow the conditions, and the other way round.
  assert.ok(sc.conditionPickable(h, { include: ["light"] }).includes("binary_sensor.bedroom_occupancy"));
  assert.ok(!sc.pickable(h, { condition_include: ["binary_sensor"] }).includes("binary_sensor.bedroom_occupancy"));
  // Wildcards also work for `include` / `exclude`.
  assert.ok(sc.pickable(h, { include: ["light.*"] }).every((id) => id.startsWith("light.")));
});

test("condition values: known states, numbers with their range and unit, YAML state definitions", () => {
  const h = hassWith();
  eq(sc.conditionValues(h, {}, "binary_sensor.bedroom_occupancy").values.map((v) => v.value), ["on", "off"]);
  eq(sc.conditionValues(h, {}, "input_select.energy_tariff").values.map((v) => v.value), ["blue", "white", "red"]);
  eq(sc.conditionValues(h, {}, "person.alex").values.map((v) => v.value), ["home", "not_home", "Work"]);
  eq(sc.conditionValues(h, {}, "input_number.bedroom_target"), { kind: "number", min: 7, max: 25, step: 0.5, unit: "°C" });
  eq(sc.conditionValues(h, {}, "sensor.outdoor_temperature"), { kind: "number", min: null, max: null, step: null, unit: "°C" });
  assert.equal(sc.conditionValues(h, {}, "sensor.mode"), null, "states that cannot be told: a free value");
  const config = {
    condition_states: {
      "sensor.mode": [{ value: "eco", name: "Economy" }, "comfort"],
      "sensor.*_temperature": { min: -20, max: 40, step: 1 },
    },
  };
  eq(sc.conditionValues(h, config, "sensor.mode").values, [
    { value: "eco", name: "Economy" },
    { value: "comfort", name: "" },
  ]);
  eq(sc.conditionValues(h, config, "sensor.outdoor_temperature"), { kind: "number", min: -20, max: 40, step: 1, unit: "°C" });
});

test("the condition editor: a list of readable states, a number, a free value; the stored value kept", async () => {
  const el = card({ condition_include: ["binary_sensor", "input_select"] });
  el._render();
  await el._openSlot(HEATING, 0);
  const e = el._edit;
  e.tab = "options";
  e.opts.conds = [
    { entity: "group.family", match: "is", value: "home" },
    { entity: "input_select.energy_tariff", match: "is", value: "white" },
    { entity: "binary_sensor.bedroom_occupancy", match: "is", value: "" },
    { entity: "input_select.energy_tariff", match: "not", value: "purple" },
    { entity: "sensor.outdoor_temperature", match: "below", value: "15" },
  ];
  const html = el._optionsHtml(e.opts);
  // A condition outside the filters stays, editable, with its free value.
  assert.match(html, /data-cfield="entity" value="group\.family"/);
  assert.match(html, /<input type="text" data-cond="0" data-cfield="value"[^>]*value="home"/);
  // Readable labels, the real state saved.
  assert.match(html, /<option value="white" selected>«white»<\/option>/);
  assert.match(html, /data-cond="2" data-cfield="value"[^>]*><option value="" selected>Choose a value…<\/option><option value="on">«on»/);
  // A stored value missing from the list is kept and selected.
  assert.match(html, /<option value="purple" selected>«purple»<\/option>/);
  assert.match(html, /<option value="[^"]*">Other value…<\/option>/);
  // Below / above: a number with the entity's unit.
  assert.match(html, /<input type="number" inputmode="decimal" data-cond="4" data-cfield="value"[^>]*value="15"[^>]*step="any"[^>]*><span class="u">°C<\/span>/);
  // The datalist: the filtered entities, plus those already used.
  const list = /<datalist id="sc-cents">(.*?)<\/datalist>/s.exec(html)[1];
  assert.ok(list.includes('value="binary_sensor.bedroom_occupancy"') && list.includes('value="group.family"'));
  assert.ok(!list.includes('value="light.'));
});

test("choosing « Other value… », another entity, then saving: only the condition edited changes", async () => {
  const h = hassWith();
  const el = card({}, h);
  el._render();
  await el._openSlot(HEATING, 0);
  const e = el._edit;
  const before = plain(e.opts.conds);
  e.opts.conds.push({ entity: "", match: "is", value: "" });
  const fire = (cfield, value, change = true) => {
    const target = { dataset: { cond: "1", cfield }, value };
    el._input({ composedPath: () => [target] }, change);
  };
  fire("entity", "input_select.energy_tariff");
  assert.ok(el._html, "the popup is redrawn");
  assert.match(el._optionsHtml(e.opts), /data-cond="1" data-cfield="value"[^>]*><option value="" selected>Choose a value…/);
  fire("value", "red");
  const other = /<option value="([^"]*)">Other value…/.exec(el._optionsHtml(e.opts))[1];
  assert.equal(other, "__sc_other__");
  fire("value", other);
  assert.equal(e.opts.conds[1].value, "red", "the value chosen so far is kept");
  assert.match(el._optionsHtml(e.opts), /<input type="text" data-cond="1" data-cfield="value"[^>]*value="red"/);
  eq(e.opts.conds[0], before[0], "the other condition is unchanged");
  await el._save();
  const [, service, data] = h.calls.at(-1);
  assert.equal(service, "edit");
  eq(data.timeslots[0].conditions, [
    { entity_id: "group.family", value: "home", match_type: "is" },
    { entity_id: "input_select.energy_tariff", value: "red", match_type: "is" },
  ]);
});
