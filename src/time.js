// ---------------------------------------------------------------------------
// Time: minutes of the day in Home Assistant's time zone
// ---------------------------------------------------------------------------

export const DAY = 1440;
export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
export const _zoneFmt = new Map();
// The time zone of the dates: the server's, unless the user chose the browser's.
export const tzOf = (hass) => (hass?.locale?.time_zone === "local" ? undefined : hass?.config?.time_zone) || undefined;

// A moment (ms) in a time zone: its weekday (0 = Monday), its minute of the day and its date.
export const zoned = (ms, tz) => {
  const k = tz || "";
  if (!_zoneFmt.has(k)) {
    let f;
    try {
      f = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    } catch (_e) {
      f = new Intl.DateTimeFormat("en-US", { weekday: "short", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    }
    _zoneFmt.set(k, f);
  }
  const p = Object.fromEntries(_zoneFmt.get(k).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  const wd = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(p.weekday);
  return { wd: Math.max(0, wd), min: (Number(p.hour) % 24) * 60 + Number(p.minute), date: `${p.year}-${p.month}-${p.day}` };
};

// Sunrise and sunset of the day (minutes), from sun.sun; 07:00 and 19:00 without it.
export const sunTimes = (hass) => {
  const a = hass?.states?.["sun.sun"]?.attributes || {};
  const tz = tzOf(hass);
  const at = (iso) => {
    const ms = Date.parse(iso);
    return Number.isFinite(ms) ? zoned(ms, tz).min : null;
  };
  const rise = at(a.next_rising);
  const set = at(a.next_setting);
  return rise !== null && set !== null && rise < set ? { rise, set } : { rise: 420, set: 1140 };
};

// "07:30:00", "7:30", "sunrise+00:30:00", "sunset-01:00:00": minutes of the day, `sun` when relative to the sun.
export const parseTime = (s, sun = { rise: 420, set: 1140 }) => {
  const str = String(s ?? "").trim();
  const rel = /^(sunrise|sunset)([+-])(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(str);
  if (rel) {
    const off = Number(rel[3]) * 60 + Number(rel[4]);
    const base = rel[1] === "sunrise" ? sun.rise : sun.set;
    return { min: (((base + (rel[2] === "-" ? -off : off)) % DAY) + DAY) % DAY, sun: true };
  }
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(str);
  if (!m || Number(m[1]) > 24 || Number(m[2]) > 59) return null;
  return { min: Math.min(DAY, Number(m[1]) * 60 + Number(m[2])), sun: false };
};

export const hm = (min) => {
  const v = ((Math.round(min) % DAY) + DAY) % DAY;
  return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
};
