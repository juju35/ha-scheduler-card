// ---------------------------------------------------------------------------
// The full card
// ---------------------------------------------------------------------------
import { ICONS } from "./core.js";
import { cap, domainOf, esc, fmtLang, lang, num, plural, svgIcon, t, textWidth } from "./helpers.js";
import { DAY, WEEKDAYS, hm, parseTime, sunTimes, tzOf, zoned } from "./time.js";
import { WORKDAY_ENTITY, discover, runsOn } from "./schedules.js";
import { ACCENT, DOMAIN_ICONS, MATCH_TYPES, OFF_COLOR, OTHER_VALUE, actionInfo, actionKey, cardTags, cleanSlot, condState, conditionPickable, conditionValues, conditionsPayload, customActions, daySegments, domainActions, fmtNum, joinTime, matchVars, occurrences, optionsOf, pickSchedules, pickable, remapActions, scheduleEntities, scheduleModel, slotRange, slotsClash, splitTime, toggleTargets, upcoming, varDefaults, varsData, weekTotals, weekdaysPayload, withConditions } from "./actions.js";
import { inDialog, morph, watchOutside } from "./shadow-dom-patching.js";
import { sceneHtml } from "./illustration.js";
import { STYLE } from "./styles.js";

// The last full schedules read on each Home Assistant connection, shared by the cards: a card created again (another
// view, a dashboard opened) draws their conditions and dates from its first render instead of growing when its own
// answer comes, which moved the page under it. Its own answer still replaces them.
export const ITEMS_CACHE = new WeakMap();
export const itemsKey = (hass) => (hass?.connection && typeof hass.connection === "object" ? hass.connection : null);

export class SchedulerCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._html = "";
    this._view = null;
    this._edit = null;
    this._run = 0;
    this._items = null;
    this.shadowRoot.addEventListener("click", (ev) => this._click(ev));
    this.shadowRoot.addEventListener("pointerdown", (ev) => this._dragStart(ev));
    this.shadowRoot.addEventListener("change", (ev) => this._change(ev));
    this.shadowRoot.addEventListener("input", (ev) => this._input(ev));
    this.shadowRoot.addEventListener("keydown", (ev) => {
      if ((ev.key === "Enter" || ev.key === " ") && ev.target.getAttribute?.("role") === "button") {
        ev.preventDefault();
        ev.target.click();
      }
    });
    this._onKey = (ev) => {
      if (ev.key !== "Escape") return;
      if (this._edit) {
        ev.stopPropagation();
        this._closeEdit();
      } else if (this._view) {
        ev.stopPropagation();
        this._showTimeline();
      }
    };
    // A click elsewhere on the page closes the popup, else folds the weekly grid back to today's timeline.
    this._onOutside = (ev) => {
      if (inDialog(ev)) return;
      if (this._edit) {
        this._closedBy = ev;
        this._closeEdit();
      } else if (this._view) {
        this._closedBy = ev;
        this._showTimeline();
      }
    };
  }

  static getConfigElement() {
    return document.createElement("scheduler-card-editor");
  }

  static getStubConfig() {
    return {};
  }

  getCardSize() {
    return 3 + Math.ceil(1.5 * Math.max(1, this._list?.length ?? 3));
  }

  // 8 columns: 208 px on a phone.
  getGridOptions() {
    return { columns: 12, min_columns: 8 };
  }

  setConfig(config) {
    if (!config) throw new Error("Invalid configuration");
    this._config = { ...config };
    this._html = "";
    this._update();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
    this._watchItems();
    const sig = this._signature();
    if (this._sig && sig.length === this._sig.length && sig.every((v, i) => v === this._sig[i])) return;
    // Without the component's update subscription, the full schedules are read again when a schedule entity changes
    // (not on the minute tick nor on a target's or the sun's change, which leave the schedules as they are).
    const sched = discover(hass).map((id) => hass.states[id]);
    const schedChanged = !this._sched || sched.length !== this._sched.length || sched.some((v, i) => v !== this._sched[i]);
    if (this._sig && !this._unsubItems && schedChanged && this._sched) {
      globalThis.clearTimeout?.(this._itemsTimer);
      this._itemsTimer = globalThis.setTimeout?.(() => this._loadItems(), 500);
    }
    this._sched = sched;
    this._update(sig);
  }

  // The full schedules (conditions, dates, repetition) from the `scheduler` websocket command, read again each
  // time the component reports a change through its `scheduler_updated` subscription.
  _watchItems() {
    if (!this._hass || !this.isConnected || this._itemsWatch) return;
    this._itemsWatch = true;
    const key = itemsKey(this._hass);
    if (!this._items && key) this._items = ITEMS_CACHE.get(key) || null;
    this._loadItems();
    const conn = this._hass.connection;
    if (typeof conn?.subscribeMessage !== "function") return;
    Promise.resolve(conn.subscribeMessage(() => this._loadItems(), { type: "scheduler_updated" }))
      .then((un) => {
        if (this._itemsWatch) this._unsubItems = un;
        else if (typeof un === "function") un();
      })
      .catch(() => {});
  }

  _unwatchItems() {
    this._itemsWatch = false;
    globalThis.clearTimeout?.(this._itemsTimer);
    if (typeof this._unsubItems === "function") this._unsubItems();
    this._unsubItems = null;
  }

  async _loadItems() {
    if (typeof this._hass?.callWS !== "function") return;
    try {
      const list = await this._hass.callWS({ type: "scheduler" });
      this._items = new Map((Array.isArray(list) ? list : []).filter((x) => x?.entity_id).map((x) => [x.entity_id, x]));
      const key = itemsKey(this._hass);
      if (key) ITEMS_CACHE.set(key, this._items);
      this._update();
    } catch (_e) {
      /* the entities' attributes alone */
    }
  }

  get hass() {
    return this._hass;
  }

  connectedCallback() {
    (this._outsideWatch ??= watchOutside(this, (ev) => this._onOutside(ev))).on();
    this._watchItems();
    window.addEventListener("keydown", this._onKey);
    // The sun, the "now" markers and the state lines follow the clock: checked every 30 s.
    clearInterval(this._timer);
    this._timer = setInterval(() => this._hass && this._config && (this.hass = this._hass), 30000);
    this._update();
    // A new width (or the web font loaded): the status pill is fitted again, in the next frame.
    if (typeof ResizeObserver === "function") {
      this._resize ??= new ResizeObserver((entries) => {
        const w = Math.round(entries.at(-1).contentRect.width);
        if (w === this._fitWidth) return;
        this._fitWidth = w;
        cancelAnimationFrame(this._fitFrame);
        this._fitFrame = requestAnimationFrame(() => this._fitPill());
      });
      this._resize.observe(this);
    }
    document.fonts?.ready?.then(() => this._fitPill());
  }

  disconnectedCallback() {
    this._outsideWatch?.off();
    this._unwatchItems();
    this._drag = null;
    window.removeEventListener("keydown", this._onKey);
    clearInterval(this._timer);
    this._resize?.disconnect();
    this._fitWidth = null;
    // Left (another view, a conditional card hidden): the popup closes without anything else, the weekly grid
    // folds back to today's timeline.
    this._edit = null;
    this._view = null;
  }

  _t(key, vars) {
    return t(this._hass, this._config, key, vars);
  }

  _loc() {
    return fmtLang(this._hass, this._config);
  }

  _nowMs() {
    return Date.now();
  }

  _now() {
    return zoned(this._nowMs(), tzOf(this._hass));
  }

  // What the render depends on: language, dark mode, the sun, the workday sensor, the schedules and their
  // entities, and the minute.
  _signature() {
    const h = this._hass;
    const ids = discover(h);
    const targets = ids.flatMap((id) => h.states[id]?.attributes?.entities || []);
    return [
      h.language,
      h.locale,
      h.themes?.darkMode,
      h.states["sun.sun"],
      h.states[WORKDAY_ENTITY],
      ...ids.map((id) => h.states[id]),
      ...targets.map((id) => h.states[id]),
      // show_condition_status: the entities of the schedules' conditions too, so that the dots follow them.
      ...(this._config?.show_condition_status ? this._condEntities().map((id) => h.states[id]) : []),
      Math.floor(this._nowMs() / 60000),
    ];
  }

  // The entities the conditions of the schedules read (from their full schedules), sorted.
  _condEntities() {
    const ids = new Set();
    for (const item of this._items?.values?.() || [])
      for (const ts of Array.isArray(item?.timeslots) ? item.timeslots : []) for (const c of Array.isArray(ts?.conditions) ? ts.conditions : []) if (c?.entity_id) ids.add(c.entity_id);
    return [...ids].sort();
  }

  _update(sig) {
    if (!this._hass || !this._config) return;
    this._sig = sig ?? this._signature();
    const html = this._render();
    if (html !== this._html) {
      this._html = html;
      morph(this.shadowRoot, html);
    }
    this._fitPill();
    // A switch keeps the state of the entity, even after a click the service did not follow.
    // Only an upgraded switch: a property set before would shadow its own setter.
    const Switch = customElements.get("ha-switch");
    for (const sw of this.shadowRoot.querySelectorAll?.("ha-switch") || []) if (Switch && sw instanceof Switch) sw.checked = sw.hasAttribute("checked");
    // The tab of the schedule shown stays in sight (a long list of tabs scrolls sideways).
    if (this._view && this._scrolled !== this._view) {
      this._scrolled = this._view;
      const tabs = this.shadowRoot.querySelector?.(".tabs");
      const tab = tabs?.querySelector('[aria-selected="true"]');
      if (tab && tabs.scrollWidth > tabs.clientWidth) tabs.scrollLeft = Math.max(0, tab.offsetLeft - (tabs.clientWidth - tab.offsetWidth) / 2);
    }
    if (!this._view) this._scrolled = null;
  }

  _models() {
    const tr = (k, v) => this._t(k, v);
    const loc = this._loc();
    const all = discover(this._hass).map((id) => scheduleModel(this._hass, this._config, id, tr, loc, this._items?.get(id) || null));
    this._all = all;
    const now = this._now();
    // `sort_by: next`: minutes to the next action; `state`: running now, then enabled.
    const rank = (m, by) => {
      if (by === "state") return this._runningNow(m, now) ? 0 : 1;
      const next = m.enabled ? occurrences(m, now, this._hass)[0] : null;
      return next ? next.at - now.min : Number.MAX_SAFE_INTEGER;
    };
    this._list = pickSchedules(all, this._config, rank);
    return this._list;
  }

  // Night illustration: forced by illustration_theme, else Home Assistant's dark mode alone (a light theme keeps the
  // day picture after sunset). Evening: the last two hours before sunset (sun.sun's times), in automatic mode with a
  // light theme.
  _sky(now) {
    const sun = sunTimes(this._hass);
    const mode = this._config.illustration_theme;
    const night = mode === "night" || (mode !== "day" && !!this._hass?.themes?.darkMode);
    const evening = !night && mode !== "day" && now.min >= sun.set - 120 && now.min < sun.set + 60;
    return { night, evening };
  }

  // A minute of the day in Home Assistant's 12/24 h setting.
  _time(min) {
    const opts = { hour: "2-digit", minute: "2-digit", timeZone: "UTC" };
    const tf = this._hass?.locale?.time_format;
    if (tf === "12") opts.hour12 = true;
    else if (tf === "24") opts.hourCycle = "h23";
    try {
      return new Intl.DateTimeFormat(this._loc(), opts).format(new Date(Date.UTC(2024, 0, 1, 0, Math.round(min) % DAY)));
    } catch (_e) {
      return hm(min);
    }
  }

  // A weekday (0 = Monday): « Mon », or « Monday ».
  _weekday(wd, style = "short") {
    try {
      return new Intl.DateTimeFormat(this._loc(), { weekday: style, timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, 1 + wd)));
    } catch (_e) {
      return WEEKDAYS[wd];
    }
  }

  // An occurrence: its time today, its weekday and time on another day.
  _when(occ, now, dropTomorrow = false) {
    const time = this._time(occ.slot.start);
    if (occ.day === 0 || (dropTomorrow && occ.day === 1)) return time;
    return `${this._weekday((now.wd + occ.day) % 7)} ${time}`;
  }

  // A built-in word (« On ») is lowered inside a sentence (« Off · on at 18:00 »), except in German.
  _inSentence(info) {
    if (!info.verb || lang(this._hass, this._config) === "de") return info.label;
    return info.label.charAt(0).toLocaleLowerCase(this._loc()) + info.label.slice(1);
  }

  _actionAt(info, occ, now) {
    if (occ.day === 0) return this._t("action_at", { action: this._inSentence(info), time: this._time(occ.slot.start) });
    return this._t("action_on_day", { action: this._inSentence(info), day: this._weekday((now.wd + occ.day) % 7), time: this._time(occ.slot.start) });
  }

  // The state of the entity a schedule acts on, as Home Assistant words it.
  _entityState(m) {
    const st = this._hass.states[m.target];
    if (!st) return "";
    try {
      const f = this._hass.formatEntityState?.(st);
      if (f) return f;
    } catch (_e) {
      /* raw state below */
    }
    return cap(st.state);
  }

  // The state line of a schedule: « 20 °C now · 17 °C at 22:30 », « Off · on at 18:00 », « Done today · next 02:00 »,
  // « Disabled ».
  _stateLine(m, now) {
    if (m.state === "off") return this._t("state_disabled");
    if (m.state === "completed") return this._t("state_completed");
    if (m.from && now.date && now.date < m.from) return this._t("starts_on", { date: this._date(m.from, true) });
    const occ = occurrences(m, now, this._hass);
    const next = occ[0];
    const cur = m.current !== null ? m.slots.find((s) => s.i === m.current) : null;
    if (cur) {
      const info = m.infos.get(cur.i);
      const parts = [this._t("value_now", { value: info.label })];
      if (next && cur.stop !== null && next.day === 0 && next.slot.start === cur.stop % DAY) parts.push(this._actionAt(m.infos.get(next.slot.i), next, now));
      else if (cur.stop !== null) parts.push(this._t("until", { time: this._time(cur.stop) }));
      else if (next) parts.push(this._actionAt(m.infos.get(next.slot.i), next, now));
      return parts.join(" · ");
    }
    if (!next) return this._t("no_upcoming");
    const ranToday = runsOn(m.weekdays, now.wd, this._hass, true) && m.slots.some((s) => s.start <= now.min);
    if (next.day > 0 && ranToday) return `${this._t("done_today")} · ${this._t("next_lower", { time: this._when(next, now, true) })}`;
    const state = this._entityState(m);
    const action = this._actionAt(m.infos.get(next.slot.i), next, now);
    return state ? `${state} · ${action}` : action;
  }

  // A date "YYYY-MM-DD": « 20 Dec », or « Sat 20 Dec ».
  _date(iso, weekday = false) {
    const ms = Date.parse(`${iso}T12:00:00Z`);
    if (!Number.isFinite(ms)) return String(iso);
    try {
      return new Intl.DateTimeFormat(this._loc(), { day: "numeric", month: "short", ...(weekday ? { weekday: "short" } : {}), timeZone: "UTC" }).format(new Date(ms));
    } catch (_e) {
      return String(iso);
    }
  }

  // A time relative to the sun in words: « Sunset −00:30 », « Sunrise ».
  _sunLabel(raw) {
    const p = splitTime(raw);
    if (p.mode === "time") return "";
    const name = this._t(p.mode);
    return p.off === "00:00" ? name : `${name} ${p.sign === "+" ? "+" : "−"}${p.off}`;
  }

  // An entity's name, for a condition.
  _entityName(id) {
    return this._hass.states[id]?.attributes?.friendly_name || id;
  }

  // A condition in words: « Anyone home is home », « Outdoor temperature below 15 ».
  _condLabel(c) {
    const st = this._hass.states[c.entity];
    let value = c.value;
    try {
      const f = st && c.match !== "below" && c.match !== "above" && this._hass.formatEntityState?.({ ...st, state: String(c.value) });
      if (f) value = f;
    } catch (_e) {
      /* raw value */
    }
    return this._t(`cond_${c.match}`, { entity: this._entityName(c.entity), value });
  }

  // The badges of a tile: the sun, workdays / weekend, the conditions, the dates, what happens after the last slot.
  _badges(m) {
    if (this._config.show_badges === false) return "";
    const out = [];
    const sunSlot = m.slots.find((x) => x.sun);
    if (sunSlot) {
      const raw = /sun/.test(sunSlot.startRaw) ? sunSlot.startRaw : sunSlot.stopRaw;
      out.push(["sun", this._sunLabel(raw)]);
    }
    if (m.weekdays.length === 1 && (m.weekdays[0] === "workday" || m.weekdays[0] === "weekend")) out.push(["days", this._t(`days_${m.weekdays[0]}`)]);
    const o = m.opts;
    if (o?.conds.length) out.push(["cond", `${this._condLabel(o.conds[0])}${o.conds.length > 1 ? ` +${o.conds.length - 1}` : ""}`]);
    if (m.from && m.to) out.push(["period", this._t("period_range", { from: this._date(m.from), to: this._date(m.to) })]);
    else if (m.to) out.push(["period", this._t("period_until", { date: this._date(m.to) })]);
    else if (m.from) out.push(["period", this._t("period_from", { date: this._date(m.from) })]);
    if (o && o.repeat !== "repeat") out.push(["repeat", this._t(o.repeat === "pause" ? "repeat_pause_badge" : "repeat_single_badge")]);
    if (!out.length) return "";
    return `<div class="bdgs">${out.map(([k, txt]) => `<span class="bdg b-${k}">${esc(txt)}</span>`).join("")}</div>`;
  }

  // ── Header ──

  _banner(inner, now, rows) {
    const sky = this._sky(now);
    return `<div class="banner${sky.night ? " night" : sky.evening ? " evening" : ""}">
      ${sceneHtml(rows, now.min)}
      <div class="strip g-timeline"></div>
      ${inner}
    </div>`;
  }

  // Today's spans of an enabled schedule that hold the current minute (its background value left out): what the
  // illustration pulses, and what makes the header icon "active".
  _runningNow(m, now) {
    if (!m.enabled || !runsOn(m.weekdays, now.wd, this._hass, true)) return false;
    return daySegments(m).spans.some((sp) => m.infos.get(sp.slot.i)?.key !== m.def && now.min >= sp.a && now.min < sp.b);
  }

  // The header icon's status: a schedule running now (accent), idle (grey), nothing to show (amber).
  _status(models, now) {
    if (!models.length) return "warn";
    return models.some((m) => this._runningNow(m, now)) ? "active" : "idle";
  }

  // The status pill stays right after the title only while the whole title and the pill's whole label fit on that
  // row; otherwise it takes a line of its own under the statistics or the next action (.below), and when even then
  // the line is too narrow for it or (on the banner) the text would run into the timeline strip, it keeps its dot
  // alone (.pill-dot). Measured in the real fonts, so that every language and title length gets its own answer.
  _fitPill() {
    // Home Assistant's <ha-card> (a Lit element) shows its content only from its first update, a microtask after it
    // is connected: measured before, everything is 0 px wide and the pill lands on the wrong line. Fitted then.
    const haCard = this.shadowRoot?.querySelector?.("ha-card");
    if (haCard && haCard.hasUpdated === false) {
      this._pillWait ??= (haCard.updateComplete?.then ? haCard.updateComplete : new Promise((r) => requestAnimationFrame(r))).then(() => {
        this._pillWait = null;
        this._fitPill();
      });
      return;
    }
    for (const t of this.shadowRoot?.querySelectorAll?.(".titles, .mhd") || []) {
      const pill = t.querySelector(".chip.status");
      if (!pill?.getBoundingClientRect) continue;
      t.classList.remove("below", "pill-dot");
      const row = pill.parentElement;
      const name = row.querySelector(":scope > .name, :scope > .title");
      const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
      const shown = name && getComputedStyle(name).display !== "none";
      const natural = pill.getBoundingClientRect().width;
      // The banner's row holds the title and the pill alone; the classic mini card's line shares the title's room.
      const have = row.classList.contains("trow") ? row.getBoundingClientRect().width : (shown ? name.getBoundingClientRect().width + gap : 0) + natural;
      if ((shown ? textWidth(name) + gap : 0) + natural <= have) continue;
      t.classList.add("below");
      const r = t.getBoundingClientRect();
      const banner = t.closest(".banner");
      const box = banner?.getBoundingClientRect();
      const floor = banner?.querySelector(".strip")?.getBoundingClientRect().top ?? box?.bottom;
      if ((box && (r.bottom > floor + 0.5 || r.top < box.top - 0.5)) || natural > r.width + 0.5) t.classList.add("pill-dot");
    }
  }

  // The status pill, in the header icon's colour: a schedule running now, idle, nothing to show.
  _pill(status) {
    const label = esc(this._t(`status_${status}`));
    return `<span class="chip status st-${status}" title="${label}" aria-label="${label}"><span class="dot"></span><span class="txt">${label}</span></span>`;
  }

  // The header icon, then the title with its status pill right after it, the statistics under them.
  _titleBlock(title, stats, status = "idle") {
    return `<div class="badge st-${status}">${svgIcon(ICONS.calendarClock)}</div>
      <div class="titles">
        <div class="trow"><div class="name">${esc(title)}</div>${this._pill(status)}</div>
        ${stats.length ? `<div class="stats">${stats.map((s) => `<span>${esc(s)}</span>`).join("")}</div>` : ""}
      </div>`;
  }

  _header(title, stats, now, rows = [], status = "idle") {
    if (this._config.illustration === false) return `<div class="header">${this._titleBlock(title, stats, status)}${this._zoomButton("plain")}</div>`;
    return this._banner(`<div class="head">${this._titleBlock(title, stats, status)}</div>${this._zoomButton(this._sky(now).night ? "on-night" : "")}`, now, rows);
  }

  // The illustration's rows: up to three schedules, the one shown first, then those running now, then the other
  // enabled ones, then the disabled ones (greyed).
  _sceneRows(models, now, first = null) {
    const rank = (m) => (m === first ? 0 : this._runningNow(m, now) ? 1 : m.enabled ? 2 : 3);
    return [...models]
      .sort((a, b) => rank(a) - rank(b))
      .slice(0, 3)
      .map((m) => {
        const bits = [];
        const color = (slot) => m.colors.get(m.infos.get(slot.i)?.key) || m.base;
        if (runsOn(m.weekdays, now.wd, this._hass, true)) {
          const { spans, points } = daySegments(m);
          for (const sp of spans) if (m.infos.get(sp.slot.i)?.key !== m.def) bits.push({ a: sp.a, b: sp.b, c: color(sp.slot), now: m.enabled && now.min >= sp.a && now.min < sp.b });
          for (const p of points) bits.push({ at: p.at, c: color(p.slot) });
        }
        return { icon: m.icon, color: m.base, on: m.enabled, bits };
      });
  }

  // Today's spans of a schedule, for its timeline bar (`grey` for a disabled schedule).
  _todayBits(m, now) {
    if (!runsOn(m.weekdays, now.wd, this._hass, true)) return "";
    const { spans, points } = daySegments(m);
    const color = (s) => (m.enabled ? m.colors.get(m.infos.get(s.i)?.key) || m.base : OFF_COLOR);
    const pct = (v) => ((v / DAY) * 100).toFixed(2);
    // The background value of a schedule covering the whole day is not drawn: only what stands out of it.
    return [
      ...spans.filter((sp) => m.infos.get(sp.slot.i)?.key !== m.def).map((sp) => `<span class="s" style="left:${pct(sp.a)}%;width:${pct(sp.b - sp.a)}%;--b:${color(sp.slot)}"></span>`),
      ...points.map((p) => `<span class="p" style="left:${pct(p.at)}%;--b:${color(p.slot)}"></span>`),
    ].join("");
  }

  // ── Today's timeline ──

  _timelineStats(models, now) {
    const next = upcoming(models, now, this._hass, 1)[0];
    const parts = [cap(this._weekday(now.wd, "long")), this._time(now.min)];
    if (next) parts.push(this._t("next_time", { time: this._when(next, now) }));
    return parts;
  }

  // show_condition_status (#17): the icon's dot says whether the conditions of the slot running now (or the next one)
  // hold — met (green, pulsing unless condition_status_animation: false), waiting (amber hourglass: tracked
  // conditions, the slot starts once they hold) or skipped (red: the slot will not run). Its tooltip names the
  // conditions not met.
  _condDot(m, now) {
    const cs = this._config.show_condition_status ? condState(this._hass, m, now) : null;
    if (!cs) return { html: '<span class="on"></span>', text: "" };
    const lines = [this._t(`cstat_${cs.state}`)];
    for (const c of cs.failed) {
      const st = this._hass.states[c.entity_id];
      const label = this._condLabel({ entity: c.entity_id, match: MATCH_TYPES.includes(c.match_type) ? c.match_type : "is", value: c.value });
      lines.push(`✗ ${label}${!st || st.state === "unavailable" || st.state === "unknown" ? ` (${this._t("cstat_unavailable")})` : ""}`);
    }
    const text = lines.join("\n");
    const glyph = { met: "M4 7.3l2 2 4-4.3", wait: "M4.6 3.6h4.8M4.6 10.4h4.8M5.2 3.6c0 2 3.6 2.2 3.6 3.4s-3.6 1.4-3.6 3.4M8.8 3.6c0 2-3.6 2.2-3.6 3.4s3.6 1.4 3.6 3.4", skip: "M4.3 7h5.4" }[cs.state];
    const pulse = cs.state === "met" && this._config.condition_status_animation !== false ? " pulse" : "";
    return {
      html: `<span class="on cs cs-${cs.state}${pulse}" title="${esc(text)}"><svg viewBox="0 0 14 14" aria-hidden="true"><path d="${glyph}"/></svg></span>`,
      text: lines[0],
    };
  }

  _row(m, now) {
    const active = m.enabled && m.current !== null;
    const dot = this._condDot(m, now);
    // show_entities (#23): the names of the entities the schedule acts on, under its state line.
    const ents = this._config.show_entities ? m.entities.map((id) => this._entityName(id)).join(", ") : "";
    const label = [`${m.name}: ${this._stateLine(m, now)}`, ents, dot.text].filter(Boolean).join(" · ");
    return `<div class="row${active ? " active" : ""}${m.enabled ? " enabled" : ""}" role="button" tabindex="0" data-key="${esc(m.id)}" data-open="${esc(m.id)}"
        style="--c:${m.base}" aria-label="${esc(label)}">
      <div class="line">
        <span class="ic"><ha-icon icon="${esc(m.icon)}"></ha-icon>${dot.html}</span>
        <span class="txt"><span class="nm">${esc(m.name)}</span><span class="stl">${esc(this._stateLine(m, now))}</span>${ents ? `<span class="ens">${esc(ents)}</span>` : ""}</span>
        <ha-switch data-toggle="${esc(m.id)}"${m.enabled ? " checked" : ""}${this._config.editable === false ? " disabled" : ""} aria-label="${esc(m.name)}"></ha-switch>
      </div>
      <div class="bar">${this._todayBits(m, now)}<span class="now" style="left:${((now.min / DAY) * 100).toFixed(2)}%"></span></div>
      ${this._badges(m)}
    </div>`;
  }

  _timeline(models, now) {
    const on = models.filter((m) => m.enabled).length;
    const off = models.length - on;
    const chips = `<div class="chips">
        <span class="chip ok"><span class="dot"></span><span class="txt">${esc(plural(this._hass, this._config, "enabled", on))}</span></span>
        ${off ? `<span class="chip na"><span class="dot"></span><span class="txt">${esc(plural(this._hass, this._config, "disabled", off))}</span></span>` : ""}
        ${this._config.illustration === false ? "" : `<span class="aside">${esc(this._t("now_hint"))}</span>`}
        ${this._allSwitch()}
      </div>`;
    const rows = models.length ? models.map((m) => this._row(m, now)).join("") : `<div class="empty">${esc(this._t("no_match"))}</div>`;
    const add =
      this._config.editable === false
        ? ""
        : `<div class="foot"><button class="btn" data-action="new">${svgIcon(ICONS.plus)}${esc(this._t("new_schedule"))}</button></div>`;
    const notice = this._notice ? `<div class="err">${esc(this._notice)}</div>` : "";
    return `<div class="view" data-key="timeline">${chips}${notice}<div class="rows">${rows}${add}</div></div>`;
  }

  // `show_header_toggle`: one switch for every schedule of the card's filters (toggleTargets), on while any of them is,
  // as Home Assistant's header toggles: from a mixed state it turns them all off. Its label says what a click does.
  // Greyed with `editable: false`.
  _allSwitch() {
    if (this._config.show_header_toggle !== true) return "";
    const targets = toggleTargets(this._all || [], this._config);
    if (!targets.length) return "";
    const any = targets.some((m) => m.enabled);
    const label = esc(this._t(any ? "all_off" : "all_on"));
    const off = this._config.editable === false || this._toggling;
    return `<span class="all"><span class="txt">${label}</span><ha-switch data-toggle-all="1"${any ? " checked" : ""}${off ? " disabled" : ""} aria-label="${label}"></ha-switch></span>`;
  }

  // ── Weekly grid ──

  _weekStats(m, now) {
    if (m.state === "off") return [this._t("state_disabled")];
    const cur = m.enabled && m.current !== null ? m.slots.find((s) => s.i === m.current) : null;
    const next = m.enabled ? occurrences(m, now, this._hass)[0] : null;
    if (cur) {
      const parts = [m.infos.get(cur.i).label];
      if (cur.stop !== null) parts.push(this._t("until", { time: this._time(cur.stop) }));
      return parts;
    }
    if (next) return [this._actionAt(m.infos.get(next.slot.i), next, now).replace(/^./, (c) => c.toLocaleUpperCase(this._loc()))];
    return [this._t(m.state === "completed" ? "state_completed" : "no_upcoming")];
  }

  _tabsHtml(models, m) {
    return `<div class="tabs" role="tablist">
      <button class="tab back" data-action="back" title="${esc(this._t("back"))}" aria-label="${esc(this._t("back"))}">${svgIcon(ICONS.back)}</button>
      ${models.map((x) => `<button class="tab" role="tab" data-key="tab-${esc(x.id)}" data-tab="${esc(x.id)}" aria-selected="${x.id === m.id}">${esc(x.name)}</button>`).join("")}
    </div>`;
  }

  _hoursLabel(h) {
    try {
      return new Intl.NumberFormat(this._loc(), { style: "unit", unit: "hour", unitDisplay: "narrow" }).format(h);
    } catch (_e) {
      return `${h}h`;
    }
  }

  _week(m, now) {
    const def = m.def;
    const editable = this._config.editable !== false;
    const totals = weekTotals(m, this._hass, def);
    const hours = (min) => fmtNum(Math.round((min / 60) * 10) / 10, this._loc());
    let total = "";
    if (totals.size === 1) {
      const [key, min] = [...totals.entries()][0];
      total = this._t("week_total", { value: [...m.infos.values()].find((i) => i.key === key).label, h: hours(min) });
    } else if (totals.size > 1) total = this._t("week_total_all", { h: hours([...totals.values()].reduce((a, b) => a + b, 0)) });
    const cur = m.enabled && m.current !== null ? m.slots.find((s) => s.i === m.current) : null;
    const chips = `<div class="chips">
        <span class="chip ${m.enabled ? "ok" : "na"}"><span class="dot"></span><span class="txt">${esc(this._t(m.state === "off" ? "state_disabled" : m.state === "completed" ? "state_completed" : "state_enabled"))}</span></span>
        ${cur ? `<span class="chip" style="--c:${m.colors.get(m.infos.get(cur.i).key) || m.base}"><span class="dot"></span><span class="txt">${esc(this._t("value_now", { value: m.infos.get(cur.i).label }))}</span></span>` : ""}
        ${total ? `<span class="aside">${esc(total)}</span>` : ""}
      </div>`;
    const labels = [0, 1, 2, 3, 4, 5, 6].map((wd) => this._weekday(wd));
    // The day labels' column: wide enough for the longest short weekday of the language (« Mon », « segunda »).
    const dl = Math.ceil(Math.max(3, ...labels.map((l) => l.length)) * 7.4 + 6);
    const pct = (v) => ((v / DAY) * 100).toFixed(2);
    const { spans, points } = daySegments(m);
    const color = (s) => m.colors.get(m.infos.get(s.i)?.key) || m.base;
    const blockLabel = (s) => {
      const info = m.infos.get(s.i);
      return `${info.label} · ${this._time(s.start)}${s.stop !== null ? `–${this._time(s.stop)}` : ""}`;
    };
    // Drag handles on both edges of a slot with fixed start and end, not crossing midnight.
    const handles = (sp) =>
      editable && sp.slot.stop !== null && !sp.slot.sun && sp.a === sp.slot.start && sp.b === sp.slot.stop
        ? `<span class="hdl" data-drag="${sp.slot.i}:a" style="left:0" aria-hidden="true"></span><span class="hdl" data-drag="${sp.slot.i}:b" style="left:100%" aria-hidden="true"></span>`
        : "";
    const attrs = (s) => (editable ? ` role="button" tabindex="0" data-slot="${s.i}" aria-label="${esc(blockLabel(s))}"` : ` aria-label="${esc(blockLabel(s))}"`);
    const days = [0, 1, 2, 3, 4, 5, 6]
      .map((wd) => {
        const runs = runsOn(m.weekdays, wd, this._hass, wd === now.wd);
        const today = wd === now.wd;
        const blocks = runs
          ? [
              ...spans
                .filter((sp) => m.infos.get(sp.slot.i)?.key !== def)
                .map(
                  (sp) =>
                    `<span class="blk" style="left:${pct(sp.a)}%;width:${pct(sp.b - sp.a)}%;--b:${color(sp.slot)}" data-a="${sp.a}" data-b="${sp.b}" title="${esc(blockLabel(sp.slot))}"${attrs(sp.slot)}><span class="bl">${esc(m.infos.get(sp.slot.i).short)}</span>${handles(sp)}</span>`,
                ),
              ...points.map((p) => `<span class="blk pt" style="left:${pct(p.at)}%;--b:${color(p.slot)}" title="${esc(blockLabel(p.slot))}"${attrs(p.slot)}></span>`),
            ].join("")
          : "";
        return `<div class="day${today ? " today" : ""}${runs ? "" : " off"}" data-key="day-${wd}">
          <span class="dl">${esc(labels[wd])}</span>
          <div class="track${editable ? " edit" : ""}"${editable ? ` data-add="1"` : ""} style="--d:${def ? m.colors.get(def) : OFF_COLOR}">${blocks}${today ? `<span class="now" style="left:${pct(now.min)}%"></span>` : ""}</div>
        </div>`;
      })
      .join("");
    const seen = new Set();
    const legend = [...m.infos.values()]
      .filter((i) => !seen.has(i.key) && seen.add(i.key))
      .sort((a, b) => (a.key === def) - (b.key === def))
      .map(
        (i) =>
          `<span class="sw${i.key === def ? " def" : ""}" style="--b:${m.colors.get(i.key)}"><i></i>${esc(i.key === def ? this._t("default_value", { value: i.label }) : i.label)}</span>`,
      )
      .join("");
    const add = editable
      ? `<button class="btn small plain" data-action="opts">${esc(this._t("schedule_options"))}</button><button class="btn small" data-action="add-slot">${svgIcon(ICONS.plus)}${esc(this._t("add_slot"))}</button>`
      : "";
    return `<div class="view" data-key="week-${esc(m.id)}">${chips}
      <div class="week" style="--dl:${dl}px">
        <div class="axis">${[0, 6, 12, 18, 24].map((h) => `<span style="left:${(h / 24) * 100}%">${esc(this._hoursLabel(h))}</span>`).join("")}</div>
        ${days}
        <div class="legend">${legend}${add}</div>
        ${this._notice ? `<div class="err">${esc(this._notice)}</div>` : ""}
      </div>
    </div>`;
  }

  // ── Popups ──

  _modal(title, sub, icon, body, color = ACCENT) {
    return `<div class="backdrop" data-action="backdrop">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="sc-dlg-title" style="--c:${color}">
        <div class="mhead">
          <div class="badge">${icon.startsWith("mdi:") ? `<ha-icon icon="${esc(icon)}"></ha-icon>` : svgIcon(icon)}</div>
          <div><h3 id="sc-dlg-title">${esc(title)}</h3>${sub ? `<div class="sub">${esc(sub)}</div>` : ""}</div>
          <button class="close" data-action="close" title="${esc(this._t("close"))}" aria-label="${esc(this._t("close"))}">${svgIcon(ICONS.close)}</button>
        </div>
        ${body}
      </div>
    </div>`;
  }

  _dayToggles(days, preset = false) {
    return `<div class="dayset${preset ? " preset" : ""}">${[0, 1, 2, 3, 4, 5, 6]
      .map((wd) => `<button class="dt" data-dayt="${wd}" aria-pressed="${days.has(wd)}">${esc(this._weekday(wd))}</button>`)
      .join("")}</div>`;
  }

  // Segmented buttons setting `field` of the draft (`target`: "d" the draft, "o" the options).
  _seg(field, value, choices, target = "d", cls = "") {
    return `<div class="seg${cls ? ` ${cls}` : ""}" role="group">${choices
      .map(([v, label]) => `<button class="sg" data-set="${target}:${field}" data-val="${esc(v)}" aria-pressed="${v === value}">${esc(label)}</button>`)
      .join("")}</div>`;
  }

  // The `time_step` (minutes) of the time fields, as the inputs' step in seconds.
  _stepAttr() {
    const s = num(this._config.time_step);
    return s && s > 0 ? ` step="${Math.round(s * 60)}"` : "";
  }

  // A start or end: a fixed time, or an offset before / after sunrise or sunset (with today's time).
  _timeField(k, d, label, optional = false) {
    const mode = d[`${k}Mode`] || "time";
    const sun = sunTimes(this._hass);
    const seg = this._seg(`${k}Mode`, mode, [
      ["time", this._t("mode_time")],
      ["sunrise", this._t("sunrise")],
      ["sunset", this._t("sunset")],
    ]);
    let input;
    if (mode === "time")
      input = `<input id="sc-${k}" type="time" data-field="${k}" value="${esc(d[k] || "")}"${this._stepAttr()}${optional ? ` title="${esc(this._t("end_hint"))}"` : ""}>`;
    else {
      const raw = joinTime(mode, "", d[`${k}Sign`], d[`${k}Off`]);
      const today = parseTime(raw, sun);
      input = `<div class="pair">${this._seg(`${k}Sign`, d[`${k}Sign`] === "+" ? "+" : "-", [
        ["-", this._t("before")],
        ["+", this._t("after")],
      ], "d", "narrow")}<input id="sc-${k}" type="text" inputmode="numeric" pattern="\\d{1,2}:\\d{2}" placeholder="00:30" data-field="${k}Off" value="${esc(d[`${k}Off`] || "00:00")}" aria-label="${esc(this._t("offset"))}"></div>
        ${today ? `<span class="note">${esc(this._t("approx_today", { time: this._time(today.min) }))}</span>` : ""}`;
    }
    return `<label for="sc-${k}">${esc(label)}</label><div class="stack">${seg}${input}</div>`;
  }

  // Days: every day, workdays, weekend (the workday sensor's), or chosen ones.
  _daysField(d) {
    const mode = d.dayMode || "custom";
    const shown = mode === "custom" ? d.days : new Set([0, 1, 2, 3, 4, 5, 6].filter((wd) => runsOn([mode], wd, this._hass)));
    return `<label>${esc(this._t("days"))}</label><div class="stack">
      ${this._seg("dayMode", mode, [
        ["daily", this._t("days_daily")],
        ["workday", this._t("days_workday")],
        ["weekend", this._t("days_weekend")],
        ["custom", this._t("days_custom")],
      ])}
      ${this._dayToggles(shown, mode !== "custom")}
      ${mode === "workday" || mode === "weekend" ? `<span class="note">${esc(this._t("days_workday_note"))}</span>` : ""}
    </div>`;
  }

  // The options of a schedule: name, tags, conditions, dates, after the last slot.
  // A state of an entity in words (« Home », « Heat »), for a condition's value; the raw state otherwise.
  _stateName(id, value) {
    const st = this._hass.states[id];
    try {
      const f = st && this._hass.formatEntityState?.({ ...st, state: String(value) });
      if (f) return String(f);
    } catch (_e) {
      /* raw value */
    }
    return String(value);
  }

  // A condition's value: a list of the entity's known states, a number (below / above, or a numeric entity), or a
  // free text when its states cannot be told (or « Other value… » was chosen). The stored value is always kept.
  _condValueHtml(c, i) {
    const attrs = `data-cond="${i}" data-cfield="value" aria-label="${esc(this._t("act_value"))}"`;
    const info = c.entity ? conditionValues(this._hass, this._config, c.entity) : null;
    const numeric = c.match === "below" || c.match === "above";
    if (info?.kind === "list" && !numeric && !c.manual) {
      const vals = info.values.some((v) => v.value === c.value) || c.value === "" ? info.values : [...info.values, { value: c.value, name: "" }];
      return `<select ${attrs}>${c.value === "" ? `<option value="" selected>${esc(this._t("cond_pick"))}</option>` : ""}${vals
        .map((v) => `<option value="${esc(v.value)}"${v.value === c.value ? " selected" : ""}>${esc(v.name || this._stateName(c.entity, v.value))}</option>`)
        .join("")}<option value="${OTHER_VALUE}">${esc(this._t("cond_other"))}</option></select>`;
    }
    if (numeric || info?.kind === "number") {
      const r = info?.kind === "number" ? info : {};
      const n = (k) => (r[k] !== null && r[k] !== undefined ? ` ${k}="${r[k]}"` : "");
      const input = `<input type="number" inputmode="decimal" ${attrs} value="${esc(c.value)}"${n("min")}${n("max")} step="${r.step ?? "any"}" placeholder="${esc(this._t("act_value"))}">`;
      return r.unit ? `${input}<span class="u">${esc(r.unit)}</span>` : input;
    }
    return `<input type="text" ${attrs} value="${esc(c.value)}" placeholder="${esc(this._t("act_value"))}">`;
  }

  _optionsHtml(o) {
    const ents = [...new Set([...conditionPickable(this._hass, this._config), ...o.conds.map((c) => c.entity).filter((id) => this._hass.states[id])])].sort();
    const conds = o.conds
      .map(
        (c, i) => `<div class="cond" data-key="cond-${i}">
          <input type="text" list="sc-cents" data-cond="${i}" data-cfield="entity" value="${esc(c.entity)}" placeholder="${esc(this._t("entity"))}" aria-label="${esc(this._t("entity"))}" autocomplete="off">
          <button class="x" data-uncond="${i}" title="${esc(this._t("remove"))}" aria-label="${esc(this._t("remove"))}">${svgIcon(ICONS.close)}</button>
          <div class="pair"><select data-cond="${i}" data-cfield="match" aria-label="${esc(this._t("conditions"))}">${MATCH_TYPES.map((mt) => `<option value="${mt}"${mt === c.match ? " selected" : ""}>${esc(this._t(`match_${mt}`))}</option>`).join("")}</select>
          ${this._condValueHtml(c, i)}</div>
        </div>`,
      )
      .join("");
    return `<div class="form">
        <label for="sc-oname">${esc(this._t("name"))}</label><input id="sc-oname" type="text" data-ofield="name" value="${esc(o.name)}">
        <label for="sc-tag">${esc(this._t("tags"))}</label><div class="tagset">${o.tags
          .map((x) => `<span class="tg">${esc(x)}<button class="x" data-untag="${esc(x)}" title="${esc(this._t("remove"))}" aria-label="${esc(`${this._t("remove")} ${x}`)}">${svgIcon(ICONS.close)}</button></span>`)
          .join("")}<input id="sc-tag" type="text" data-tag="1" placeholder="${esc(this._t("add_tag"))}"></div>
        <div class="sect">${esc(this._t("conditions"))}</div>
        <div class="full stack">
          ${o.conds.length > 1 ? this._seg("condType", o.condType, [["and", this._t("cond_all")], ["or", this._t("cond_any")]], "o") : ""}
          <div class="conds">${conds}</div>
          <datalist id="sc-cents">${ents.map((id) => `<option value="${esc(id)}">${esc(this._entityName(id))}</option>`).join("")}</datalist>
          <div><button class="btn small" data-action="add-cond">${svgIcon(ICONS.plus)}${esc(this._t("add_condition"))}</button></div>
          ${o.conds.length ? `<label class="chk"><input type="checkbox" data-ofield="track"${o.track ? " checked" : ""}><span>${esc(this._t("track_conditions"))}</span></label>` : ""}
        </div>
        <div class="sect">${esc(this._t("period"))}</div>
        <label class="chk full"><input type="checkbox" data-ofield="period"${o.period ? " checked" : ""}><span>${esc(this._t("period_hint"))}</span></label>
        ${
          o.period
            ? `<label for="sc-from">${esc(this._t("date_from"))}</label><input id="sc-from" type="date" data-ofield="from" value="${esc(o.from)}">
               <label for="sc-to">${esc(this._t("date_to"))}</label><input id="sc-to" type="date" data-ofield="to" value="${esc(o.to)}">`
            : ""
        }
        <div class="sect">${esc(this._t("after_last"))}</div>
        <div class="full stack">${this._seg("repeat", o.repeat, [["repeat", this._t("repeat_repeat")], ["pause", this._t("repeat_stop")], ["single", this._t("repeat_delete")]], "o")}
          <span class="note">${esc(this._t("repeat_hint"))}</span></div>
      </div>`;
  }

  _tabs(tab) {
    return `<div class="mtabs" role="tablist">
      <button class="mtab" role="tab" data-mtab="main" aria-selected="${tab !== "options"}">${esc(this._t(this._edit?.mode === "new" ? "tab_schedule" : "tab_slot"))}</button>
      <button class="mtab" role="tab" data-mtab="options" aria-selected="${tab === "options"}">${esc(this._t("tab_options"))}</button>
    </div>`;
  }

  _foot(left = "") {
    const e = this._edit;
    return `${e.error ? `<div class="err">${esc(e.error)}</div>` : ""}
      <div class="mfoot">${left}<span class="grow"></span>
        <button class="btn plain small" data-action="close">${esc(this._t("cancel"))}</button>
        <button class="btn small" data-action="save"${e.saving ? " disabled" : ""}>${esc(this._t("save"))}</button>
      </div>`;
  }

  _actionSelect(options, selected) {
    return `<select data-field="action">${options
      .map((o) => `<option value="${esc(o.key)}"${o.key === selected ? " selected" : ""}>${esc(o.label)}</option>`)
      .join("")}</select>`;
  }

  // `pe`: the index of the entity whose action this is (#23), when the slot is edited entity by entity.
  _valueInput(opt, value, vals = {}, pe = null) {
    if (opt?.vars) return opt.vars.map((x, k) => this._varInput(x, k, vals?.[x.field], pe)).join("");
    if (!opt?.input) return "";
    const i = opt.input;
    const id = pe === null ? "sc-val" : `sc-val-${pe}`;
    const at = pe === null ? "" : ` data-pe="${pe}"`;
    return `<label for="${id}">${esc(this._t(i.field === "temperature" ? "act_temperature" : i.field === "position" ? "act_position" : "act_value"))}</label>
      <div class="pair"><input id="${id}" type="number" data-field="value"${at} min="${i.min}" max="${i.max}" step="${i.step}" value="${esc(value ?? "")}">${i.unit ? `<span class="u">${esc(i.unit)}</span>` : ""}</div>`;
  }

  // The field of a custom action's variable: a list of its options, or a number with its unit and range.
  _varInput(x, k, value, pe = null) {
    const id = pe === null ? `sc-var${k}` : `sc-var${k}-${pe}`;
    const at = pe === null ? "" : ` data-pe="${pe}"`;
    const label = `<label for="${id}">${esc(x.label)}</label>`;
    if (x.type === "list") {
      const opts = `${x.optional ? `<option value=""${value === "" ? " selected" : ""}>—</option>` : ""}${x.options
        .map((o, i) => `<option value="${i}"${String(i) === String(value) ? " selected" : ""}>${esc(o.label)}</option>`)
        .join("")}`;
      const icon = x.options[Number(value)]?.icon;
      const sel = `<select id="${id}" data-var="${esc(x.field)}"${at}>${opts}</select>`;
      return `${label}${icon ? `<div class="pair">${sel}<ha-icon class="u" icon="${esc(icon)}"></ha-icon></div>` : sel}`;
    }
    const n = (a) => (x[a] !== null && x[a] !== undefined ? ` ${a}="${x[a]}"` : "");
    return `${label}<div class="pair"><input id="${id}" type="number" inputmode="decimal" data-var="${esc(x.field)}"${at}${n("min")}${n("max")} step="${x.step}" value="${esc(value ?? "")}"${x.optional ? ' placeholder="—"' : ""}>${x.unit ? `<span class="u">${esc(x.unit)}</span>` : ""}</div>`;
  }

  // The slot under edit can be split in two (fixed times, with an end) or merged with the slot starting at its end.
  _canSplitMerge(e) {
    if (e.index === null || !e.item) return { split: false, merge: false };
    const sun = sunTimes(this._hass);
    const slot = e.item.timeslots?.[e.index];
    const fixed = (x) => x && !/sun/.test(x);
    const a = fixed(slot?.start) ? parseTime(slot.start, sun)?.min : null;
    const b = fixed(slot?.stop) ? parseTime(slot.stop, sun)?.min : null;
    const end = b === 0 && a > 0 ? DAY : b;
    const split = a !== null && end !== null && end - a >= 2 * this._step();
    const merge = !!slot?.stop && (e.item.timeslots || []).some((s, k) => k !== e.index && s.start === slot.stop && s.stop);
    return { split, merge };
  }

  // The step of the grid's drags and splits, minutes (`time_step`, 15 by default).
  _step() {
    const s = num(this._config.time_step);
    return s && s >= 1 && s <= 60 ? Math.round(s) : 15;
  }

  _editHtml() {
    const e = this._edit;
    if (!e) return "";
    if (e.mode === "new") return this._newHtml();
    const m = this._all?.find((x) => x.id === e.id);
    if (!m) return "";
    const title = this._t(e.optsOnly ? "schedule_options" : e.index === null ? "add_slot" : "edit_slot");
    if (e.loading || !e.draft)
      return this._modal(title, m.name, m.icon, `<div class="${e.error ? "err" : "note"}">${esc(e.error || this._t("loading"))}</div>`, m.base);
    if (e.optsOnly || e.tab === "options") {
      const dup = e.optsOnly ? `<button class="btn small plain" data-action="duplicate">${esc(this._t("duplicate"))}</button>` : "";
      return this._modal(title, m.name, m.icon, `${e.optsOnly ? "" : this._tabs("options")}${this._optionsHtml(e.opts)}${this._foot(dup)}`, m.base);
    }
    const d = e.draft;
    const opt = e.options.find((o) => o.key === d.action);
    const single = e.item.timeslots.length <= 1;
    const del =
      e.index === null
        ? ""
        : `<button class="btn small danger" data-action="delete" style="--c:var(--sc-danger)">${esc(e.confirm ? this._t("confirm_delete") : this._t(single ? "delete_schedule" : "delete_slot"))}</button>`;
    const sm = this._canSplitMerge(e);
    const tools = `${sm.split ? `<button class="btn small plain" data-action="split">${esc(this._t("split"))}</button>` : ""}${sm.merge ? `<button class="btn small plain" data-action="merge">${esc(this._t("merge_next"))}</button>` : ""}`;
    const action = d.per
      ? `<label>${esc(this._t("action"))}</label><div class="stack pes">${d.per.map((p, k) => this._perField(p, k)).join("")}</div>`
      : `<label for="sc-act">${esc(this._t("action"))}</label>${this._actionSelect(e.options, d.action).replace("<select", '<select id="sc-act"')}
        ${this._valueInput(opt, d.value, d.vals)}`;
    const body = `${this._tabs("main")}<div class="form">
        ${this._entitiesField(e)}
        ${this._timeField("start", d, this._t("start"))}
        ${this._timeField("stop", d, this._t("end"), true)}
        ${action}
        ${this._daysField(d)}
        <div class="note full">${esc(this._t("days_note"))}</div>
      </div>
      ${this._foot(`${del}${tools}`)}`;
    return this._modal(title, m.name, m.icon, body, m.base);
  }

  // An entity's icon: its own, else its domain's.
  _entityIcon(id) {
    return this._hass.states[id]?.attributes?.icon || DOMAIN_ICONS[domainOf(id)] || "mdi:help-circle-outline";
  }

  // The entities of the schedule under edit (#23), above its times: their names and icons, and a Change button that
  // turns the list into a picker (entities of the same kind, by `include` / `exclude`; at least one kept).
  _entitiesField(e) {
    const d = e.draft;
    if (!e.targets?.length || !d.ents) return "";
    const removable = e.entEdit && d.ents.length > 1;
    const chips = d.ents
      .map(
        (id) => `<div class="ent" data-key="pent-${esc(id)}"><ha-icon icon="${esc(this._entityIcon(id))}"></ha-icon><span class="en">${esc(this._entityName(id))}</span>${
          removable ? `<button class="x" data-unpent="${esc(id)}" title="${esc(this._t("remove"))}" aria-label="${esc(`${this._t("remove")} ${this._entityName(id)}`)}">${svgIcon(ICONS.close)}</button>` : ""
        }</div>`,
      )
      .join("");
    const more = e.entEdit ? pickable(this._hass, this._config).filter((id) => e.domains.includes(domainOf(id)) && !d.ents.includes(id)) : [];
    const picker = more.length
      ? `<input type="text" list="sc-pents" data-pent="1" placeholder="${esc(this._t("add_entity"))}" aria-label="${esc(this._t("add_entity"))}" autocomplete="off">
         <datalist id="sc-pents">${more.map((id) => `<option value="${esc(id)}">${esc(this._entityName(id))}</option>`).join("")}</datalist>`
      : "";
    const change = e.entEdit ? "" : `<button class="btn small plain chg" data-action="change-entities">${esc(this._t("change_entities"))}</button>`;
    return `<label>${esc(this._t("entities"))}</label><div class="stack">
        <div class="ents-h"><div class="ents">${chips}</div>${change}</div>
        ${picker}
        <span class="note">${esc(this._t("entities_note"))}</span>
      </div>`;
  }

  // The action of one entity (#23): its name and icon, its action and the action's values.
  _perField(p, k) {
    const options = this._edit.perOptions.get(p.entity)?.options || [];
    const opt = options.find((o) => o.key === p.action);
    const sel = this._actionSelect(options, p.action).replace("<select", `<select id="sc-pe${k}" data-pe="${k}" aria-label="${esc(`${this._t("action")} · ${this._entityName(p.entity)}`)}"`);
    const vals = this._valueInput(opt, p.value, p.vals, k);
    return `<div class="pe" data-key="pe-${esc(p.entity)}">
        <div class="pe-h"><ha-icon icon="${esc(this._entityIcon(p.entity))}"></ha-icon><span class="en">${esc(this._entityName(p.entity))}</span></div>
        ${sel}${vals ? `<div class="form pe-v">${vals}</div>` : ""}
      </div>`;
  }

  _newHtml() {
    const e = this._edit;
    const d = e.draft;
    if (e.tab === "options") return this._modal(this._t("new_schedule"), "", ICONS.calendarClock, `${this._tabs("options")}${this._optionsHtml(e.opts)}${this._foot()}`);
    const options = this._newOptions(d.entity);
    const opt = options.find((o) => o.key === d.action);
    const all = pickable(this._hass, this._config);
    // More entities: of the first one's kind, so that its action fits them all.
    const more = d.entity && this._hass.states[d.entity] ? all.filter((id) => domainOf(id) === domainOf(d.entity) && id !== d.entity && !d.more.includes(id)) : [];
    const icon = (id) => this._hass.states[id]?.attributes?.icon || DOMAIN_ICONS[domainOf(id)] || "mdi:help-circle-outline";
    const extra = d.more
      .map(
        (id) => `<div class="ent" data-key="ent-${esc(id)}"><ha-icon icon="${esc(icon(id))}"></ha-icon><span class="en">${esc(this._entityName(id))}</span>
          <button class="x" data-unent="${esc(id)}" title="${esc(this._t("remove"))}" aria-label="${esc(`${this._t("remove")} ${this._entityName(id)}`)}">${svgIcon(ICONS.close)}</button></div>`,
      )
      .join("");
    const body = `${this._tabs("main")}<div class="form">
        <label for="sc-name">${esc(this._t("name"))}</label><input id="sc-name" type="text" data-field="name" value="${esc(d.name)}">
        <label>${esc(this._t("kind"))}</label><div class="stack">${this._seg("kind", d.kind, [["slots", this._t("kind_slots")], ["single", this._t("kind_single")]])}
          <span class="note">${esc(this._t(d.kind === "single" ? "kind_single_hint" : "kind_slots_hint"))}</span></div>
        <label for="sc-ent">${esc(this._t("entities"))}</label><div class="stack">
          <input id="sc-ent" type="text" list="sc-entities" data-field="entity" value="${esc(d.entity)}" autocomplete="off">
          <datalist id="sc-entities">${all.map((id) => `<option value="${esc(id)}">${esc(this._entityName(id))}</option>`).join("")}</datalist>
          ${d.more.length ? `<div class="ents">${extra}</div>` : ""}
          ${
            more.length
              ? `<input type="text" list="sc-more" data-more="1" placeholder="${esc(this._t("add_entity"))}" aria-label="${esc(this._t("add_entity"))}" autocomplete="off">
                 <datalist id="sc-more">${more.map((id) => `<option value="${esc(id)}">${esc(this._entityName(id))}</option>`).join("")}</datalist>`
              : ""
          }
        </div>
        ${options.length ? `<label for="sc-act">${esc(this._t("action"))}</label>${this._actionSelect(options, d.action).replace("<select", '<select id="sc-act"')}` : ""}
        ${this._valueInput(opt, d.value, d.vals)}
        ${this._timeField("start", d, this._t(d.kind === "single" ? "at_time" : "start"))}
        ${d.kind === "single" ? "" : this._timeField("stop", d, this._t("end"), true)}
        ${this._daysField(d)}
      </div>
      ${this._foot()}`;
    return this._modal(this._t("new_schedule"), "", ICONS.calendarClock, body);
  }

  // The actions offered for an entity, labelled (a custom action by its own name).
  _labelled(list, entityId) {
    const tr = (k, v) => this._t(k, v);
    return list.map((a) => ({
      ...a,
      key: a.vars ? `${actionKey(a.service, a.data)}#${a.vars.map((x) => x.field).join(",")}` : a.input ? `${a.service}#${a.input.field}` : actionKey(a.service, a.data),
      label: a.name
        ? a.name
        : a.vars
          ? `${actionInfo(this._hass, tr, this._loc(), { service: a.service, data: {} }, entityId).label}…`
          : a.input
          ? `${this._t(a.input.field === "temperature" ? "act_temperature" : a.input.field === "position" ? "act_position" : "act_value")}…`
          : actionInfo(this._hass, tr, this._loc(), a, entityId).label,
    }));
  }

  // The actions of an entity: the card's custom ones first, then those of its domain.
  _entityActions(entityId) {
    return [...customActions(this._config, entityId), ...domainActions(this._hass, entityId)];
  }

  _newOptions(entityId) {
    return this._hass.states[entityId] ? this._labelled(this._entityActions(entityId), entityId).filter((o, k, all) => all.findIndex((x) => x.key === o.key) === k) : [];
  }

  // ── Rendering ──

  _noEntities() {
    return `<style>${STYLE}</style><ha-card><div class="warning">${esc(this._t("no_entities"))}</div></ha-card>`;
  }

  _render() {
    if (!discover(this._hass).length) return this._noEntities();
    const models = this._models();
    const now = this._now();
    const m = this._view ? models.find((x) => x.id === this._view) : null;
    if (this._view && !m) this._view = null;
    const rows = this._sceneRows(models, now, m);
    const header = m
      ? this._header(m.name, this._weekStats(m, now), now, rows, this._status([m], now))
      : this._header(this._config.title || this._t("schedules"), this._timelineStats(models, now), now, rows, this._status(models, now));
    return `<style>${STYLE}${this._extraStyle()}</style>
      <ha-card class="${this._edit ? "has-modal" : ""}">
        ${header}
        ${m ? this._tabsHtml(models, m) : ""}
        ${m ? this._week(m, now) : this._timeline(models, now)}
        ${this._editHtml()}
      </ha-card>`;
  }

  _extraStyle() {
    return "";
  }

  // The full card has no detail button.
  _zoomButton() {
    return "";
  }

  // ── Interaction ──

  _showWeek(id) {
    this._view = id;
    this._notice = null;
    this._run++;
    this._update(this._sig);
  }

  _showTimeline() {
    this._view = null;
    this._notice = null;
    this._edit = null;
    this._update(this._sig);
  }

  _closeEdit() {
    this._edit = null;
    this._update(this._sig);
  }

  // The schedule as the component stores it (actions with their entities and data, conditions, dates): the
  // `scheduler` command lists them with their entity ids, `scheduler/item` returns the current one.
  async _fetchItem(id) {
    const list = await this._hass.callWS({ type: "scheduler" });
    const found = (Array.isArray(list) ? list : []).find((s) => s.entity_id === id);
    if (!found) throw new Error("not found");
    const item = await this._hass.callWS({ type: "scheduler/item", schedule_id: found.schedule_id });
    return item || found;
  }

  async _openSlot(id, index, atMin = null, optsOnly = false) {
    const m = this._all.find((x) => x.id === id);
    if (!m || this._config.editable === false) return;
    this._edit = { mode: "slot", id, index, loading: true, optsOnly, tab: optsOnly ? "options" : "main" };
    this._update(this._sig);
    let item;
    try {
      item = await this._fetchItem(id);
    } catch (_e) {
      if (this._edit?.id === id) {
        this._edit.error = this._t("err_load");
        this._update(this._sig);
      }
      return;
    }
    const e = this._edit;
    if (!e || e.id !== id) return;
    const sun = sunTimes(this._hass);
    const slot = index !== null ? item.timeslots?.[index] : null;
    // The entities of the schedule (#23): those of every slot's actions, in their order.
    const targets = scheduleEntities(item);
    if (!targets.length) targets.push(...((slot || item.timeslots?.[0])?.actions?.map((a) => a.entity_id).filter(Boolean) || m.entities));
    const target = targets[0] || m.target;
    const { options, varsOf } = this._slotOptions(item, target);
    // A slot whose actions differ from one entity to another (#23) is edited entity by entity.
    const acts = (slot?.actions || []).filter((a) => a?.entity_id);
    const perEntity = acts.length > 1 && acts.some((a) => actionKey(a.service, a.service_data) !== actionKey(acts[0].service, acts[0].service_data));
    const perOptions = new Map();
    const days = new Set([0, 1, 2, 3, 4, 5, 6].filter((wd) => runsOn(item.weekdays, wd, this._hass)));
    const wds = Array.isArray(item.weekdays) ? item.weekdays : [];
    const dayMode = wds.length === 1 && ["daily", "workday", "weekend"].includes(wds[0]) ? wds[0] : "custom";
    let draft;
    if (slot) {
      const a = slot.actions?.[0] || {};
      const v = varsOf(a);
      draft = { ...this._timeDraft("start", slot.start, sun), ...this._timeDraft("stop", slot.stop, sun), action: v ? v.key : actionKey(a.service, a.service_data), value: "", days, dayMode };
      if (v) Object.assign(draft, { vals: v.vals, keep: { key: v.key, data: v.keep, vals: { ...v.vals } } });
      if (!options.some((o) => o.key === draft.action)) draft.action = options[0]?.key || "";
    } else {
      const start = atMin ?? 12 * 60;
      draft = { ...this._timeDraft("start", `${hm(start)}:00`, sun), ...this._timeDraft("stop", `${hm(Math.min(DAY - 1, start + 60))}:00`, sun), action: options[0]?.key || "", value: "", days, dayMode };
    }
    const opt = options.find((o) => o.key === draft.action);
    if (opt?.input) draft.value = String(opt.input.min);
    if (opt?.vars && !draft.vals) draft.vals = varDefaults(opt);
    draft.ents = [...targets];
    if (perEntity) draft.per = acts.map((a) => this._perDraft(a.entity_id, a, perOptions, item));
    const opts = optionsOf(item);
    this._edit = {
      ...e,
      loading: false,
      item,
      options,
      perOptions,
      targets,
      domains: [...new Set(targets.map(domainOf))],
      draft,
      initial: { ...draft, days: new Set(days), per: draft.per ? JSON.parse(JSON.stringify(draft.per)) : undefined },
      initialRaw: { start: this._raw(draft, "start"), stop: this._raw(draft, "stop") },
      opts,
      initialOpts: JSON.parse(JSON.stringify(opts)),
    };
    this._update(this._sig);
  }

  // The actions offered for an entity of a schedule: the schedule's own actions first, then those of the entity. A
  // stored action set by a custom action with variables is shown as that action, with its values (`varsOf`).
  _slotOptions(item, target) {
    const entityActions = this._labelled(this._entityActions(target), target);
    const varsOf = (a) => {
      let best = null;
      for (const o of entityActions) {
        const r = o.vars && matchVars(o, a?.service, a?.service_data);
        if (r && (!best || Object.keys(r.keep).length < Object.keys(best.keep).length)) best = { ...r, key: o.key };
      }
      return best;
    };
    const own = [];
    for (const ts of item.timeslots || []) {
      const list = (ts.actions || []).filter((a) => !a?.entity_id || a.entity_id === target);
      const a = list[0] || ts.actions?.[0];
      if (a && !varsOf(a) && !own.some((o) => actionKey(o.service, o.data) === actionKey(a.service, a.service_data))) own.push({ service: a.service, data: a.service_data || {} });
    }
    const options = [...this._labelled(own, target), ...entityActions].filter((o, k, all) => all.findIndex((x) => x.key === o.key) === k);
    return { options, varsOf };
  }

  // The draft of one entity's action (#23), from its stored action `a` (or a copy of another entity's draft `from`);
  // its options are kept in `perOptions`.
  _perDraft(entity, a, perOptions, item, from = null) {
    if (!perOptions.has(entity)) perOptions.set(entity, this._slotOptions(item, entity));
    const { options, varsOf } = perOptions.get(entity);
    if (from) {
      const p = { ...JSON.parse(JSON.stringify(from)), entity };
      if (!options.some((o) => o.key === p.action)) {
        p.action = options[0]?.key || "";
        const opt = options[0];
        p.value = opt?.input ? String(opt.input.min) : "";
        p.vals = opt?.vars ? varDefaults(opt) : undefined;
        delete p.keep;
      }
      return p;
    }
    const v = varsOf(a);
    const p = { entity, action: v ? v.key : actionKey(a.service, a.service_data), value: "" };
    if (v) Object.assign(p, { vals: v.vals, keep: { key: v.key, data: v.keep, vals: { ...v.vals } } });
    if (!options.some((o) => o.key === p.action)) p.action = options[0]?.key || "";
    const opt = options.find((o) => o.key === p.action);
    if (opt?.input) p.value = String(num(a.service_data?.[opt.input.field]) ?? opt.input.min);
    if (opt?.vars && !p.vals) p.vals = varDefaults(opt);
    return p;
  }

  // The draft fields of a start or end: its fixed time, its mode (time, sunrise, sunset), the offset's sign and length.
  _timeDraft(k, raw, sun) {
    const p = splitTime(raw, sun);
    return { [k]: p.time, [`${k}Mode`]: p.mode, [`${k}Sign`]: p.sign, [`${k}Off`]: p.off };
  }

  // The time of the draft as the component stores it ("" for no end).
  _raw(d, k) {
    return joinTime(d[`${k}Mode`] || "time", d[k], d[`${k}Sign`], d[`${k}Off`]);
  }

  _openNew() {
    const now = this._now();
    const start = Math.min(DAY - 60, Math.ceil((now.min + 1) / 30) * 30);
    const opts = optionsOf({ tags: cardTags(this._config) });
    this._edit = {
      mode: "new",
      tab: "main",
      draft: { entity: "", more: [], kind: "slots", action: "", value: "", ...this._timeDraft("start", `${hm(start)}:00`), ...this._timeDraft("stop", `${hm(Math.min(DAY - 1, start + 60))}:00`), days: new Set([0, 1, 2, 3, 4, 5, 6]), dayMode: "daily" },
      opts,
      initialOpts: JSON.parse(JSON.stringify(opts)),
    };
    this._update(this._sig);
  }

  // The data of the chosen action: an entered value goes into its field.
  _actionData(opt, value, d = {}) {
    if (!opt) return null;
    if (opt.vars) {
      const data = varsData(opt, d.vals, d.keep?.key === opt.key ? d.keep.data : {});
      return data ? { service: opt.service, data } : null;
    }
    if (!opt.input) return { service: opt.service, data: opt.data || {} };
    const v = num(value);
    if (v === null) return null;
    return { service: opt.service, data: { ...(opt.data || {}), [opt.input.field]: v } };
  }

  // The slots of the schedule once the draft is in (sorted by start), or an error.
  _slotsAfterEdit(e) {
    const d = e.draft;
    const sun = sunTimes(this._hass);
    const startRaw = this._raw(d, "start");
    const start = startRaw ? parseTime(startRaw, sun) : null;
    if (!start) return { error: this._t("err_time") };
    const stopRaw = this._raw(d, "stop");
    const stop = stopRaw ? parseTime(stopRaw, sun) : null;
    if (stop && stop.min === start.min) return { error: this._t("err_same") };
    const ents = d.ents?.length ? d.ents : e.targets || [];
    if (e.targets?.length && !ents.length) return { error: this._t("err_entity") };
    const entsChanged = JSON.stringify(ents) !== JSON.stringify(e.targets || []);
    const slots = (e.item.timeslots || []).map(cleanSlot);
    const old = e.index !== null ? slots[e.index] : null;
    const built = (act, id) => ({ service: act.service, ...(id ? { entity_id: id } : {}), ...(Object.keys(act.data).length ? { service_data: act.data } : {}) });
    const same = (a, b) => JSON.stringify([a.action, a.value, a.vals]) === JSON.stringify([b.action, b.value, b.vals]);
    let actions;
    if (d.per) {
      // Entity by entity: an action left as it was read is sent back exactly as stored.
      actions = [];
      for (const p of d.per) {
        const was = e.initial?.per?.find((x) => x.entity === p.entity);
        const stored = old?.actions?.find((a) => a.entity_id === p.entity);
        if (was && stored && same(p, was)) {
          actions.push(stored);
          continue;
        }
        const act = this._actionData(
          e.perOptions.get(p.entity)?.options.find((o) => o.key === p.action),
          p.value,
          p,
        );
        if (!act) return { error: this._t("err_action") };
        actions.push(built(act, p.entity));
      }
      actions.push(...(old?.actions || []).filter((a) => !a.entity_id));
    } else if (old && e.initial && same(d, e.initial)) {
      // The action left as it was read: the stored actions are sent back as they are, on the entities chosen.
      actions = entsChanged ? remapActions(old.actions, ents, e.targets) : old.actions;
    } else {
      const act = this._actionData(
        e.options.find((o) => o.key === d.action),
        d.value,
        d,
      );
      if (!act) return { error: this._t("err_action") };
      const own = old ? remapActions(old.actions, ents, e.targets).filter((a) => a.entity_id).map((a) => a.entity_id) : ents;
      actions = own.length ? own.map((id) => built(act, id)) : [built(act)];
    }
    // Other entities apply to every slot of the schedule.
    if (entsChanged) for (const s of slots) s.actions = remapActions(s.actions, ents, e.targets);
    const base = old || slots[0] || {};
    const slot = {};
    // An unchanged time is sent back as stored.
    slot.start = old && startRaw === e.initialRaw?.start ? old.start : startRaw;
    if (stopRaw) slot.stop = old?.stop && stopRaw === e.initialRaw?.stop ? old.stop : stopRaw;
    for (const k of ["conditions", "condition_type", "track_conditions"]) if (base[k] !== undefined) slot[k] = base[k];
    slot.actions = actions;
    const all = [...slots.filter((_s, k) => k !== e.index), slot].sort((x, y) => slotRange(x, sun)[0] - slotRange(y, sun)[0]);
    if (slotsClash(all, all.indexOf(slot), sun)) return { error: this._t("err_overlap") };
    return { slots: all };
  }

  async _call(domain, service, data) {
    try {
      await this._hass.callService(domain, service, data);
      return null;
    } catch (err) {
      return this._t("err_save", { error: err?.message || String(err) });
    }
  }

  // The options put into a payload: conditions on every slot (only when changed, so that slots with their own
  // conditions keep them), dates, name, tags and what happens after the last slot. An error key, or null.
  _applyOptions(e, payload, slots, isNew = false) {
    const o = e.opts;
    const i = e.initialOpts || {};
    const c = conditionsPayload(o);
    if (c.error) return c.error;
    const changed = isNew || JSON.stringify([o.conds, o.condType, o.track]) !== JSON.stringify([i.conds, i.condType, i.track]);
    payload.timeslots = changed ? withConditions(slots, o, c.conds) : slots;
    if (o.period && (o.from || o.to)) {
      if (o.from && o.to && o.to < o.from) return "err_dates";
      if (o.from) payload.start_date = o.from;
      if (o.to) payload.end_date = o.to;
    }
    if (isNew) {
      if (o.name.trim()) payload.name = o.name.trim();
      if (o.tags.length) payload.tags = [...o.tags];
      payload.repeat_type = o.repeat;
      return null;
    }
    if (o.name !== i.name) payload.name = o.name.trim() || null;
    if (JSON.stringify(o.tags) !== JSON.stringify(i.tags)) payload.tags = [...o.tags];
    if (o.repeat !== i.repeat) payload.repeat_type = o.repeat;
    return null;
  }

  async _save() {
    const e = this._edit;
    if (!e || e.saving) return;
    let service;
    let payload;
    if (e.mode === "new") {
      const d = e.draft;
      if (!this._hass.states[d.entity]) return this._fail(this._t("err_entity"));
      const opt = this._newOptions(d.entity).find((o) => o.key === d.action) || this._newOptions(d.entity)[0];
      const act = this._actionData(opt, d.value, d);
      if (!act) return this._fail(this._t("err_action"));
      const sun = sunTimes(this._hass);
      const startRaw = this._raw(d, "start");
      const start = startRaw ? parseTime(startRaw, sun) : null;
      if (!start) return this._fail(this._t("err_time"));
      const stopRaw = d.kind === "single" ? "" : this._raw(d, "stop");
      const stop = stopRaw ? parseTime(stopRaw, sun) : null;
      if (stop && stop.min === start.min) return this._fail(this._t("err_same"));
      if (d.dayMode === "custom" && !d.days.size) return this._fail(this._t("err_days"));
      const ents = [d.entity, ...d.more.filter((id) => this._hass.states[id])];
      const data = Object.keys(act.data).length ? { service_data: act.data } : {};
      const slot = { start: startRaw, actions: ents.map((id) => ({ service: act.service, entity_id: id, ...data })) };
      if (stopRaw) slot.stop = stopRaw;
      service = "add";
      payload = { weekdays: this._weekdaysOf(e) };
      const err = this._applyOptions(e, payload, [slot], true);
      if (err) return this._fail(this._t(err));
    } else if (e.optsOnly) {
      if (!e.item) return;
      service = "edit";
      payload = { entity_id: e.id };
      const err = this._applyOptions(e, payload, (e.item.timeslots || []).map(cleanSlot));
      if (err) return this._fail(this._t(err));
    } else {
      if (!e.draft) return;
      if (e.draft.dayMode === "custom" && !e.draft.days.size) return this._fail(this._t("err_days"));
      const r = this._slotsAfterEdit(e);
      if (r.error) return this._fail(r.error);
      service = "edit";
      payload = { entity_id: e.id, weekdays: this._weekdaysOf(e) };
      const err = this._applyOptions(e, payload, r.slots);
      if (err) return this._fail(this._t(err));
    }
    e.saving = true;
    e.error = null;
    this._update(this._sig);
    const error = await this._call("scheduler", service, payload);
    if (this._edit !== e) return;
    if (error) return this._fail(error);
    this._closeEdit();
  }

  // The weekdays to send: a preset (daily, workday, weekend) as such; chosen days unchanged keep the schedule's own.
  _weekdaysOf(e) {
    const d = e.draft;
    if (d.dayMode && d.dayMode !== "custom") return [d.dayMode];
    const same = e.initial && e.initial.dayMode === "custom" && d.days.size === e.initial.days.size && [...d.days].every((x) => e.initial.days.has(x));
    return same && Array.isArray(e.item?.weekdays) && e.item.weekdays.length ? e.item.weekdays : weekdaysPayload(d.days, null, this._hass);
  }

  _fail(message) {
    if (!this._edit) return;
    this._edit.saving = false;
    this._edit.error = message;
    this._update(this._sig);
  }

  // The schedule's dates, sent back with every scheduler.edit (it resets those it is not given).
  _dates(item) {
    return { ...(item?.start_date ? { start_date: item.start_date } : {}), ...(item?.end_date ? { end_date: item.end_date } : {}) };
  }

  // Delete: the slot when the schedule has others, else the schedule itself (scheduler.remove); asked twice.
  async _delete() {
    const e = this._edit;
    if (!e?.item || e.index === null || e.saving) return;
    if (!e.confirm) {
      e.confirm = true;
      this._update(this._sig);
      return;
    }
    e.saving = true;
    const slots = (e.item.timeslots || []).map(cleanSlot);
    const error =
      slots.length <= 1
        ? await this._call("scheduler", "remove", { entity_id: e.id })
        : await this._call("scheduler", "edit", { entity_id: e.id, timeslots: slots.filter((_s, k) => k !== e.index), ...this._dates(e.item) });
    if (this._edit !== e) return;
    if (error) return this._fail(error);
    if (slots.length <= 1) this._view = null;
    this._closeEdit();
  }

  // Split the slot under edit in two halves (on the time step), or merge it with the slot starting at its end.
  async _splitMerge(kind) {
    const e = this._edit;
    if (!e?.item || e.index === null || e.saving) return;
    const sun = sunTimes(this._hass);
    const slots = (e.item.timeslots || []).map(cleanSlot);
    const s = slots[e.index];
    if (kind === "split") {
      const [a, b] = slotRange(s, sun);
      const step = this._step();
      const mid = a + Math.max(step, Math.round((b - a) / 2 / step) * step);
      if (b === null || mid >= b) return;
      slots.splice(e.index, 1, { ...s, stop: `${hm(mid)}:00` }, { ...s, start: `${hm(mid)}:00` });
    } else {
      const n = slots.findIndex((x, k) => k !== e.index && x.start === s.stop && x.stop);
      if (n < 0) return;
      slots[e.index] = { ...s, stop: slots[n].stop };
      slots.splice(n, 1);
    }
    e.saving = true;
    const error = await this._call("scheduler", "edit", { entity_id: e.id, timeslots: slots, ...this._dates(e.item) });
    if (this._edit !== e) return;
    if (error) return this._fail(error);
    this._closeEdit();
  }

  // A copy of the schedule (scheduler.copy), named « Name (copy) ».
  async _duplicate() {
    const e = this._edit;
    const m = this._all?.find((x) => x.id === e?.id);
    if (!m || e.saving) return;
    e.saving = true;
    const error = await this._call("scheduler", "copy", { entity_id: e.id, name: this._t("copy_name", { name: m.name }) });
    if (this._edit !== e) return;
    if (error) return this._fail(error);
    this._closeEdit();
  }

  _toggle(id, on) {
    this._hass.callService("switch", on ? "turn_on" : "turn_off", { entity_id: id });
  }

  // The header switch: the schedules it acts on resolved once, then only those not yet in the wanted state switched,
  // one call each so that a failure leaves the others done; the failures counted in a notice, the switches redrawn
  // from Home Assistant's states. Only the schedules' enabled state changes.
  async _toggleAll() {
    if (this._config.editable === false || this._toggling) return this._update(this._sig);
    const targets = toggleTargets(this._all || [], this._config);
    // As the switch shows: any enabled turns them all off, none enabled turns them all on.
    const on = !targets.some((m) => m.enabled);
    const ids = targets.filter((m) => m.enabled !== on).map((m) => m.id);
    if (!ids.length) return this._update(this._sig);
    this._toggling = true;
    this._notice = null;
    this._update(this._sig);
    const errors = (await Promise.all(ids.map((id) => this._call("switch", on ? "turn_on" : "turn_off", { entity_id: id })))).filter(Boolean);
    this._toggling = false;
    if (errors.length) this._notice = `${this._t("err_toggle", { count: errors.length, total: ids.length })} — ${errors[0]}`;
    this._update(this._sig);
  }

  _change(ev) {
    const path = ev.composedPath();
    if (path.some((n) => n.dataset?.toggleAll)) {
      ev.stopPropagation();
      this._toggleAll();
      return;
    }
    const sw = path.find((n) => n.dataset?.toggle);
    if (sw) {
      ev.stopPropagation();
      // Read-only card: the switch is greyed; a change that still gets through is put back.
      if (this._config.editable === false) return this._update(this._sig);
      this._toggle(sw.dataset.toggle, !!sw.checked);
      return;
    }
    this._input(ev, true);
  }

  // A field of the popup: kept in the draft or the options; a new action or entity redraws the popup.
  _input(ev, change = false) {
    const el = ev.composedPath()[0];
    const e = this._edit;
    if (!el?.dataset || !e) return;
    if (el.dataset.ofield && e.opts) {
      const f = el.dataset.ofield;
      e.opts[f] = el.type === "checkbox" ? !!el.checked : el.value;
      if (f === "period" || f === "track") this._update(this._sig);
      return;
    }
    if (el.dataset.cond !== undefined && e.opts) {
      const c = e.opts.conds[Number(el.dataset.cond)];
      if (!c) return;
      const f = el.dataset.cfield;
      if (f === "value" && el.value === OTHER_VALUE) {
        // « Other value… »: a free field, the value chosen so far kept in it.
        if (change) {
          c.manual = true;
          this._update(this._sig);
        }
        return;
      }
      if (f === "entity" && el.value !== c.entity) c.manual = false;
      c[f] = el.value;
      // Another entity or comparison changes the kind of value field.
      if (change && (f === "entity" || f === "match")) this._update(this._sig);
      return;
    }
    if (el.dataset.tag && change) {
      const v = String(el.value || "").trim();
      if (v && !e.opts.tags.includes(v)) e.opts.tags.push(v);
      el.value = "";
      this._update(this._sig);
      return;
    }
    if (el.dataset.pent && change) {
      // An entity added to the schedule (#23): of the same kind as its entities; edited entity by entity, it takes
      // the action of the first one.
      const id = String(el.value || "").trim();
      const d = e.draft;
      if (this._hass.states[id] && d.ents && !d.ents.includes(id) && e.domains?.includes(domainOf(id)) && pickable(this._hass, this._config).includes(id)) {
        d.ents.push(id);
        if (d.per?.length) d.per.push(this._perDraft(id, null, e.perOptions, e.item, d.per[0]));
      }
      el.value = "";
      this._update(this._sig);
      return;
    }
    if (el.dataset.pe !== undefined && e.draft?.per) {
      const p = e.draft.per[Number(el.dataset.pe)];
      if (!p) return;
      if (el.dataset.var !== undefined) {
        p.vals = { ...(p.vals || {}), [el.dataset.var]: el.value };
        if (change && el.tagName === "SELECT") this._update(this._sig);
        return;
      }
      const f = el.dataset.field;
      if (!f) return;
      p[f] = el.value;
      if (f === "action") {
        const opt = e.perOptions.get(p.entity)?.options.find((o) => o.key === p.action);
        p.value = opt?.input ? String(num(p.value) ?? opt.input.min) : "";
        p.vals = opt?.vars ? (p.keep?.key === opt.key ? { ...p.keep.vals } : varDefaults(opt, p.vals)) : undefined;
        this._update(this._sig);
      }
      return;
    }
    if (el.dataset.more && change) {
      const id = String(el.value || "").trim();
      const d = e.draft;
      if (this._hass.states[id] && id !== d.entity && !d.more.includes(id) && domainOf(id) === domainOf(d.entity)) d.more.push(id);
      el.value = "";
      this._update(this._sig);
      return;
    }
    if (el.dataset.var !== undefined && e.draft) {
      e.draft.vals = { ...(e.draft.vals || {}), [el.dataset.var]: el.value };
      // A list's option shows its icon.
      if (change && el.tagName === "SELECT") this._update(this._sig);
      return;
    }
    const field = el.dataset.field;
    if (!field || !e.draft) return;
    const d = e.draft;
    d[field] = el.value;
    if (field === "action" || (field === "entity" && change)) {
      const options = e.mode === "new" ? this._newOptions(d.entity) : e.options;
      if (field === "entity") {
        d.action = options[0]?.key || "";
        d.more = d.more.filter((id) => domainOf(id) === domainOf(d.entity));
      }
      const opt = options.find((o) => o.key === d.action);
      d.value = opt?.input ? String(num(d.value) ?? opt.input.min) : "";
      // Another action: its own values (the data kept from the stored action only goes with its own action).
      d.vals = opt?.vars ? (d.keep?.key === opt.key ? { ...d.keep.vals } : varDefaults(opt, d.vals)) : undefined;
      this._update(this._sig);
    } else if (field === "entity" && this._hass.states[d.entity]) {
      d.action = this._newOptions(d.entity)[0]?.key || "";
      const opt = this._newOptions(d.entity)[0];
      d.vals = opt?.vars ? varDefaults(opt) : undefined;
      this._update(this._sig);
    } else if (field.endsWith("Off")) this._update(this._sig);
  }

  // A click inside the open popup.
  _clickEdit(ev, path, action) {
    const e = this._edit;
    const find = (k) => path.find((n) => n.dataset?.[k] !== undefined);
    const day = find("dayt");
    if (day && e.draft) {
      const d = e.draft;
      // A day of a preset turns it into chosen days, from the preset's own.
      if (d.dayMode && d.dayMode !== "custom") {
        d.days = new Set([0, 1, 2, 3, 4, 5, 6].filter((wd) => runsOn([d.dayMode], wd, this._hass)));
        d.dayMode = "custom";
      }
      const wd = Number(day.dataset.dayt);
      if (d.days.has(wd)) d.days.delete(wd);
      else d.days.add(wd);
      this._update(this._sig);
      return;
    }
    const set = find("set");
    if (set) {
      const [target, field] = set.dataset.set.split(":");
      const obj = target === "o" ? e.opts : e.draft;
      if (!obj) return;
      if (field === "dayMode" && set.dataset.val === "custom" && obj.dayMode !== "custom")
        obj.days = new Set([0, 1, 2, 3, 4, 5, 6].filter((wd) => runsOn([obj.dayMode || "daily"], wd, this._hass)));
      obj[field] = set.dataset.val;
      this._update(this._sig);
      return;
    }
    const tab = find("mtab");
    if (tab) {
      e.tab = tab.dataset.mtab;
      this._update(this._sig);
      return;
    }
    const untag = find("untag");
    if (untag) {
      e.opts.tags = e.opts.tags.filter((x) => x !== untag.dataset.untag);
      this._update(this._sig);
      return;
    }
    const uncond = find("uncond");
    if (uncond) {
      e.opts.conds.splice(Number(uncond.dataset.uncond), 1);
      this._update(this._sig);
      return;
    }
    const unpent = find("unpent");
    if (unpent && e.draft?.ents?.length > 1) {
      const id = unpent.dataset.unpent;
      e.draft.ents = e.draft.ents.filter((x) => x !== id);
      if (e.draft.per) e.draft.per = e.draft.per.filter((p) => p.entity !== id);
      this._update(this._sig);
      return;
    }
    const unent = find("unent");
    if (unent) {
      e.draft.more = e.draft.more.filter((x) => x !== unent.dataset.unent);
      this._update(this._sig);
      return;
    }
    if (action === "add-cond") {
      e.opts.conds.push({ entity: "", match: "is", value: "" });
      this._update(this._sig);
    } else if (action === "change-entities") {
      e.entEdit = true;
      this._update(this._sig);
    } else if (action === "close" || (action === "backdrop" && path[0] === path.find((n) => n.dataset?.action === "backdrop"))) this._closeEdit();
    else if (action === "save") this._save();
    else if (action === "delete") this._delete();
    else if (action === "split" || action === "merge") this._splitMerge(action);
    else if (action === "duplicate") this._duplicate();
  }

  _click(ev) {
    const path = ev.composedPath();
    const action = path.find((n) => n.dataset?.action)?.dataset.action;
    if (this._edit) return this._clickEdit(ev, path, action);
    // The click ending a drag of a slot's edge.
    if (this._dragged) {
      this._dragged = false;
      return;
    }
    if (path.some((n) => n.localName === "ha-switch")) return;
    if (action === "new") return this._openNew();
    if (action === "back") return this._showTimeline();
    if (action === "add-slot" && this._view) return this._openSlot(this._view, null);
    if (action === "opts" && this._view) return this._openSlot(this._view, null, null, true);
    const tab = path.find((n) => n.dataset?.tab);
    if (tab) {
      if (tab.dataset.tab !== this._view) this._showWeek(tab.dataset.tab);
      return;
    }
    const block = path.find((n) => n.dataset?.slot !== undefined);
    if (block && this._view) return this._openSlot(this._view, Number(block.dataset.slot));
    const track = path.find((n) => n.dataset?.add);
    if (track && this._view && typeof track.getBoundingClientRect === "function") {
      const r = track.getBoundingClientRect();
      const x = r.width ? (ev.clientX - r.left) / r.width : 0.5;
      return this._openSlot(this._view, null, Math.max(0, Math.min(DAY - 60, Math.floor((x * DAY) / 30) * 30)));
    }
    const row = path.find((n) => n.dataset?.open);
    if (row) this._showWeek(row.dataset.open);
  }

  // ── Dragging a slot's edge on the weekly grid (by the time step) ──

  _dragStart(ev) {
    const h = ev.composedPath().find((n) => n.dataset?.drag);
    if (!h || this._edit || !this._view || ev.button > 0) return;
    const blk = h.closest?.(".blk");
    const track = blk?.closest?.(".track");
    if (!track) return;
    ev.preventDefault();
    ev.stopPropagation();
    const [i, edge] = h.dataset.drag.split(":");
    const a = Number(blk.dataset.a);
    const b = Number(blk.dataset.b);
    this._drag = { id: this._view, i: Number(i), edge, a, b, to: edge === "a" ? a : b, track, blk };
    this._notice = null;
    h.classList.add("on");
    h.setPointerCapture?.(ev.pointerId);
    const move = (e2) => this._dragMove(e2);
    const up = (e2) => {
      h.removeEventListener("pointermove", move);
      h.removeEventListener("pointerup", up);
      h.removeEventListener("pointercancel", up);
      h.classList.remove("on");
      this._dragEnd(e2.type === "pointercancel");
    };
    h.addEventListener("pointermove", move);
    h.addEventListener("pointerup", up);
    h.addEventListener("pointercancel", up);
  }

  _dragMove(ev) {
    const g = this._drag;
    if (!g) return;
    const r = g.track.getBoundingClientRect();
    const step = this._step();
    let v = Math.round((((ev.clientX - r.left) / (r.width || 1)) * DAY) / step) * step;
    v = g.edge === "a" ? Math.max(0, Math.min(g.b - step, v)) : Math.max(g.a + step, Math.min(DAY, v));
    g.to = v;
    const a = g.edge === "a" ? v : g.a;
    const b = g.edge === "b" ? v : g.b;
    g.blk.style.left = `${((a / DAY) * 100).toFixed(2)}%`;
    g.blk.style.width = `${(((b - a) / DAY) * 100).toFixed(2)}%`;
    let tip = g.track.querySelector(".tip");
    if (!tip) {
      tip = document.createElement("span");
      tip.className = "tip";
      g.track.appendChild(tip);
    }
    tip.style.left = `${((v / DAY) * 100).toFixed(2)}%`;
    tip.textContent = `${this._time(a)} → ${this._time(b)}`;
  }

  async _dragEnd(cancel) {
    const g = this._drag;
    this._drag = null;
    if (!g) return;
    g.track.querySelector(".tip")?.remove();
    const moved = g.to !== (g.edge === "a" ? g.a : g.b);
    if (cancel || !moved) {
      this._html = "";
      this._update(this._sig);
      return;
    }
    this._dragged = true;
    globalThis.setTimeout?.(() => {
      this._dragged = false;
    }, 400);
    await this._moveEdge(g.id, g.i, g.edge, g.to);
  }

  // A slot's start or end moved on the grid: saved with scheduler.edit, refused when it overlaps another slot.
  async _moveEdge(id, i, edge, min) {
    let item;
    try {
      item = await this._fetchItem(id);
    } catch (_e) {
      this._notice = this._t("err_load");
      this._html = "";
      return this._update(this._sig);
    }
    const sun = sunTimes(this._hass);
    const slots = (item.timeslots || []).map(cleanSlot);
    if (!slots[i]) return;
    slots[i] = { ...slots[i], [edge === "a" ? "start" : "stop"]: `${hm(min)}:00` };
    if (slotsClash(slots, i, sun)) {
      this._notice = this._t("err_overlap");
      this._html = "";
      return this._update(this._sig);
    }
    const error = await this._call("scheduler", "edit", { entity_id: id, timeslots: slots, ...this._dates(item) });
    this._notice = error;
    this._html = "";
    this._update(this._sig);
  }
}
