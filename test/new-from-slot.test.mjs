// A slot added on days its schedule does not run: saved as a new schedule (scheduler.add), not as a slot of the
// schedule, whose slots run on all its days and would be refused as overlapping.
import assert from "node:assert/strict";
import { test } from "node:test";
import { mockHass, NOW } from "../scripts/screenshots/mock.mjs";
import { load } from "./load.mjs";

const sc = load(["SchedulerCard"]);
const plain = (v) => JSON.parse(JSON.stringify(v));

// Workdays, 00:00 → 00:00: any slot added to it on the same days overlaps.
const HEATING = "switch.schedule_living_room_heating";

const card = () => {
  const h = mockHass();
  h.calls = [];
  h.callService = async (domain, service, data) => {
    h.calls.push([domain, service, data]);
  };
  h.callWS = async (msg) => (msg.type === "scheduler" ? h._ws : msg.type === "scheduler/item" ? h._ws.find((s) => s.schedule_id === msg.schedule_id) : null);
  const el = new sc.SchedulerCard();
  el._nowMs = () => NOW;
  el.setConfig({ type: "custom:x" });
  el._hass = h;
  el._update = function () {
    this._html = this._render();
  };
  el._render();
  return { el, h };
};

test("a click on a day the schedule does not run adds a new schedule on that day", async () => {
  const { el, h } = card();
  await el._openSlot(HEATING, null, 9 * 60, false, 5);
  eq(el._edit.draft.dayMode, "custom");
  eq([...el._edit.draft.days], [5]);
  assert.match(el._render(), /saved as a new schedule/);
  await el._save();
  const [domain, service, data] = h.calls.at(-1);
  eq([domain, service], ["scheduler", "add"]);
  eq(data.weekdays, ["sat"]);
  eq(data.timeslots.length, 1);
  eq([data.timeslots[0].start, data.timeslots[0].stop], ["09:00:00", "10:00:00"]);
  eq(data.timeslots[0].actions[0].entity_id, "climate.living_room");
  assert.equal(data.name, undefined, "the schedule's name is not copied");
  assert.equal(el._edit, null);
});

test("a slot added on the schedule's own days still goes into it, and is refused when it overlaps", async () => {
  const { el, h } = card();
  await el._openSlot(HEATING, null, 9 * 60, false, 0);
  eq(el._edit.draft.dayMode, "workday");
  assert.doesNotMatch(el._render(), /saved as a new schedule/);
  await el._save();
  assert.equal(h.calls.length, 0);
  assert.match(el._edit.error, /overlaps/);
});

test("days changed to others in the Add slot popup: a new schedule too", async () => {
  const { el, h } = card();
  await el._openSlot(HEATING, null);
  Object.assign(el._edit.draft, { dayMode: "weekend" });
  await el._save();
  const [, service, data] = h.calls.at(-1);
  eq([service, data.weekdays], ["add", ["weekend"]]);
});

function eq(a, b, msg) {
  assert.deepEqual(plain(a), plain(b), msg);
}
