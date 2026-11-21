// show_condition_status (#17): the dot of a tile's icon tells whether the conditions of the slot running now (or the
// next one) hold — met, waiting (tracked conditions) or skipped — with the conditions not met in its tooltip.
import assert from "node:assert/strict";
import { test } from "node:test";
import { mockHass, NOW } from "../scripts/screenshots/mock.mjs";
import { load } from "./load.mjs";

const sc = load(["condMet", "SchedulerCard"]);
const HEATING = "switch.schedule_living_room_heating";

const card = (config = {}, change = (_h) => {}) => {
  const h = mockHass();
  h._ws = JSON.parse(JSON.stringify(h._ws));
  change(h);
  const el = new sc.SchedulerCard();
  el._nowMs = () => NOW;
  el.setConfig({ type: "custom:scheduler-card", ...config });
  el._hass = h;
  el._items = new Map(h._ws.map((x) => [x.entity_id, x]));
  return { el, h, html: () => el._render() };
};
const heatingRow = (out) => out.slice(out.indexOf(`data-key="${HEATING}"`), out.indexOf("</div>", out.indexOf(`data-key="${HEATING}"`)) + 400);

test("the component's matches: is / not / below / above, an unavailable entity or a missing attribute never meets", () => {
  const hass = { states: { "sensor.t": { state: "12", attributes: { level: 3 } }, "group.f": { state: "home", attributes: {} }, "sensor.x": { state: "unavailable", attributes: {} } } };
  assert.equal(sc.condMet(hass, { entity_id: "group.f", match_type: "is", value: "home" }), true);
  assert.equal(sc.condMet(hass, { entity_id: "group.f", match_type: "not", value: "home" }), false);
  assert.equal(sc.condMet(hass, { entity_id: "sensor.t", match_type: "below", value: 15 }), true);
  assert.equal(sc.condMet(hass, { entity_id: "sensor.t", match_type: "above", value: "15" }), false);
  assert.equal(sc.condMet(hass, { entity_id: "sensor.t", match_type: "is", value: 12 }), true);
  assert.equal(sc.condMet(hass, { entity_id: "sensor.t", match_type: "above", value: 2, attribute: "level" }), true);
  assert.equal(sc.condMet(hass, { entity_id: "sensor.t", match_type: "is", value: 1, attribute: "missing" }), false);
  assert.equal(sc.condMet(hass, { entity_id: "sensor.x", match_type: "not", value: "on" }), false);
  assert.equal(sc.condMet(hass, { entity_id: "sensor.none", match_type: "not", value: "on" }), false);
});

test("#19: `attribute: \"state\"`, as the component stores it, reads the entity's state", () => {
  const hass = { states: { "binary_sensor.home_day": { state: "on", attributes: {} }, "sensor.t": { state: "12", attributes: { state: "x" } } } };
  assert.equal(sc.condMet(hass, { entity_id: "binary_sensor.home_day", attribute: "state", match_type: "is", value: "on" }), true);
  assert.equal(sc.condMet(hass, { entity_id: "binary_sensor.home_day", attribute: "state", match_type: "not", value: "on" }), false);
  assert.equal(sc.condMet(hass, { entity_id: "sensor.t", attribute: "state", match_type: "below", value: 15 }), true);
});

test("off by default: the tiles look as before", () => {
  assert.doesNotMatch(card().html(), /class="on cs/);
});

test("met: a green pulsing dot; condition_status_animation: false keeps it still", () => {
  assert.match(heatingRow(card({ show_condition_status: true }).html()), /class="on cs cs-met pulse" title="Conditions met"/);
  assert.match(heatingRow(card({ show_condition_status: true, condition_status_animation: false }).html()), /class="on cs cs-met" title/);
});

test("not met: skipped without track_conditions, waiting with it, the failed condition in the tooltip", () => {
  const away = (h) => (h.states["group.family"] = { ...h.states["group.family"], state: "not_home" });
  const skipped = heatingRow(card({ show_condition_status: true }, away).html());
  assert.match(skipped, /class="on cs cs-skip" title="Skipped: conditions not met\n✗ /);
  assert.match(skipped, /aria-label="[^"]*· Skipped: conditions not met"/);
  const tracked = (h) => {
    away(h);
    for (const ts of h._ws.find((x) => x.entity_id === HEATING).timeslots) ts.track_conditions = true;
  };
  assert.match(heatingRow(card({ show_condition_status: true }, tracked).html()), /class="on cs cs-wait" title="Waiting for its conditions/);
  const gone = (h) => delete h.states["group.family"];
  assert.match(heatingRow(card({ show_condition_status: true }, gone).html()), /\(unavailable\)/);
});

test("the conditions' entities are part of the render signature", () => {
  const { el } = card({ show_condition_status: true });
  const ids = el._condEntities();
  assert.ok(ids.includes("group.family") && ids.includes("sensor.outdoor_temperature"));
});

test("the capture's mock: met, waiting and skipped side by side", async () => {
  const { CONDITIONS_HASS } = await import("../scripts/screenshots/list.mjs");
  const h = mockHass(CONDITIONS_HASS);
  const el = new sc.SchedulerCard();
  el._nowMs = () => NOW;
  el.setConfig({ type: "custom:scheduler-card", show_condition_status: true });
  el._hass = h;
  el._items = new Map(h._ws.map((x) => [x.entity_id, x]));
  const out = el._render();
  const dot = (id) => /class="on cs cs-(\w+)/.exec(out.slice(out.indexOf(`data-key="switch.schedule_${id}"`)))[1];
  assert.equal(dot("living_room_heating"), "met");
  assert.equal(dot("water_heater"), "wait");
  assert.equal(dot("garden_lights"), "skip");
});
