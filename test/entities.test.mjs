// The entities of an existing schedule in the slot editor (#23): shown above the times, changed for every slot,
// a slot's actions edited entity by entity when they differ, and their names on the tiles (show_entities).
import assert from "node:assert/strict";
import { test } from "node:test";
import { MULTI_ACTIONS, mockHass, NOW } from "../scripts/screenshots/mock.mjs";
import { load } from "./load.mjs";

const sc = load(["SchedulerCard", "SchedulerCardEditor", "remapActions", "scheduleEntities"]);
const plain = (v) => JSON.parse(JSON.stringify(v));
const eq = (a, b, msg) => assert.deepEqual(plain(a), plain(b), msg);

const GARDEN = "switch.schedule_garden_lights";
const HEATING = "switch.schedule_living_room_heating";

const hassWith = (opts = {}) => {
  const h = mockHass(opts);
  h.calls = [];
  h.callService = async (domain, service, data) => {
    h.calls.push([domain, service, data]);
  };
  h.callWS = async (msg) => (msg.type === "scheduler" ? h._ws : msg.type === "scheduler/item" ? h._ws.find((s) => s.schedule_id === msg.schedule_id) : null);
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
  el._render();
  return el;
};
// The input and change events of the popup, on a stub element.
const input = (el, dataset, value, change = true) => el._input({ composedPath: () => [{ dataset, value, tagName: "INPUT" }] }, change);
const click = (el, dataset) => {
  const node = { dataset };
  el._clickEdit({}, [node], dataset.action);
};

test("the schedule's entities, and a slot's actions mapped onto new entities", () => {
  eq(sc.scheduleEntities({ timeslots: [{ actions: [{ entity_id: "a" }, { entity_id: "b" }] }, { actions: [{ entity_id: "a" }, { service: "script.x" }] }] }), ["a", "b"]);
  const acts = [
    { service: "light.turn_on", entity_id: "a", service_data: { brightness: 255 } },
    { service: "light.turn_on", entity_id: "b", service_data: { brightness: 38 } },
  ];
  // b kept with its own data, c added with a's action, a removed.
  eq(sc.remapActions(acts, ["b", "c"], ["a", "b"]), [acts[1], { ...acts[0], entity_id: "c" }]);
  // A slot acting only on a keeps acting only on it when b stays a schedule entity.
  eq(sc.remapActions([acts[0]], ["a", "b"], ["a", "b"]), [acts[0]]);
  // Actions without an entity stay as they are.
  eq(sc.remapActions([{ service: "script.x" }], ["c"], []), [{ service: "script.x" }]);
});

test("the slot editor shows the schedule's entities above the times, and a Change button", async () => {
  const el = card();
  await el._openSlot(HEATING, 3);
  const html = el._render();
  assert.match(html, /<label>Entities<\/label>/);
  assert.ok(html.indexOf('data-key="pent-climate.living_room"') < html.indexOf('for="sc-start"'), "entities above the start");
  assert.match(html, /<span class="en">Living room<\/span>/);
  assert.match(html, /They apply to the whole schedule, like the days\./);
  assert.match(html, /data-action="change-entities"/);
  assert.ok(!/data-pent=/.test(html), "no picker before Change");
  // Change: a picker of the same kind only, the only entity cannot be removed.
  click(el, { action: "change-entities" });
  const open = el._render();
  assert.match(open, /data-pent="1"/);
  assert.match(open, /<option value="climate.bedroom">/);
  assert.ok(!/<option value="light.garden">/.test(open), "same domain only");
  assert.ok(!/data-unpent=/.test(open), "one entity left: not removable");
});

test("changed entities apply to every slot, conditions and dates kept, with scheduler.edit", async () => {
  const h = hassWith();
  const el = card({}, h);
  await el._openSlot(HEATING, 3);
  click(el, { action: "change-entities" });
  input(el, { pent: "1" }, "climate.bedroom");
  eq(el._edit.draft.ents, ["climate.living_room", "climate.bedroom"]);
  click(el, { unpent: "climate.living_room" });
  eq(el._edit.draft.ents, ["climate.bedroom"]);
  // Another kind is refused.
  input(el, { pent: "1" }, "light.garden");
  eq(el._edit.draft.ents, ["climate.bedroom"]);
  await el._save();
  const [domain, service, data] = h.calls.at(-1);
  eq([domain, service, data.entity_id], ["scheduler", "edit", HEATING]);
  assert.equal(data.timeslots.length, 5);
  for (const ts of data.timeslots) {
    eq(ts.actions.map((a) => a.entity_id), ["climate.bedroom"]);
    eq(ts.conditions, [{ entity_id: "group.family", value: "home", match_type: "is" }]);
  }
  // Each slot keeps its own temperature.
  eq(data.timeslots.map((ts) => ts.actions[0].service_data.temperature), [17, 20, 17, 20, 17]);
});

test("a slot whose entities have different actions is edited entity by entity, kept as read when untouched", async () => {
  const h = hassWith({ actions: MULTI_ACTIONS });
  const el = card({}, h);
  await el._openSlot(GARDEN, 0);
  const e = el._edit;
  eq(e.draft.per.map((p) => p.entity), ["light.garden", "light.terrace"]);
  const html = el._render();
  assert.match(html, /class="pe" data-key="pe-light.garden"/);
  assert.match(html, /class="pe" data-key="pe-light.terrace"/);
  assert.match(html, /<span class="en">Terrace wall light<\/span>/);
  assert.ok(!/id="sc-act"/.test(html), "no single action field");
  // Only the time changes: both actions go back exactly as stored.
  e.draft.start = "18:30";
  let r = el._slotsAfterEdit(e);
  eq(r.slots[0].actions, MULTI_ACTIONS.garden_lights);
  assert.equal(r.slots[0].start, "18:30:00");
  // The terrace light turned off: only its action changes.
  const off = e.perOptions.get("light.terrace").options.find((o) => o.service === "light.turn_off");
  input(el, { pe: "1", field: "action" }, off.key);
  r = el._slotsAfterEdit(e);
  eq(r.slots[0].actions, [MULTI_ACTIONS.garden_lights[0], { service: "light.turn_off", entity_id: "light.terrace" }]);
  // A third light takes the first one's action.
  click(el, { action: "change-entities" });
  input(el, { pent: "1" }, "light.porch");
  r = el._slotsAfterEdit(e);
  eq(r.slots[0].actions.at(-1), { service: "light.turn_on", entity_id: "light.porch", service_data: { brightness: 255 } });
});

test("a slot whose entities share the action keeps a single Action field, its stored actions sent back", async () => {
  const el = card();
  await el._openSlot(HEATING, 3);
  assert.equal(el._edit.draft.per, undefined);
  assert.match(el._render(), /id="sc-act"/);
  el._edit.draft.stop = "22:00";
  const r = el._slotsAfterEdit(el._edit);
  const slot = r.slots.find((s) => s.start === "17:30:00");
  eq(slot.actions, [{ service: "climate.set_temperature", entity_id: "climate.living_room", service_data: { temperature: 20 } }]);
});

test("show_entities: the entities' names under the state line, off by default, in the visual editor", () => {
  const h = hassWith({ actions: MULTI_ACTIONS });
  assert.ok(!/class="ens"/.test(card({}, h)._render()));
  const html = card({ show_entities: true }, h)._render();
  assert.match(html, /<span class="ens">Garden lights, Terrace wall light<\/span>/);
  const ed = new sc.SchedulerCardEditor();
  ed._hass = h;
  ed._config = {};
  const names = JSON.stringify(ed._schema());
  assert.match(names, /"show_entities"/);
});
