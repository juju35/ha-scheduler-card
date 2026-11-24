// ---------------------------------------------------------------------------
// Actions: what a slot does, in words, and its colour
// ---------------------------------------------------------------------------
import { cap, domainOf, num } from "./helpers.js";
import { DAY, WEEKDAYS, hm, parseTime, sunTimes } from "./time.js";
import { runsOn, slotsOf, workdaysOf } from "./schedules.js";

export const OFF_COLOR = "#9e9e9e";
export const ACCENT = "#0f8b8d";
export const DOMAIN_COLORS = {
  climate: "#ff9800",
  water_heater: "#00acc1",
  cover: "#039be5",
  valve: "#039be5",
  light: "#ffb300",
  switch: "#03a9f4",
  input_boolean: "#03a9f4",
  automation: "#03a9f4",
  fan: "#26a69a",
  humidifier: "#26a69a",
  media_player: "#7e57c2",
  lock: "#43a047",
  vacuum: "#8d6e63",
  script: ACCENT,
  scene: ACCENT,
};
export const DOMAIN_ICONS = {
  climate: "mdi:thermostat",
  water_heater: "mdi:water-boiler",
  cover: "mdi:window-shutter",
  valve: "mdi:valve",
  light: "mdi:lightbulb",
  switch: "mdi:toggle-switch-variant",
  input_boolean: "mdi:toggle-switch-outline",
  automation: "mdi:robot",
  fan: "mdi:fan",
  humidifier: "mdi:air-humidifier",
  media_player: "mdi:speaker",
  lock: "mdi:lock",
  vacuum: "mdi:robot-vacuum",
  script: "mdi:script-text",
  scene: "mdi:palette",
  input_number: "mdi:ray-vertex",
  number: "mdi:ray-vertex",
  select: "mdi:format-list-bulleted",
  input_select: "mdi:format-list-bulleted",
  notify: "mdi:message-text",
};
// Climate presets keep their usual colours: comfort warm, eco cool.
export const PRESET_COLORS = { comfort: "#ff9800", home: "#ff9800", boost: "#f4511e", eco: "#00acc1", away: "#78909c", sleep: "#5c6bc0", frost_protection: "#4fc3f7", none: OFF_COLOR };
export const PALETTE = ["#7e57c2", "#ec407a", "#43a047", "#5c6bc0", "#8d6e63"];
export const COOL = "#00acc1";

// A stable key for an action (service and data, keys sorted).
export const actionKey = (service, data) => {
  const d = data && typeof data === "object" ? data : {};
  return `${service}|${JSON.stringify(Object.fromEntries(Object.keys(d).sort().map((k) => [k, d[k]])))}`;
};

export const fmtNum = (v, loc) => {
  try {
    return new Intl.NumberFormat(loc, { maximumFractionDigits: 1 }).format(Number(v));
  } catch (_e) {
    return String(v);
  }
};

// What an action does: `label` (« 20 °C », « On 60 % », « Comfort »), `short` (the grid's block: « 20° »),
// `verb` (a built-in word, lowered inside a sentence), `off` (turns something off, closes it), `num` (a temperature).
export const actionInfo = (hass, tr, loc, action, entityId) => {
  const service = String(action?.service || "");
  const [domain, svc = ""] = service.split(".");
  const d = action?.data || {};
  const st = hass?.states?.[entityId];
  const verb = (k, extra = {}) => ({ label: tr(k), short: tr(k), verb: true, off: false, ...extra });
  const attr = (field, v) => {
    try {
      const f = st && hass.formatEntityAttributeValue?.(st, field, v);
      if (f && f !== String(v)) return f;
    } catch (_e) {
      /* raw value below */
    }
    return cap(v);
  };
  const unit = st?.attributes?.temperature_unit || hass?.config?.unit_system?.temperature || "°C";
  const temp = (v) => ({ label: `${fmtNum(v, loc)} ${unit}`, short: `${fmtNum(v, loc)}°`, verb: false, off: false, num: Number(v) });
  const pct = (v) => `${fmtNum(v, loc)} %`;
  let out;
  if (svc === "set_temperature" && d.hvac_mode === "off") out = verb("act_off", { off: true });
  else if (svc === "set_temperature" && num(d.temperature) !== null) out = temp(d.temperature);
  else if (svc === "set_temperature" && num(d.target_temp_low) !== null && num(d.target_temp_high) !== null)
    out = { label: `${fmtNum(d.target_temp_low, loc)}–${fmtNum(d.target_temp_high, loc)} ${unit}`, short: `${fmtNum(d.target_temp_low, loc)}–${fmtNum(d.target_temp_high, loc)}°`, verb: false, off: false, num: Number(d.target_temp_high) };
  else if (svc === "set_preset_mode" && d.preset_mode !== undefined) {
    const v = attr("preset_mode", d.preset_mode);
    out = { label: v, short: v, verb: false, off: d.preset_mode === "none", preset: String(d.preset_mode) };
  } else if (svc === "set_hvac_mode" && d.hvac_mode !== undefined) {
    if (d.hvac_mode === "off") out = verb("act_off", { off: true });
    else {
      const v = hass?.localize?.(`component.climate.entity_component._.state.${d.hvac_mode}`) || cap(d.hvac_mode);
      out = { label: v, short: v, verb: false, off: false };
    }
  } else if (svc === "set_operation_mode" && d.operation_mode !== undefined) {
    const v = attr("operation_mode", d.operation_mode);
    out = { label: v, short: v, verb: false, off: d.operation_mode === "off" };
  } else if (domain === "script" && svc !== "turn_off") out = verb("act_run");
  else if (domain === "scene") out = verb("act_activate");
  else if (svc === "turn_on") {
    const b = num(d.brightness_pct) ?? (num(d.brightness) !== null ? Math.round((num(d.brightness) / 255) * 100) : null);
    const p = num(d.percentage);
    const v = b ?? p;
    out = v !== null ? { label: `${tr("act_on")} ${pct(v)}`, short: pct(v), verb: true, off: false } : verb("act_on");
  } else if (svc === "turn_off") out = verb("act_off", { off: true });
  else if (svc === "toggle") out = verb("act_toggle");
  else if (svc === "open_cover" || svc === "open_valve") out = verb("act_open");
  else if (svc === "close_cover" || svc === "close_valve") out = verb("act_close", { off: true });
  else if (svc === "stop_cover" || svc === "stop_valve") out = verb("act_stop");
  else if (svc === "set_cover_position" || svc === "set_valve_position") {
    const p = num(d.position) ?? 0;
    out = { label: `${tr("act_position")} ${pct(p)}`, short: pct(p), verb: false, off: p === 0 };
  } else if (svc === "set_value" && d.value !== undefined) {
    const u = st?.attributes?.unit_of_measurement;
    const v = num(d.value) !== null ? fmtNum(d.value, loc) : String(d.value);
    out = { label: u ? `${v} ${u}` : v, short: v, verb: false, off: false, num: num(d.value) ?? undefined };
  } else if (svc === "select_option" && d.option !== undefined) out = { label: String(d.option), short: String(d.option), verb: false, off: false };
  else if (svc === "set_humidity" && d.humidity !== undefined) out = { label: pct(d.humidity), short: pct(d.humidity), verb: false, off: false };
  else if (svc === "lock") out = verb("act_lock");
  else if (svc === "unlock") out = verb("act_unlock", { off: true });
  else if (svc === "start") out = verb("act_start");
  else if (svc === "return_to_base") out = verb("act_dock", { off: true });
  else if (svc === "media_play") out = verb("act_play");
  else if (svc === "media_pause" || svc === "media_stop") out = verb("act_pause", { off: true });
  else {
    const name = hass?.services?.[domain]?.[svc]?.name || cap(svc || service);
    out = { label: name, short: name, verb: false, off: false };
  }
  return { ...out, key: actionKey(service, d) };
};

// The colours of a schedule's values: off-like values grey; temperatures from warm (highest) to cool (lowest);
// presets by name; others the domain's colour, then a palette.
export const valueColors = (infos, base) => {
  const colors = new Map();
  const vals = [];
  for (const i of infos) if (!colors.has(i.key) && !vals.some((v) => v.key === i.key)) vals.push(i);
  const on = vals.filter((v) => !v.off);
  for (const v of vals) if (v.off) colors.set(v.key, OFF_COLOR);
  const temps = on.filter((v) => typeof v.num === "number").sort((a, b) => b.num - a.num);
  if (temps.length === on.length && temps.length > 1) {
    temps.forEach((v, k) => {
      colors.set(v.key, k === 0 ? base : k === temps.length - 1 ? COOL : PALETTE[(k - 1) % PALETTE.length]);
    });
    return colors;
  }
  let k = 0;
  for (const v of on) {
    if (v.preset && PRESET_COLORS[v.preset]) colors.set(v.key, PRESET_COLORS[v.preset]);
    else colors.set(v.key, k++ === 0 ? base : PALETTE[(k - 2) % PALETTE.length]);
  }
  return colors;
};

// The spans of a day drawn for a schedule: a slot with an end is drawn from its start to its end (split at
// midnight); a single action that turns something on (lights on, blinds open) is drawn until the next slot when
// that one turns it off. Other single actions are points.
export const segmentsOf = (slots, infos) => {
  const spans = [];
  const points = [];
  const sorted = [...slots].sort((a, b) => a.start - b.start);
  sorted.forEach((s, k) => {
    const info = infos.get(s.i);
    if (s.stop !== null && s.stop !== s.start) {
      if (s.stop > s.start) spans.push({ a: s.start, b: s.stop, slot: s });
      else {
        spans.push({ a: s.start, b: DAY, slot: s });
        if (s.stop > 0) spans.push({ a: 0, b: s.stop, slot: s });
      }
      return;
    }
    const next = sorted[k + 1];
    if (info && !info.off && next && next.stop === null && infos.get(next.i)?.off) spans.push({ a: s.start, b: next.start, slot: s, until: next });
    else points.push({ at: s.start, slot: s });
  });
  return { spans, points };
};

// The value drawn as the grid's background: when the slots cover the whole day, the value held the longest.
export const defaultValue = (slots, infos) => {
  if (slots.length < 2 || slots.some((s) => s.stop === null)) return null;
  const covered = new Array(DAY).fill(false);
  const total = new Map();
  for (const s of slots) {
    const len = s.stop > s.start ? s.stop - s.start : DAY - s.start + s.stop;
    for (let m = 0; m < len; m++) covered[(s.start + m) % DAY] = true;
    const key = infos.get(s.i)?.key;
    total.set(key, (total.get(key) || 0) + len);
  }
  if (covered.some((c) => !c)) return null;
  return [...total.entries()].sort((a, b) => b[1] - a[1])[0][0];
};

// The card's view of a schedule entity (`item`: its full schedule from the `scheduler` websocket command, for its
// conditions, dates and repetition).
export const scheduleModel = (hass, config, id, tr, loc, item = null) => {
  const st = hass.states[id];
  const a = st.attributes || {};
  const sun = sunTimes(hass);
  const slots = slotsOf(a, sun);
  const entities = Array.isArray(a.entities) ? a.entities : [];
  const target = entities[0];
  const domain = domainOf(target) || domainOf(slots[0]?.action.service);
  const base = DOMAIN_COLORS[domain] || ACCENT;
  const infos = new Map(slots.map((s) => [s.i, actionInfo(hass, tr, loc, s.action, target)]));
  const colors = valueColors([...infos.values()], base);
  const names = config?.names && typeof config.names === "object" ? config.names : {};
  const ts = hass.states[target];
  return {
    def: defaultValue(slots, infos),
    id,
    st,
    state: st.state,
    name: names[id] || a.friendly_name || id,
    enabled: !["off", "completed"].includes(st.state),
    weekdays: Array.isArray(a.weekdays) ? a.weekdays : ["daily"],
    slots,
    infos,
    colors,
    entities,
    target,
    domain,
    base,
    icon: ts?.attributes?.icon || DOMAIN_ICONS[domain] || "mdi:calendar-clock",
    current: num(a.current_slot),
    tags: Array.isArray(a.tags) ? a.tags : [],
    opts: item ? optionsOf(item) : null,
    item,
    from: item?.start_date || null,
    to: item?.end_date || null,
  };
};

// The schedules shown: those of the card's `tags` (any of them) and `entities` (schedule entities or the entities
// they act on), disabled ones last unless `show_disabled: false`, by name.
// `tags` also takes `none` (schedules without a tag), `enabled` and `disabled`; `exclude_tags` hides schedules
// carrying one of its tags. `sort_by`: `name` (default), `next` (soonest next action first) or `state` (running first).
export const SPECIAL_TAGS = ["none", "enabled", "disabled"];
export const listOf = (v) => (Array.isArray(v) ? v.map(String) : v !== undefined && v !== null && v !== "" ? [String(v)] : []);
export const pickSchedules = (models, config = {}, rank = null) => {
  const tags = listOf(config.tags);
  const out = listOf(config.exclude_tags);
  const ents = Array.isArray(config.entities) ? config.entities.map((e) => (typeof e === "string" ? e : e?.entity)).filter(Boolean) : [];
  const tagged = (m) =>
    tags.some((x) => (x === "none" ? !m.tags.length : x === "enabled" ? m.enabled : x === "disabled" ? !m.enabled : m.tags.includes(x)));
  const byName = (x, y) => x.name.localeCompare(y.name);
  const sort = config.sort_by === "next" || config.sort_by === "state" ? config.sort_by : "name";
  return models
    .filter((m) => !tags.length || tagged(m))
    .filter((m) => !m.tags.some((x) => out.includes(x)))
    .filter((m) => !ents.length || ents.includes(m.id) || m.entities.some((e) => ents.includes(e)))
    .filter((m) => config.show_disabled !== false || m.state !== "off")
    .sort((x, y) => (x.state === "off") - (y.state === "off") || (sort !== "name" && rank ? rank(x, sort) - rank(y, sort) : 0) || byName(x, y));
};

// The schedules the header switch acts on: those of the card's `tags`, `exclude_tags` and `entities`, the disabled
// ones included and the state tags (`enabled`, `disabled`) left aside, so that it can always turn back on what it
// turned off, even with `show_disabled: false`.
export const toggleTargets = (models, config = {}) =>
  pickSchedules(models, { ...config, show_disabled: true, tags: listOf(config.tags).filter((x) => x !== "enabled" && x !== "disabled") });

// The tags a new schedule gets from the card: its own, the special values left out.
export const cardTags = (config = {}) => listOf(config.tags).filter((x) => !SPECIAL_TAGS.includes(x));

// The next starts of a schedule's slots, from `now` ({ wd, min }) over the next `days` days.
export const occurrences = (m, now, hass, days = 8) => {
  const out = [];
  for (let d = 0; d < days; d++) {
    const wd = (now.wd + d) % 7;
    if (!runsOn(m.weekdays, wd, hass, d === 0)) continue;
    // Outside the schedule's dates: nothing that day.
    const date = now.date && (m.from || m.to) ? addDays(now.date, d) : null;
    if (date && ((m.from && date < m.from) || (m.to && date > m.to))) continue;
    for (const s of m.slots) if (d > 0 || s.start > now.min) out.push({ day: d, at: d * DAY + s.start, slot: s, m });
  }
  return out.sort((a, b) => a.at - b.at);
};

// The next actions of every enabled schedule, soonest first.
export const upcoming = (models, now, hass, n = 3) =>
  models
    .filter((m) => m.enabled)
    .flatMap((m) => occurrences(m, now, hass).slice(0, n))
    .sort((a, b) => a.at - b.at || a.m.name.localeCompare(b.m.name))
    .slice(0, n);

// Whether a condition of the scheduler component holds now: is / not / below / above, on the entity's state (or
// its `attribute`; the component stores `attribute: "state"` for the state itself). An unavailable or unknown entity,
// or a missing attribute, does not meet it.
export const condMet = (hass, c) => {
  const st = hass?.states?.[c?.entity_id];
  if (!st || st.state === "unavailable" || st.state === "unknown") return false;
  const v = c.attribute && c.attribute !== "state" ? st.attributes?.[c.attribute] : st.state;
  if (v === undefined || v === null) return false;
  const n = Number(v);
  const want = Number(c.value);
  const numeric = String(v).trim() !== "" && String(c.value ?? "").trim() !== "" && Number.isFinite(n) && Number.isFinite(want);
  const same = numeric ? n === want : String(v) === String(c.value);
  if (c.match_type === "not") return !same;
  if (c.match_type === "below") return numeric && n < want;
  if (c.match_type === "above") return numeric && n > want;
  return same;
};

// The state of an enabled schedule's conditions (#17), for the slot running now or else its next one: `met`, or,
// when they do not hold, `wait` (track_conditions: the slot starts as soon as they do) or `skip` (the slot is
// skipped). Null without conditions on that slot, or without the full schedule. `failed`: the conditions not met.
export const condState = (hass, m, now) => {
  if (!m.enabled || !m.item) return null;
  const index = m.current ?? occurrences(m, now, hass)[0]?.slot.i;
  const slot = Array.isArray(m.item.timeslots) ? m.item.timeslots[index] : null;
  const conds = Array.isArray(slot?.conditions) ? slot.conditions.filter((c) => c?.entity_id) : [];
  if (!conds.length) return null;
  const failed = conds.filter((c) => !condMet(hass, c));
  const met = slot.condition_type === "or" ? failed.length < conds.length : !failed.length;
  return { state: met ? "met" : slot.track_conditions ? "wait" : "skip", failed, total: conds.length };
};

// The slots of a schedule on a day, with their spans.
export const daySegments = (m) => segmentsOf(m.slots, m.infos);

// Total time per value over a week (minutes), the background value left out.
export const weekTotals = (m, hass, def) => {
  const totals = new Map();
  const { spans } = daySegments(m);
  for (let wd = 0; wd < 7; wd++) {
    if (!runsOn(m.weekdays, wd, hass)) continue;
    for (const sp of spans) {
      const info = m.infos.get(sp.slot.i);
      if (!info || info.off || info.key === def) continue;
      totals.set(info.key, (totals.get(info.key) || 0) + (sp.b - sp.a));
    }
  }
  return totals;
};

// A timeslot of the websocket's schedule, cleaned for the scheduler.edit / scheduler.add schemas: no empty
// conditions list, no null end, condition type or attribute (each fails its validator).
export const cleanSlot = (s) => {
  const out = { start: String(s.start) };
  if (s.stop) out.stop = String(s.stop);
  const conds = Array.isArray(s.conditions) ? s.conditions : [];
  if (conds.length) {
    out.conditions = conds.map((c) => {
      const o = { entity_id: c.entity_id, value: c.value, match_type: c.match_type };
      if (c.attribute) o.attribute = c.attribute;
      return o;
    });
    if (s.condition_type) out.condition_type = s.condition_type;
  }
  if (s.track_conditions) out.track_conditions = true;
  out.actions = (Array.isArray(s.actions) ? s.actions : []).map((a) => {
    const o = { service: a.service };
    if (a.entity_id) o.entity_id = a.entity_id;
    if (a.service_data && Object.keys(a.service_data).length) o.service_data = a.service_data;
    return o;
  });
  return out;
};

// The entities a schedule acts on (#23): the `entity_id` of every slot's actions, in their order, without repeats.
export const scheduleEntities = (item) => {
  const out = [];
  for (const ts of Array.isArray(item?.timeslots) ? item.timeslots : [])
    for (const a of Array.isArray(ts?.actions) ? ts.actions : []) if (a?.entity_id && !out.includes(a.entity_id)) out.push(a.entity_id);
  return out;
};

// A slot's actions on the schedule's new entities `ents` (#23; `prev`: its entities before): each kept entity keeps
// its own action, an added one takes the action of the slot's first entity (a slot that acted on only some of the
// entities keeps acting on those); actions without an entity are kept as they are.
export const remapActions = (actions, ents, prev = []) => {
  const list = Array.isArray(actions) ? actions : [];
  const withId = list.filter((a) => a?.entity_id);
  if (!withId.length || !ents.length) return list;
  const byId = new Map(withId.map((a) => [a.entity_id, a]));
  const kept = ents.filter((id) => byId.has(id) || !prev.includes(id));
  return [...(kept.length ? kept : ents).map((id) => byId.get(id) || { ...withId[0], entity_id: id }), ...list.filter((a) => !a?.entity_id)];
};

// A timeslot's start and end (minutes; an end at midnight closes the day; null without an end).
export const slotRange = (s, sun) => {
  const a = parseTime(s.start, sun)?.min ?? 0;
  const b = s.stop ? (parseTime(s.stop, sun)?.min ?? a) : null;
  return [a, b === null ? null : b === 0 && a > 0 ? DAY : b];
};

// Does timeslot `k` run into another one (same start, or ranges crossing, over midnight too)?
export const slotsClash = (slots, k, sun) => {
  const [a1, b1] = slotRange(slots[k], sun);
  const covers = (a, b, x) => (b > a ? x >= a && x < b : x >= a || x < b);
  return slots.some((o, j) => {
    if (j === k) return false;
    const [a2, b2] = slotRange(o, sun);
    return (
      a1 === a2 ||
      (b1 !== null && b2 !== null && (covers(a1, b1, a2) || covers(a2, b2, a1))) ||
      (b1 !== null && b2 === null && covers(a1, b1, a2)) ||
      (b1 === null && b2 !== null && covers(a2, b2, a1))
    );
  });
};

// Weekdays for the services: every day → daily; workday / weekend kept when the days are theirs.
export const weekdaysPayload = (days, original, hass) => {
  const set = [...days].sort((a, b) => a - b);
  if (set.length === 7) return ["daily"];
  const work = workdaysOf(hass).sort((a, b) => a - b);
  const same = (x) => x.length === set.length && x.every((d, i) => d === set[i]);
  if (original?.length === 1 && original[0] === "workday" && same(work)) return ["workday"];
  if (original?.length === 1 && original[0] === "weekend" && same([0, 1, 2, 3, 4, 5, 6].filter((d) => !work.includes(d)))) return ["weekend"];
  return set.map((d) => WEEKDAYS[d]);
};

// A time of the component split for the editor: "sunset-00:30:00" → { mode: "sunset", sign: "-", off: "00:30" };
// a fixed time → { mode: "time", time: "07:30" }.
export const splitTime = (raw, sun) => {
  const str = String(raw ?? "").trim();
  const r = /^(sunrise|sunset)([+-])(\d{1,2}):(\d{2})/.exec(str);
  if (r) return { mode: r[1], sign: r[2], off: `${r[3].padStart(2, "0")}:${r[4]}`, time: hm(parseTime(str, sun).min) };
  const p = str ? parseTime(str, sun) : null;
  return { mode: "time", sign: "-", off: "00:00", time: p ? hm(p.min) : "" };
};

// The time the component stores: "07:30:00", or "sunset-00:30:00" relative to the sun ("" when no fixed time).
export const joinTime = (mode, time, sign, off) => {
  if (mode === "sunrise" || mode === "sunset") {
    const o = /^(\d{1,2}):(\d{2})$/.exec(String(off || "").trim());
    return `${mode}${sign === "+" ? "+" : "-"}${o ? `${o[1].padStart(2, "0")}:${o[2]}` : "00:00"}:00`;
  }
  return time ? `${time}:00` : "";
};

// The editable options of a schedule (the same for all its slots): name, tags, conditions (from its first slot),
// the dates it runs between and what it does after its last slot.
export const MATCH_TYPES = ["is", "not", "below", "above"];
export const REPEAT_TYPES = ["repeat", "pause", "single"];
export const optionsOf = (item = {}) => {
  const first = (Array.isArray(item.timeslots) ? item.timeslots : [])[0] || {};
  const conds = (Array.isArray(first.conditions) ? first.conditions : []).map((c) => ({
    entity: String(c.entity_id || ""),
    match: MATCH_TYPES.includes(c.match_type) ? c.match_type : "is",
    value: c.value === null || c.value === undefined ? "" : String(c.value),
    ...(c.attribute ? { attribute: c.attribute } : {}),
  }));
  return {
    name: String(item.name || ""),
    tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
    condType: first.condition_type === "or" ? "or" : "and",
    conds,
    track: !!first.track_conditions,
    period: !!(item.start_date || item.end_date),
    from: item.start_date || "",
    to: item.end_date || "",
    repeat: REPEAT_TYPES.includes(item.repeat_type) ? item.repeat_type : "repeat",
  };
};

// The conditions of the options for the services (numbers kept as numbers), or an error key.
export const conditionsPayload = (o) => {
  const out = [];
  for (const c of o.conds) {
    const entity = String(c.entity || "").trim();
    const value = String(c.value ?? "").trim();
    if (!entity || value === "") return { error: "err_condition" };
    const n = num(value);
    const v = (c.match === "below" || c.match === "above") && n !== null ? n : n !== null && /^-?\d+(\.\d+)?$/.test(value) ? n : value;
    out.push({ entity_id: entity, value: v, match_type: c.match, ...(c.attribute ? { attribute: c.attribute } : {}) });
  }
  return { conds: out };
};

// The slots with the options' conditions put on every one of them (none: removed from all).
export const withConditions = (slots, o, conds) =>
  slots.map((s) => {
    const out = { ...s };
    delete out.conditions;
    delete out.condition_type;
    delete out.track_conditions;
    if (conds.length) {
      out.conditions = conds;
      out.condition_type = o.condType;
      if (o.track) out.track_conditions = true;
    }
    return out;
  });

// The variables of a custom action: a number (`min`, `max`, `step`, `unit`, `scale_factor`) or a list of `options`
// (`value`, `name`, `icon`), each with its `name` and `optional`. Keyed by the field of `service_data` they set.
export const actionVars = (vars) => {
  if (!vars || typeof vars !== "object" || Array.isArray(vars)) return [];
  return Object.entries(vars)
    .filter(([field, v]) => field && v && typeof v === "object")
    .map(([field, v]) => {
      const base = { field, label: v.name ? String(v.name) : cap(field.replace(/_/g, " ")), optional: v.optional === true };
      if (Array.isArray(v.options)) {
        const options = v.options
          .map((o) => (o && typeof o === "object" ? o : { value: o }))
          .filter((o) => o.value !== undefined && o.value !== null && o.value !== "")
          .map((o) => ({ value: o.value, label: o.name ? String(o.name) : String(o.value), ...(o.icon ? { icon: String(o.icon) } : {}) }));
        return options.length ? { ...base, type: "list", options } : null;
      }
      const scale = num(v.scale_factor);
      return { ...base, type: "number", min: num(v.min), max: num(v.max), step: num(v.step) ?? "any", unit: v.unit ? String(v.unit) : "", scale: scale && scale > 0 ? scale : 1 };
    })
    .filter(Boolean);
};

// The custom actions of `customize` for an entity: those of its id, then those of its domain.
export const customActions = (config, entityId) => {
  const c = config?.customize && typeof config.customize === "object" ? config.customize : {};
  const list = [...(Array.isArray(c[entityId]) ? c[entityId] : []), ...(Array.isArray(c[domainOf(entityId)]) ? c[domainOf(entityId)] : [])];
  return list
    .filter((a) => a && typeof a.service === "string" && a.service.includes("."))
    .map((a) => {
      const vars = actionVars(a.variables);
      const out = { service: a.service, data: a.service_data && typeof a.service_data === "object" ? a.service_data : {}, name: a.name ? String(a.name) : "" };
      return vars.length ? { ...out, vars } : out;
    });
};

// A number without float noise (21.000000000000004 → 21).
export const tidy = (n) => Math.round(n * 1e6) / 1e6;
export const sameValue = (a, b) => JSON.stringify(a) === JSON.stringify(b) || (num(a) !== null && num(a) === num(b) && typeof a !== "boolean" && typeof b !== "boolean");

// The editor's values of an action with variables, read from a stored action's data: `{ vals, keep }` (`keep`:
// the data the action does not set, kept as is), or null when the stored action is not this one.
export const matchVars = (opt, service, data) => {
  if (!opt?.vars || opt.service !== service) return null;
  const d = data && typeof data === "object" ? data : {};
  for (const [k, v] of Object.entries(opt.data || {})) if (opt.vars.every((x) => x.field !== k) && !sameValue(d[k], v)) return null;
  const vals = {};
  for (const x of opt.vars) {
    const v = d[x.field];
    if (v === undefined || v === null || v === "") {
      if (!x.optional) return null;
      vals[x.field] = "";
    } else if (x.type === "list") {
      const i = x.options.findIndex((o) => sameValue(o.value, v));
      if (i < 0) return null;
      vals[x.field] = String(i);
    } else {
      const n = num(v);
      if (n === null) return null;
      vals[x.field] = String(tidy(n / x.scale));
    }
  }
  const keep = Object.fromEntries(Object.entries(d).filter(([k]) => !(k in (opt.data || {})) && opt.vars.every((x) => x.field !== k)));
  return { vals, keep };
};

// The values a new action with variables starts from: those already chosen when they still fit, else the
// minimum of a number and the first option of a list (empty when optional).
export const varDefaults = (opt, prev = {}) => {
  const vals = {};
  for (const x of opt?.vars || []) {
    const p = prev?.[x.field];
    if (x.type === "list") vals[x.field] = p !== undefined && x.options[Number(p)] ? String(p) : x.optional ? "" : "0";
    else vals[x.field] = p !== undefined && (p === "" ? x.optional : num(p) !== null) ? String(p) : x.optional ? "" : String(x.min ?? 0);
  }
  return vals;
};

// The data of an action with variables: its fixed data, the kept data, then the chosen values (a number scaled by
// its `scale_factor`; an empty optional one left out), or null when a value is missing or out of range.
export const varsData = (opt, vals = {}, keep = {}) => {
  const data = { ...keep, ...(opt.data || {}) };
  for (const x of opt.vars) {
    const raw = String(vals?.[x.field] ?? "").trim();
    delete data[x.field];
    if (raw === "") {
      if (x.optional) continue;
      return null;
    }
    if (x.type === "list") {
      const o = x.options[Number(raw)];
      if (!o) return null;
      data[x.field] = o.value;
    } else {
      const n = num(raw);
      if (n === null || (x.min !== null && n < x.min) || (x.max !== null && n > x.max)) return null;
      data[x.field] = tidy(n * x.scale);
    }
  }
  return data;
};

// The entities a new schedule can act on: the action domains, narrowed by `include` and `exclude` (entity ids or
// domains).
export const pickable = (hass, config = {}) => {
  const inc = listOf(config.include);
  const exc = listOf(config.exclude);
  return Object.keys(hass?.states || {})
    .filter((id) => (inc.length ? matchesAny(id, inc) : ACTION_DOMAINS.includes(domainOf(id))))
    .filter((id) => !matchesAny(id, exc) && !id.startsWith("switch.schedule_"))
    .sort();
};

// Does an entity id match one of these patterns: an entity id, a domain, or a pattern with `*` wildcards
// ("sensor.*_temperature", "binary_sensor.bedroom_*")?
export const globRe = (p) => new RegExp("^" + p.replace(/[.+?^$|()[\]{}\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
export const matchesAny = (id, patterns) =>
  patterns.some((p) => (p.includes("*") ? globRe(p).test(id) : p.includes(".") ? p === id : p === domainOf(id)));

// The entities offered for a condition: every entity, narrowed by `condition_include` and `condition_exclude`
// (entity ids, domains or wildcards), independently of `include` / `exclude`.
export const conditionPickable = (hass, config = {}) => {
  const inc = listOf(config.condition_include);
  const exc = listOf(config.condition_exclude);
  return Object.keys(hass?.states || {})
    .filter((id) => (!inc.length || matchesAny(id, inc)) && !matchesAny(id, exc))
    .sort();
};

// The states of a few domains, for a condition's value.
export const ON_OFF_DOMAINS = ["binary_sensor", "input_boolean", "switch", "light", "fan", "automation", "humidifier", "siren", "remote", "script"];
export const DOMAIN_STATES = {
  sun: ["above_horizon", "below_horizon"],
  cover: ["open", "closed", "opening", "closing"],
  valve: ["open", "closed", "opening", "closing"],
  lock: ["locked", "unlocked", "locking", "unlocking", "jammed", "open"],
  alarm_control_panel: ["disarmed", "armed_home", "armed_away", "armed_night", "armed_vacation", "armed_custom_bypass", "pending", "arming", "triggered"],
  media_player: ["on", "off", "playing", "paused", "idle", "standby", "buffering"],
  vacuum: ["cleaning", "docked", "returning", "idle", "paused", "error"],
  lawn_mower: ["mowing", "docked", "paused", "returning", "error"],
};
export const NUMBER_DOMAINS = ["input_number", "number", "counter"];
// The « Other value… » choice of a condition's list of states: a free value instead.
export const OTHER_VALUE = "__sc_other__";

// The value a condition on an entity takes: { kind: "list", values: [{ value, name }] } (its known states),
// { kind: "number", min, max, step, unit }, or null (a free value). `condition_states` (by entity id, wildcard or
// domain: a list of states — strings or { value, name } — or { min, max, step, unit }) comes first.
export const conditionValues = (hass, config, id) => {
  const custom = config?.condition_states && typeof config.condition_states === "object" ? config.condition_states : {};
  const key = Object.hasOwn(custom, id) ? id : Object.keys(custom).find((k) => k.includes("*") && globRe(k).test(id)) || (Object.hasOwn(custom, domainOf(id)) ? domainOf(id) : null);
  const st = hass?.states?.[id];
  const a = st?.attributes || {};
  const list = (vals) => {
    const values = (Array.isArray(vals) ? vals : [])
      .map((v) => (v && typeof v === "object" ? { value: String(v.value ?? v.state ?? ""), name: v.name ? String(v.name) : "" } : { value: String(v ?? ""), name: "" }))
      .filter((v) => v.value !== "");
    return values.length ? { kind: "list", values: values.filter((v, i) => values.findIndex((x) => x.value === v.value) === i) } : null;
  };
  const range = (r, unit) => ({ kind: "number", min: num(r.min), max: num(r.max), step: num(r.step), unit: r.unit !== undefined ? String(r.unit) : unit || "" });
  if (key !== null) {
    const c = custom[key];
    if (Array.isArray(c)) return list(c);
    if (c && typeof c === "object") return range(c, a.unit_of_measurement);
  }
  if (!st) return null;
  const d = domainOf(id);
  if (ON_OFF_DOMAINS.includes(d)) return list(["on", "off"]);
  if (d === "select" || d === "input_select" || (d === "sensor" && a.device_class === "enum")) return list(a.options);
  if (d === "person" || d === "device_tracker") {
    const zones = Object.keys(hass.states)
      .filter((z) => domainOf(z) === "zone" && z !== "zone.home")
      .map((z) => hass.states[z].attributes?.friendly_name)
      .filter(Boolean);
    return list(["home", "not_home", ...zones]);
  }
  if (d === "climate") return list(a.hvac_modes);
  if (d === "water_heater") return list(a.operation_list);
  if (DOMAIN_STATES[d]) return list(DOMAIN_STATES[d]);
  if (NUMBER_DOMAINS.includes(d)) return range({ min: a.minimum ?? a.min, max: a.maximum ?? a.max, step: a.step ?? (d === "counter" ? 1 : undefined) }, a.unit_of_measurement);
  if (d === "sensor" && (num(st.state) !== null || a.state_class || a.unit_of_measurement)) return range({}, a.unit_of_measurement);
  return null;
};

// A day `d` days after a date "YYYY-MM-DD".
export const addDays = (date, d) => {
  const ms = Date.parse(`${date}T12:00:00Z`);
  return Number.isFinite(ms) ? new Date(ms + d * 86400000).toISOString().slice(0, 10) : date;
};

// The actions the editor offers for an entity: turning on and off, opening and closing, a temperature or a
// position to enter, a preset or an option to pick.
export const domainActions = (hass, entityId) => {
  const st = hass?.states?.[entityId];
  const a = st?.attributes || {};
  const d = domainOf(entityId);
  const on = (svc = `${d}.turn_on`) => ({ service: svc, data: {} });
  const off = (svc = `${d}.turn_off`) => ({ service: svc, data: {} });
  const list = [];
  if (["light", "switch", "input_boolean", "fan", "humidifier", "media_player", "automation", "water_heater"].includes(d)) list.push(on(), off());
  if (d === "cover") list.push(on("cover.open_cover"), off("cover.close_cover"), { service: "cover.set_cover_position", data: {}, input: { field: "position", min: 0, max: 100, step: 1, unit: "%" } });
  if (d === "valve") list.push(on("valve.open_valve"), off("valve.close_valve"));
  if (d === "climate" || d === "water_heater") {
    const unit = a.temperature_unit || hass?.config?.unit_system?.temperature || "°C";
    list.push({ service: `${d}.set_temperature`, data: {}, input: { field: "temperature", min: num(a.min_temp) ?? 5, max: num(a.max_temp) ?? 35, step: num(a.target_temp_step) ?? 0.5, unit } });
  }
  if (d === "climate") {
    for (const p of Array.isArray(a.preset_modes) ? a.preset_modes : []) list.push({ service: "climate.set_preset_mode", data: { preset_mode: p } });
    for (const h of Array.isArray(a.hvac_modes) ? a.hvac_modes : []) list.push({ service: "climate.set_hvac_mode", data: { hvac_mode: h } });
  }
  if (d === "water_heater") for (const o of Array.isArray(a.operation_list) ? a.operation_list : []) list.push({ service: "water_heater.set_operation_mode", data: { operation_mode: o } });
  if (d === "input_number" || d === "number")
    list.push({ service: `${d}.set_value`, data: {}, input: { field: "value", min: num(a.min) ?? 0, max: num(a.max) ?? 100, step: num(a.step) ?? 1, unit: a.unit_of_measurement || "" } });
  if (d === "select" || d === "input_select") for (const o of Array.isArray(a.options) ? a.options : []) list.push({ service: `${d}.select_option`, data: { option: o } });
  if (d === "lock") list.push(on("lock.lock"), off("lock.unlock"));
  if (d === "vacuum") list.push(on("vacuum.start"), off("vacuum.return_to_base"));
  if (d === "script") list.push(on("script.turn_on"));
  if (d === "scene") list.push(on("scene.turn_on"));
  return list;
};

// Domains a new schedule can act on.
export const ACTION_DOMAINS = ["light", "switch", "input_boolean", "fan", "humidifier", "media_player", "automation", "water_heater", "cover", "valve", "climate", "input_number", "number", "select", "input_select", "lock", "vacuum", "script", "scene"];
