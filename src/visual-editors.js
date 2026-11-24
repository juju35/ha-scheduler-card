// ---------------------------------------------------------------------------
// Visual editors (ha-form)
// ---------------------------------------------------------------------------
import { lang, t } from "./helpers.js";
import { discover } from "./schedules.js";
import { SPECIAL_TAGS, listOf } from "./actions.js";

// Options on by default (left out of the YAML while on).
export const ON_BY_DEFAULT = ["illustration", "show_disabled", "editable", "show_badges", "zoom", "condition_status_animation"];
export const LANGUAGES = [
  ["en", "English"], ["fr", "Français"], ["de", "Deutsch"], ["es", "Español"], ["sr", "Српски"], ["sr-Latn", "Srpski (latinica)"],
  ["it", "Italiano"], ["nl", "Nederlands"], ["pt", "Português (Portugal)"], ["pl", "Polski"], ["ro", "Română"], ["da", "Dansk"],
  ["sv", "Svenska"], ["bg", "Български"], ["ru", "Русский"], ["uk", "Українська"], ["hu", "Magyar"], ["sk", "Slovenčina"],
  ["cs", "Čeština"], ["sl", "Slovenščina"], ["lv", "Latviešu"], ["el", "Ελληνικά"],
];

// The editor shows `entities` only as a list of entity ids (objects in YAML stay YAML-only).
export const editableEntities = (config = {}) => config.entities === undefined || (Array.isArray(config.entities) && config.entities.every((e) => typeof e === "string"));

// The tags carried by the schedules found, sorted, for the editor's tag lists.
export const knownTags = (hass) => {
  if (!hass?.states) return [];
  const tags = new Set();
  for (const id of discover(hass)) for (const x of listOf(hass.states[id]?.attributes?.tags)) if (typeof x === "string" && x) tags.add(x);
  return [...tags].sort();
};

export class SchedulerCardEditor extends HTMLElement {
  static get mini() {
    return false;
  }

  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _schema() {
    const tr = (k) => t(this._hass, this._config, k);
    const toggles = ["illustration", "show_disabled", "editable", "show_badges", "show_header_toggle", "show_condition_status", "condition_status_animation", "show_entities"];
    if (this.constructor.mini) toggles.push("zoom");
    const grid = [
      {
        name: "illustration_theme",
        selector: { select: { mode: "dropdown", options: ["auto", "day", "night"].map((v) => ({ value: v, label: tr(`theme_${v}`) })) } },
      },
    ];
    grid.push(
      { name: "sort_by", selector: { select: { mode: "dropdown", options: ["name", "next", "state"].map((v) => ({ value: v, label: tr(`sort_${v}`) })) } } },
      { name: "time_step", selector: { number: { min: 1, max: 60, step: 1, mode: "box", unit_of_measurement: "min" } } },
    );
    if (this.constructor.mini) grid.push({ name: "next_actions", selector: { number: { min: 1, max: 10, step: 1, mode: "box" } } });
    // The filters: the schedules (or the entities they act on) and the tags, as lists. Entities given as objects
    // in YAML stay YAML-only, so the editor never drops what it cannot show.
    const filters = [];
    if (editableEntities(this._config)) filters.push({ name: "entities", selector: { entity: { multiple: true } } });
    const tagOptions = [...new Set([...SPECIAL_TAGS, ...knownTags(this._hass), ...listOf(this._config.tags), ...listOf(this._config.exclude_tags)])];
    const tagSel = { select: { multiple: true, custom_value: true, mode: "dropdown", options: tagOptions } };
    filters.push({ name: "tags", selector: tagSel }, { name: "exclude_tags", selector: { select: { ...tagSel.select, options: tagOptions.filter((x) => !SPECIAL_TAGS.includes(x)) } } });
    return [
      { name: "title", selector: { text: {} } },
      { type: "grid", name: "", schema: grid },
      { type: "grid", name: "", schema: toggles.map((name) => ({ name, selector: { boolean: {} } })) },
      ...filters,
      {
        name: "language",
        selector: { select: { mode: "dropdown", options: [{ value: "", label: tr("lang_auto") }, ...LANGUAGES.map(([value, label]) => ({ value, label }))] } },
      },
    ];
  }

  _render() {
    if (!this._hass || !this._config) return;
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.computeLabel = (s) => t(this._hass, this._config, s.name);
      this._form.addEventListener("value-changed", (ev) => {
        ev.stopPropagation();
        const config = { ...ev.detail.value };
        for (const [k, v] of Object.entries(config)) {
          // A minimal YAML: no empty values, no options left at their default.
          if (
            v === "" ||
            (Array.isArray(v) && v.length === 0) ||
            v === undefined ||
            v === null ||
            (ON_BY_DEFAULT.includes(k) && v === true) ||
            ((k === "show_header_toggle" || k === "show_entities") && v === false) ||
            (k === "illustration_theme" && v === "auto") ||
            (k === "sort_by" && v === "name") ||
            (k === "time_step" && v === 15) ||
            (k === "next_actions" && v === 3)
          )
            delete config[k];
        }
        this._config = config;
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
      });
      this.appendChild(this._form);
    }
    const data = { illustration_theme: "auto", sort_by: "name", time_step: 15, ...(this.constructor.mini ? { next_actions: 3 } : {}), ...this._config };
    for (const k of ON_BY_DEFAULT) if (data[k] === undefined) data[k] = true;
    // A single tag written as a string in YAML shows as a one-item list.
    for (const k of ["tags", "exclude_tags"]) if (data[k] !== undefined) data[k] = listOf(data[k]);
    this._form.hass = this._hass;
    // hass is pushed on every state change while the editor is open: data and schema are set again only when they
    // changed, so that the form does not redraw each time.
    const dataKey = JSON.stringify(data);
    if (dataKey !== this._dataKey) {
      this._dataKey = dataKey;
      this._form.data = data;
    }
    const schemaKey = JSON.stringify([lang(this._hass, this._config), editableEntities(this._config), knownTags(this._hass), listOf(this._config.tags), listOf(this._config.exclude_tags)]);
    if (schemaKey !== this._schemaKey) {
      this._schemaKey = schemaKey;
      this._form.schema = this._schema();
    }
  }
}

export class SchedulerMiniCardEditor extends SchedulerCardEditor {
  static get mini() {
    return true;
  }
}
