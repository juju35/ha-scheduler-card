// ---------------------------------------------------------------------------
// Schedules (switch.schedule_* entities of the Scheduler component)
// ---------------------------------------------------------------------------
import { domainOf } from "./helpers.js";
import { DAY, WEEKDAYS, parseTime } from "./time.js";

export const PLATFORM = "scheduler";

// The schedule entities: the scheduler platform's registry entries, else (no registry, or none of them in it, as in
// some setups) any switch.schedule_* entity carrying the component's attributes. The registry scan is kept per
// registry object: the card looks its schedules up on every state change, which should not walk every entity and
// every state each time.
export const _scheduleIds = new WeakMap();
export const discover = (hass) => {
  const states = hass?.states || {};
  const reg = hass?.entities;
  let known = reg ? _scheduleIds.get(reg) : null;
  if (!known) {
    known = Object.values(reg || {})
      .filter((e) => e?.platform === PLATFORM && domainOf(e.entity_id) === "switch")
      .map((e) => e.entity_id);
    if (reg) _scheduleIds.set(reg, known);
  }
  const ids = known.filter((id) => states[id]);
  if (ids.length) return ids;
  return Object.keys(states).filter((id) => id.startsWith("switch.schedule_") && Array.isArray(states[id]?.attributes?.timeslots));
};

// The workdays (0 = Monday) of the workday sensor, Monday to Friday without it.
export const WORKDAY_ENTITY = "binary_sensor.workday_sensor";
export const workdaysOf = (hass) => {
  const w = hass?.states?.[WORKDAY_ENTITY]?.attributes?.workdays;
  const days = Array.isArray(w) ? w.map((d) => WEEKDAYS.indexOf(String(d).toLowerCase())).filter((d) => d >= 0) : [];
  return days.length ? days : [0, 1, 2, 3, 4];
};

// Does a schedule run on weekday `wd`? `today` uses the workday sensor's state for workday / weekend schedules.
export const runsOn = (weekdays, wd, hass, today = false) => {
  const list = Array.isArray(weekdays) && weekdays.length ? weekdays : ["daily"];
  const sensor = hass?.states?.[WORKDAY_ENTITY]?.state;
  return list.some((w) => {
    if (w === "daily") return true;
    if (w === "workday" || w === "weekend") {
      const work = today && (sensor === "on" || sensor === "off") ? sensor === "on" : workdaysOf(hass).includes(wd);
      return w === "workday" ? work : !work;
    }
    return WEEKDAYS.indexOf(w) === wd;
  });
};

// The slots of a schedule, from its `timeslots` ("06:30:00 - 08:30:00", "18:45:00") and `actions` attributes.
export const slotsOf = (attrs, sun) =>
  (Array.isArray(attrs?.timeslots) ? attrs.timeslots : [])
    .map((ts, i) => {
      const [a, b] = String(ts).split(" - ");
      const s = parseTime(a, sun);
      const e = b !== undefined ? parseTime(b, sun) : null;
      const act = (Array.isArray(attrs.actions) && attrs.actions[i]) || {};
      if (!s) return null;
      let stop = e ? e.min : null;
      if (stop !== null && stop === 0 && s.min > 0) stop = DAY;
      return {
        i,
        start: s.min,
        stop,
        startRaw: a.trim(),
        stopRaw: b !== undefined ? b.trim() : null,
        sun: !!(s.sun || e?.sun),
        action: { service: String(act.service || ""), data: act.data || act.service_data || {} },
      };
    })
    .filter(Boolean);
