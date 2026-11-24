// ---------------------------------------------------------------------------
// The mini card: the next actions; its detail button unfolds the full card
// ---------------------------------------------------------------------------
import { ICONS } from "./core.js";
import { esc, num, svgIcon } from "./helpers.js";
import { discover } from "./schedules.js";
import { upcoming } from "./actions.js";
import { inDialog, watchOutside } from "./shadow-dom-patching.js";
import { MINI_STYLE, STYLE, ZOOM_STYLE } from "./styles.js";
import { SchedulerCard } from "./full-card.js";

export class SchedulerMiniCard extends SchedulerCard {
  constructor() {
    super();
    this._zoomed = false;
    this._onFold = (ev) => {
      // The click that closed the popup or the weekly grid only does that.
      if (this._closedBy === ev) return;
      if (this._zoomed && !inDialog(ev)) this._setZoom(false);
    };
  }

  static getConfigElement() {
    return document.createElement("scheduler-mini-card-editor");
  }

  connectedCallback() {
    super.connectedCallback();
    (this._foldWatch ??= watchOutside(this, (ev) => this._onFold(ev))).on();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._foldWatch?.off();
    this._zoomed = false;
  }

  getCardSize() {
    if (this._zoomed) return super.getCardSize();
    return this._config?.illustration === false ? 2 : 4;
  }

  getGridOptions() {
    return this._zoomed ? super.getGridOptions() : { columns: 6, min_columns: 6 };
  }

  _setZoom(zoomed) {
    this._zoomed = zoomed;
    if (!zoomed) {
      this._edit = null;
      this._view = null;
    }
    this._update(this._sig);
  }

  _click(ev) {
    if (!this._edit && ev.composedPath().some((n) => n.classList?.contains("zoom"))) {
      ev.stopPropagation();
      this._setZoom(!this._zoomed);
      if (ev.detail === 0) this.shadowRoot.querySelector(".zoom")?.focus({ preventScroll: true });
      return;
    }
    super._click(ev);
  }

  _extraStyle() {
    return this._zoomed ? ZOOM_STYLE : "";
  }

  _zoomButton(cls = "") {
    if (this._config.zoom === false) return "";
    const z = this._zoomed;
    const label = esc(this._t(z ? "zoom_out" : "zoom_in"));
    return `<button class="zoom ${cls}" title="${label}" aria-label="${label}" aria-expanded="${z}">${svgIcon(z ? ICONS.collapse : ICONS.expand)}</button>`;
  }

  _render() {
    if (this._zoomed) return super._render();
    if (!discover(this._hass).length) return this._noEntities();
    const models = this._models();
    const now = this._now();
    const n = Math.max(1, Math.min(10, Math.round(num(this._config.next_actions) ?? 3)));
    const next = upcoming(models, now, this._hass, n);
    const rows = next.length
      ? next
          .map((o) => {
            const info = o.m.infos.get(o.slot.i);
            return `<div class="nr" data-key="nx-${esc(o.m.id)}-${o.at}">
              <span class="tm">${esc(this._when(o, now))}</span>
              <ha-icon icon="${esc(o.m.icon)}" style="--b:${o.m.colors.get(info.key) || o.m.base}"></ha-icon>
              <span class="nn">${esc(o.m.name)}</span>
              <span class="na2">${esc(info.label)}</span>
            </div>`;
          })
          .join("")
      : `<div class="none">${esc(this._t(models.length ? "no_upcoming" : "no_match"))}</div>`;
    const head = next[0] ? this._t("next_time", { time: this._when(next[0], now) }) : "";
    if (this._config.illustration !== false) {
      const stats = next[0] ? [head, next[0].m.name] : [this._t(models.length ? "no_upcoming" : "no_match")];
      const banner = this._banner(
        `<div class="head">${this._titleBlock(this._config.title || this._t("schedules"), stats, this._status(models, now))}</div>${this._zoomButton()}`,
        now,
        this._sceneRows(models, now),
      );
      return `<style>${STYLE}${MINI_STYLE}</style>
      <ha-card class="mini-card illustrated">${banner}${next.length ? `<div class="nx">${rows}</div>` : ""}</ha-card>`;
    }
    return `<style>${STYLE}${MINI_STYLE}</style>
      <ha-card class="mini-card">
        <div class="mini">
          <div class="badge st-${this._status(models, now)}">${svgIcon(ICONS.calendarClock)}</div>
          <div class="body">
            <div class="mhd"><span class="title">${esc(this._config.title || this._t("schedules"))}</span>${this._pill(this._status(models, now))}${head ? `<span class="st">${esc(head)}</span>` : ""}${this._zoomButton()}</div>
            <div class="nx">${rows}</div>
          </div>
        </div>
      </ha-card>`;
  }
}
