// Mock Scheduler component entities for the screenshots and the tests: six neutral schedules (heating, blinds,
// garden lights, water heater, away mode) on a fixed clock (NOW, a Monday at 17:40), with the attributes the
// component's switch.schedule_* entities carry, and the full schedules its `scheduler` websocket command returns.
export const TIME_ZONE = "Europe/Paris";
export const NOW = Date.parse("2026-06-15T17:40:00+02:00");
// A moment of the mock day (local time "HH:MM", or the next day with `day: 1`).
export const at = (time, day = 0) => NOW + (Date.parse(`2026-06-15T${time}:00+02:00`) - NOW) + day * 86400000;
const SUNRISE = "05:47";
const SUNSET = "21:56";

const st = (entity_id, state, attributes = {}) => ({ entity_id, state: String(state), attributes, last_changed: new Date(NOW).toISOString() });

// The entities the schedules act on.
const TARGETS = {
  "climate.living_room": st("climate.living_room", "heat", {
    friendly_name: "Living room", icon: "mdi:fire", temperature: 20, current_temperature: 19.5, min_temp: 7, max_temp: 30,
    target_temp_step: 0.5, hvac_modes: ["off", "heat"],
  }),
  "climate.bedroom": st("climate.bedroom", "heat", {
    friendly_name: "Bedroom", icon: "mdi:fire", temperature: 17, current_temperature: 18, min_temp: 7, max_temp: 30, target_temp_step: 0.5,
    hvac_modes: ["off", "heat"], preset_modes: ["comfort", "eco", "away"], preset_mode: "eco",
  }),
  "cover.living_room_blinds": st("cover.living_room_blinds", "open", { friendly_name: "Living room blinds", icon: "mdi:blinds", current_position: 100 }),
  "light.garden": st("light.garden", "off", { friendly_name: "Garden lights", icon: "mdi:lightbulb" }),
  "water_heater.boiler": st("water_heater.boiler", "off", { friendly_name: "Water heater", icon: "mdi:water", operation_list: ["eco", "electric"] }),
  "input_boolean.away_mode": st("input_boolean.away_mode", "off", { friendly_name: "Away mode", icon: "mdi:home" }),
};

const temp = (entity_id, temperature) => ({ service: "climate.set_temperature", entity_id, service_data: { temperature } });
const preset = (entity_id, preset_mode) => ({ service: "climate.set_preset_mode", entity_id, service_data: { preset_mode } });
const call = (service, entity_id) => ({ service, entity_id, service_data: {} });

// [slug, name, weekdays, [start, stop | null, action], enabled]
const SCHEDULES = [
  ["living_room_heating", "Living room heating", ["workday"], [
    ["00:00:00", "06:30:00", temp("climate.living_room", 17)],
    ["06:30:00", "08:30:00", temp("climate.living_room", 20)],
    ["08:30:00", "17:30:00", temp("climate.living_room", 17)],
    ["17:30:00", "22:30:00", temp("climate.living_room", 20)],
    ["22:30:00", "00:00:00", temp("climate.living_room", 17)],
  ], true],
  ["bedroom_heating", "Bedroom heating", ["daily"], [
    ["06:00:00", null, preset("climate.bedroom", "comfort")],
    ["07:30:00", null, preset("climate.bedroom", "eco")],
    ["21:00:00", null, preset("climate.bedroom", "comfort")],
    ["23:00:00", null, preset("climate.bedroom", "eco")],
  ], true],
  ["living_room_blinds", "Living room blinds", ["daily"], [
    ["07:30:00", null, call("cover.open_cover", "cover.living_room_blinds")],
    ["18:45:00", null, call("cover.close_cover", "cover.living_room_blinds")],
  ], true],
  ["garden_lights", "Garden lights", ["daily"], [["18:00:00", "23:30:00", call("light.turn_on", "light.garden")]], true],
  ["water_heater", "Water heater", ["daily"], [["02:00:00", "06:00:00", call("water_heater.turn_on", "water_heater.boiler")]], true],
  ["away_mode", "Away mode", ["mon", "tue", "wed", "thu", "fri"], [["09:00:00", "17:00:00", call("input_boolean.turn_on", "input_boolean.away_mode")]], false],
];

const ws = SCHEDULES.map(([slug, name, weekdays, slots, enabled], k) => ({
  schedule_id: `a1b2c${k}`,
  entity_id: `switch.schedule_${slug}`,
  name,
  weekdays,
  start_date: null,
  end_date: null,
  repeat_type: "repeat",
  enabled,
  tags: k < 2 ? ["heating"] : [],
  timeslots: slots.map(([start, stop, action]) => ({ start, stop, conditions: [], condition_type: null, track_conditions: false, actions: [action] })),
  next_entries: [],
  timestamps: [],
}));

const minutes = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
// Minutes of the day, local time of the mock.
const localMin = (ms) => {
  const local = new Date(ms + 2 * 3600000);
  return local.getUTCHours() * 60 + local.getUTCMinutes();
};

// The switch.schedule_* entities at `now`: `current_slot` is the slot (with an end) the clock is in, as the component
// sets it (the mock day is a Monday, a workday).
const schedulesAt = (now) =>
  Object.fromEntries(
    SCHEDULES.map(([slug, name, weekdays, slots, enabled], k) => {
      const id = `switch.schedule_${slug}`;
      const m = localMin(now);
      const current = enabled
        ? slots.findIndex(([start, stop]) => stop && m >= minutes(start) && m < (minutes(stop) || 1440))
        : -1;
      return [
        id,
        st(id, enabled ? "on" : "off", {
          weekdays,
          timeslots: slots.map(([start, stop]) => (stop ? `${start} - ${stop}` : start)),
          entities: [...new Set(slots.map(([, , a]) => a.entity_id))],
          actions: slots.map(([, , a]) => (Object.keys(a.service_data).length ? { service: a.service, data: a.service_data } : { service: a.service })),
          current_slot: current < 0 ? null : current,
          next_slot: null,
          next_trigger: null,
          tags: ws[k].tags,
          friendly_name: name,
          icon: "mdi:calendar-clock",
        }),
      ];
    }),
  );

// The mock's sun: day between sunrise and sunset of the mock day.
const sunState = (ms) => (localMin(ms) >= minutes(SUNRISE) && localMin(ms) < minutes(SUNSET) ? "above_horizon" : "below_horizon");

export const mockHass = ({ language = "en", dark = false, now = NOW, schedules: only, sun = true } = {}) => {
  const schedules = schedulesAt(now);
  const states = { ...TARGETS, ...(only ? Object.fromEntries(Object.entries(schedules).filter(([id]) => only.includes(id))) : schedules) };
  states["binary_sensor.workday_sensor"] = st("binary_sensor.workday_sensor", "on", { workdays: ["mon", "tue", "wed", "thu", "fri"] });
  if (sun)
    states["sun.sun"] = st("sun.sun", sunState(now), {
      next_rising: `2026-06-16T${SUNRISE}:00+02:00`,
      next_setting: `2026-06-15T${SUNSET}:00+02:00`,
    });
  return {
    states,
    entities: {},
    language,
    locale: { language, time_format: "24", time_zone: "server" },
    config: { time_zone: TIME_ZONE, unit_system: { temperature: "°C" } },
    themes: { darkMode: dark },
    // The `scheduler` websocket command's answer (plain data: the harness wraps it in callWS).
    _ws: ws,
  };
};
