// ── Card picker: light previews ──────────────────────────────────────────────
// Home Assistant's card picker builds a live preview of every card registered with `preview: true`, all at once and
// with no lazy loading. A preview here is drawn only once it scrolls into view: the picker calls getStubConfig() right
// before it creates the preview, which marks the next instance of that card; once connected under <hui-card-picker>,
// that instance holds Home Assistant's state (no render, no history, no animation) until it is visible. Anywhere else
// (a dashboard, the card editor) the card behaves as before. Editors and other elements are defined unchanged.
function pickerDefine(tag, Card, options) {
  const isCard = !tag.endsWith("-editor") && (typeof Card.getStubConfig === "function" || typeof Card.getConfigElement === "function");
  if (!isCard || typeof IntersectionObserver !== "function") return customElements.define(tag, Card, options);
  let marks = [];
  const lazy = class extends Card {
    static getStubConfig(...args) {
      marks.push(Date.now());
      return Card.getStubConfig ? Card.getStubConfig(...args) : {};
    }

    constructor() {
      super();
      const now = Date.now();
      marks = marks.filter((t) => now - t < 5000);
      if (marks.length) {
        marks.shift();
        this._plHold = true;
      }
    }

    set hass(hass) {
      if (this._plHold) this._plHass = hass;
      else super.hass = hass;
    }

    get hass() {
      return this._plHold ? this._plHass : super.hass;
    }

    connectedCallback() {
      if (!this._plHold) return super.connectedCallback?.();
      if (this.getRootNode()?.host?.localName !== "hui-card-picker") return this._plRelease();
      if (this._plIo) return;
      // A custom element is inline until its styles arrive: a block of a card's height keeps the cells apart, so
      // that only the previews actually on screen intersect.
      this.style.display = "block";
      this.style.minHeight = "120px";
      this._plIo = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && this._plRelease(), {
        rootMargin: "200px",
      });
      this._plIo.observe(this);
    }

    disconnectedCallback() {
      if (this._plHold) return;
      super.disconnectedCallback?.();
    }

    _plRelease() {
      this._plIo?.disconnect();
      this._plIo = null;
      this._plHold = false;
      this.style.display = "";
      this.style.minHeight = "";
      if (this._plHass !== undefined) super.hass = this._plHass;
      this._plHass = undefined;
      if (this.isConnected) super.connectedCallback?.();
    }
  };
  return customElements.define(tag, lazy, options);
}

/*
 * Scheduler Card for Home Assistant
 * https://github.com/juju35/ha-scheduler-card
 *
 * Today's timeline and the weekly grid of the schedules of the Scheduler component
 * (https://github.com/nielsfaber/scheduler-component): its `switch.schedule_*` entities, read from their
 * attributes (`weekdays`, `timeslots`, `actions`, `entities`, `current_slot`, `next_slot`, `next_trigger`, `tags`),
 * enabled and disabled with `switch.turn_on` / `switch.turn_off`, edited with the `scheduler.add`, `scheduler.edit`,
 * `scheduler.copy` and `scheduler.remove` services from the full schedules returned by the `scheduler` and
 * `scheduler/item` websocket commands (conditions, dates, repetition; read again on its `scheduler_updated`
 * subscription). Everything is drawn under an illustrated banner showing today's timeline and a "now" cursor.
 */

const VERSION = "__VERSION__";

// mdi icon paths drawn by the card itself (the schedules' own icons come from their entities, through <ha-icon>).
const ICONS = {
  // mdi:calendar-clock: the Scheduler component's icon, the header badge and a schedule without an icon of its own.
  calendarClock:
    "M15,13H16.5V15.82L18.94,17.23L18.19,18.53L15,16.69V13M19,8H5V19H9.67C9.24,18.09 9,17.07 9,16A7,7 0 0,1 16,9C17.07,9 18.09,9.24 19,9.67V8M5,21C3.89,21 3,20.1 3,19V5C3,3.89 3.89,3 5,3H6V1H8V3H16V1H18V3H19A2,2 0 0,1 21,5V11.1C22.24,12.36 23,14.09 23,16A7,7 0 0,1 16,23C14.09,23 12.36,22.24 11.1,21H5M16,11.15A4.85,4.85 0 0,0 11.15,16C11.15,18.68 13.32,20.85 16,20.85A4.85,4.85 0 0,0 20.85,16C20.85,13.32 18.68,11.15 16,11.15Z",
  // mdi:arrow-expand and mdi:arrow-collapse: the mini card's detail button.
  expand: "M10,21V19H6.41L10.91,14.5L9.5,13.09L5,17.59V14H3V21H10M14.5,10.91L19,6.41V10H21V3H14V5H17.59L13.09,9.5L14.5,10.91Z",
  collapse: "M19.5,3.09L15,7.59V4H13V11H20V9H16.41L20.91,4.5L19.5,3.09M4,13V15H7.59L3.09,19.5L4.5,20.91L9,16.41V20H11V13H4Z",
  // mdi:close, mdi:plus, mdi:arrow-left.
  close: "M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z",
  plus: "M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z",
  back: "M20,11V13H8L13.5,18.5L12.08,19.92L4.16,12L12.08,4.08L13.5,5.5L8,11H20Z",
};

const STRINGS = {
  en: {
    schedules: "Schedules",
    enabled_one: "{n} enabled",
    enabled_other: "{n} enabled",
    disabled_one: "{n} disabled",
    disabled_other: "{n} disabled",
    now_hint: "Red line = now",
    next_time: "Next {time}",
    new_schedule: "New schedule",
    state_disabled: "Disabled",
    state_enabled: "Enabled",
    state_completed: "Completed",
    value_now: "{value} now",
    until: "until {time}",
    action_at: "{action} at {time}",
    action_on_day: "{action} {day} at {time}",
    done_today: "Done today",
    next_lower: "next {time}",
    no_upcoming: "No upcoming action",
    week_total: "{value} {h} h / week",
    week_total_all: "{h} h / week",
    default_value: "{value} (default)",
    back: "Back to today's timeline",
    no_entities: "No schedules found. Is the Scheduler component installed?",
    no_match: "No schedule matches the card's filters.",
    act_on: "On",
    act_off: "Off",
    act_open: "Open",
    act_close: "Close",
    act_stop: "Stop",
    act_lock: "Lock",
    act_unlock: "Unlock",
    act_run: "Run",
    act_activate: "Activate",
    act_start: "Start",
    act_dock: "Return to dock",
    act_play: "Play",
    act_pause: "Pause",
    act_toggle: "Toggle",
    act_temperature: "Temperature",
    act_position: "Position",
    act_value: "Value",
    edit_slot: "Edit slot",
    add_slot: "Add slot",
    start: "Start",
    end: "End",
    end_hint: "Leave empty for a single action",
    action: "Action",
    days: "Days",
    days_note: "The days apply to the whole schedule.",
    name: "Name",
    entity: "Entity",
    save: "Save",
    cancel: "Cancel",
    close: "Close",
    delete_slot: "Delete slot",
    delete_schedule: "Delete schedule",
    confirm_delete: "Delete it?",
    loading: "Loading…",
    err_overlap: "This slot overlaps another one.",
    err_same: "The end must differ from the start.",
    err_time: "Enter a start time.",
    err_entity: "Choose an entity.",
    err_action: "Choose an action.",
    err_days: "Choose at least one day.",
    err_load: "The schedule could not be loaded.",
    err_save: "Could not save: {error}",
    zoom_in: "Show the full card",
    zoom_out: "Back to the compact view",
    status_active: "Running",
    status_idle: "Idle",
    status_warn: "No schedule",
    title: "Title",
    illustration: "Illustration",
    illustration_theme: "Illustration theme",
    theme_auto: "Automatic (follows the theme)",
    theme_day: "Day",
    theme_night: "Night",
    show_disabled: "Disabled schedules",
    editable: "Slot editing",
    show_header_toggle: "Switch for all schedules",
    all_on: "Enable all",
    all_off: "Disable all",
    err_toggle: "{count} of {total} schedules could not be changed",
    next_actions: "Upcoming actions",
    zoom: "Detail button",
    language: "Language",
    lang_auto: "Automatic",
    starts_on: "Starts {date}",
    period_range: "{from} → {to}",
    period_until: "Until {date}",
    period_from: "From {date}",
    schedule_options: "Options",
    tab_slot: "Slot",
    tab_schedule: "Schedule",
    tab_options: "Options",
    mode_time: "Time",
    at_time: "At",
    sunrise: "Sunrise",
    sunset: "Sunset",
    before: "Before",
    after: "After",
    offset: "Offset",
    approx_today: "≈ {time} today",
    days_daily: "Every day",
    days_workday: "Workdays",
    days_weekend: "Weekend",
    days_custom: "Custom",
    days_workday_note: "Workdays follow the Workday sensor: holidays are skipped.",
    remove: "Remove",
    tags: "Tags",
    add_tag: "Add a tag",
    conditions: "Conditions",
    cond_all: "All",
    cond_any: "Any",
    add_condition: "Add condition",
    cond_pick: "Choose a value…",
    cond_other: "Other value…",
    match_is: "is",
    match_not: "is not",
    match_below: "below",
    match_above: "above",
    cond_is: "{entity} is {value}",
    cond_not: "{entity} is not {value}",
    cond_below: "{entity} below {value}",
    cond_above: "{entity} above {value}",
    track_conditions: "Run the action as soon as they pass",
    period: "Period",
    period_hint: "Only between two dates",
    date_from: "From",
    date_to: "To",
    after_last: "After the last slot",
    repeat_repeat: "Repeat",
    repeat_stop: "Stop",
    repeat_delete: "Delete",
    repeat_hint: "Stop disables the schedule, Delete removes it, once its last slot has run.",
    repeat_pause_badge: "Once · then stop",
    repeat_single_badge: "Once · then delete",
    duplicate: "Duplicate",
    copy_name: "{name} (copy)",
    split: "Split",
    merge_next: "Merge with next",
    kind: "Kind",
    kind_slots: "Time slots",
    kind_single: "Single time",
    kind_slots_hint: "A start and an end: the action holds over the slot.",
    kind_single_hint: "One action at a set time, e.g. turn off at 23:00.",
    entities: "Entities",
    add_entity: "Add an entity of the same kind",
    change_entities: "Change",
    entities_note: "They apply to the whole schedule, like the days.",
    show_entities: "Entities on the tiles",
    err_condition: "Complete or remove each condition.",
    err_dates: "The end date must come after the start date.",
    show_badges: "Badges",
    show_condition_status: "Condition status",
    condition_status_animation: "Pulse when conditions are met",
    cstat_met: "Conditions met",
    cstat_wait: "Waiting for its conditions",
    cstat_skip: "Skipped: conditions not met",
    cstat_unavailable: "unavailable",
    sort_by: "Sort",
    sort_name: "Name",
    sort_next: "Next action",
    sort_state: "Running first",
    time_step: "Time step",
    exclude_tags: "Hidden tags",
  },
  fr: {
    schedules: "Plannings",
    enabled_one: "{n} activé",
    enabled_other: "{n} activés",
    disabled_one: "{n} désactivé",
    disabled_other: "{n} désactivés",
    now_hint: "Trait rouge = maintenant",
    next_time: "Prochain {time}",
    new_schedule: "Nouveau planning",
    state_disabled: "Désactivé",
    state_enabled: "Activé",
    state_completed: "Terminé",
    value_now: "{value} en cours",
    until: "jusqu'à {time}",
    action_at: "{action} à {time}",
    action_on_day: "{action} {day} à {time}",
    done_today: "Fait aujourd'hui",
    next_lower: "prochain {time}",
    no_upcoming: "Aucune action à venir",
    week_total: "{value} {h} h / semaine",
    week_total_all: "{h} h / semaine",
    default_value: "{value} (par défaut)",
    back: "Retour à la frise du jour",
    no_entities: "Aucun planning trouvé. Le composant Scheduler est-il installé ?",
    no_match: "Aucun planning ne correspond aux filtres de la carte.",
    act_on: "Allumer",
    act_off: "Éteindre",
    act_open: "Ouvrir",
    act_close: "Fermer",
    act_stop: "Arrêter",
    act_lock: "Verrouiller",
    act_unlock: "Déverrouiller",
    act_run: "Lancer",
    act_activate: "Activer",
    act_start: "Démarrer",
    act_dock: "Retour à la base",
    act_play: "Lecture",
    act_pause: "Pause",
    act_toggle: "Basculer",
    act_temperature: "Température",
    act_position: "Position",
    act_value: "Valeur",
    edit_slot: "Modifier la plage",
    add_slot: "Ajouter une plage",
    start: "Début",
    end: "Fin",
    end_hint: "Laisser vide pour une action ponctuelle",
    action: "Action",
    days: "Jours",
    days_note: "Les jours s'appliquent à tout le planning.",
    name: "Nom",
    entity: "Entité",
    save: "Enregistrer",
    cancel: "Annuler",
    close: "Fermer",
    delete_slot: "Supprimer la plage",
    delete_schedule: "Supprimer le planning",
    confirm_delete: "Supprimer ?",
    loading: "Chargement…",
    err_overlap: "Cette plage chevauche une autre plage.",
    err_same: "La fin doit être différente du début.",
    err_time: "Saisissez une heure de début.",
    err_entity: "Choisissez une entité.",
    err_action: "Choisissez une action.",
    err_days: "Choisissez au moins un jour.",
    err_load: "Le planning n'a pas pu être chargé.",
    err_save: "Enregistrement impossible : {error}",
    zoom_in: "Afficher la carte complète",
    zoom_out: "Revenir à la vue compacte",
    status_active: "En cours",
    status_idle: "Au repos",
    status_warn: "Aucune planification",
    title: "Titre",
    illustration: "Illustration",
    illustration_theme: "Thème de l'illustration",
    theme_auto: "Automatique (suit le thème)",
    theme_day: "Jour",
    theme_night: "Nuit",
    show_disabled: "Plannings désactivés",
    editable: "Modification des plages",
    show_header_toggle: "Interrupteur de tous les plannings",
    all_on: "Tout activer",
    all_off: "Tout désactiver",
    err_toggle: "Modification impossible pour {count} plannings sur {total}",
    next_actions: "Actions à venir",
    zoom: "Bouton détail",
    language: "Langue",
    lang_auto: "Automatique",
    starts_on: "Commence le {date}",
    period_range: "{from} → {to}",
    period_until: "Jusqu’au {date}",
    period_from: "À partir du {date}",
    schedule_options: "Options",
    tab_slot: "Créneau",
    tab_schedule: "Planning",
    tab_options: "Options",
    mode_time: "Heure",
    at_time: "À",
    sunrise: "Lever du soleil",
    sunset: "Coucher du soleil",
    before: "Avant",
    after: "Après",
    offset: "Décalage",
    approx_today: "≈ {time} aujourd’hui",
    days_daily: "Tous les jours",
    days_workday: "Jours ouvrés",
    days_weekend: "Week-end",
    days_custom: "Personnalisé",
    days_workday_note: "Les jours ouvrés suivent le capteur Workday : les jours fériés sont sautés.",
    remove: "Retirer",
    tags: "Tags",
    add_tag: "Ajouter un tag",
    conditions: "Conditions",
    cond_all: "Toutes",
    cond_any: "Au moins une",
    add_condition: "Ajouter une condition",
    cond_pick: "Choisir une valeur…",
    cond_other: "Autre valeur…",
    match_is: "est",
    match_not: "n’est pas",
    match_below: "inférieur à",
    match_above: "supérieur à",
    cond_is: "{entity} est {value}",
    cond_not: "{entity} n’est pas {value}",
    cond_below: "{entity} inférieur à {value}",
    cond_above: "{entity} supérieur à {value}",
    track_conditions: "Exécuter l’action dès qu’elles sont remplies",
    period: "Période",
    period_hint: "Seulement entre deux dates",
    date_from: "Du",
    date_to: "Au",
    after_last: "Après le dernier créneau",
    repeat_repeat: "Répéter",
    repeat_stop: "Arrêter",
    repeat_delete: "Supprimer",
    repeat_hint: "Arrêter désactive le planning, Supprimer l’efface, une fois son dernier créneau passé.",
    repeat_pause_badge: "Une fois · puis arrêt",
    repeat_single_badge: "Une fois · puis suppression",
    duplicate: "Dupliquer",
    copy_name: "{name} (copie)",
    split: "Scinder",
    merge_next: "Fusionner avec le suivant",
    kind: "Type",
    kind_slots: "Créneaux",
    kind_single: "Heure unique",
    kind_slots_hint: "Un début et une fin : l’action vaut pendant le créneau.",
    kind_single_hint: "Une action à une heure donnée, par ex. éteindre à 23:00.",
    entities: "Entités",
    add_entity: "Ajouter une entité du même type",
    change_entities: "Modifier",
    entities_note: "Elles s'appliquent à tout le planning, comme les jours.",
    show_entities: "Entités sur les tuiles",
    err_condition: "Complétez ou retirez chaque condition.",
    err_dates: "La date de fin doit suivre la date de début.",
    show_badges: "Pastilles",
    show_condition_status: "État des conditions",
    condition_status_animation: "Pulsation quand les conditions sont remplies",
    cstat_met: "Conditions remplies",
    cstat_wait: "En attente de ses conditions",
    cstat_skip: "Sauté : conditions non remplies",
    cstat_unavailable: "indisponible",
    sort_by: "Tri",
    sort_name: "Nom",
    sort_next: "Prochaine action",
    sort_state: "En cours d’abord",
    time_step: "Pas de temps",
    exclude_tags: "Tags masqués",
  },
  de: {
    schedules: "Zeitpläne",
    enabled_one: "{n} aktiv",
    enabled_other: "{n} aktiv",
    disabled_one: "{n} deaktiviert",
    disabled_other: "{n} deaktiviert",
    now_hint: "Rote Linie = jetzt",
    next_time: "Nächste {time}",
    new_schedule: "Neuer Zeitplan",
    state_disabled: "Deaktiviert",
    state_enabled: "Aktiviert",
    state_completed: "Abgeschlossen",
    value_now: "{value} jetzt",
    until: "bis {time}",
    action_at: "{action} um {time}",
    action_on_day: "{action} {day} um {time}",
    done_today: "Heute erledigt",
    next_lower: "nächste {time}",
    no_upcoming: "Keine anstehende Aktion",
    week_total: "{value} {h} Std. / Woche",
    week_total_all: "{h} Std. / Woche",
    default_value: "{value} (Standard)",
    back: "Zurück zur Tagesübersicht",
    no_entities: "Keine Zeitpläne gefunden. Ist die Scheduler-Komponente installiert?",
    no_match: "Kein Zeitplan entspricht den Filtern der Karte.",
    act_on: "Ein",
    act_off: "Aus",
    act_open: "Öffnen",
    act_close: "Schließen",
    act_stop: "Stopp",
    act_lock: "Verriegeln",
    act_unlock: "Entriegeln",
    act_run: "Ausführen",
    act_activate: "Aktivieren",
    act_start: "Starten",
    act_dock: "Zur Station",
    act_play: "Wiedergabe",
    act_pause: "Pause",
    act_toggle: "Umschalten",
    act_temperature: "Temperatur",
    act_position: "Position",
    act_value: "Wert",
    edit_slot: "Zeitfenster bearbeiten",
    add_slot: "Zeitfenster hinzufügen",
    start: "Beginn",
    end: "Ende",
    end_hint: "Leer lassen für eine einmalige Aktion",
    action: "Aktion",
    days: "Tage",
    days_note: "Die Tage gelten für den ganzen Zeitplan.",
    name: "Name",
    entity: "Entität",
    save: "Speichern",
    cancel: "Abbrechen",
    close: "Schließen",
    delete_slot: "Zeitfenster löschen",
    delete_schedule: "Zeitplan löschen",
    confirm_delete: "Wirklich löschen?",
    loading: "Wird geladen…",
    err_overlap: "Dieses Zeitfenster überschneidet sich mit einem anderen.",
    err_same: "Das Ende muss sich vom Beginn unterscheiden.",
    err_time: "Gib eine Startzeit ein.",
    err_entity: "Wähle eine Entität.",
    err_action: "Wähle eine Aktion.",
    err_days: "Wähle mindestens einen Tag.",
    err_load: "Der Zeitplan konnte nicht geladen werden.",
    err_save: "Speichern fehlgeschlagen: {error}",
    zoom_in: "Vollständige Karte anzeigen",
    zoom_out: "Zurück zur kompakten Ansicht",
    status_active: "Läuft",
    status_idle: "Inaktiv",
    status_warn: "Kein Zeitplan",
    title: "Titel",
    illustration: "Illustration",
    illustration_theme: "Thema der Illustration",
    theme_auto: "Automatisch (folgt dem Design)",
    theme_day: "Tag",
    theme_night: "Nacht",
    show_disabled: "Deaktivierte Zeitpläne",
    editable: "Zeitfenster bearbeiten",
    show_header_toggle: "Schalter für alle Zeitpläne",
    all_on: "Alle aktivieren",
    all_off: "Alle deaktivieren",
    err_toggle: "{count} von {total} Zeitplänen konnten nicht geändert werden",
    next_actions: "Anstehende Aktionen",
    zoom: "Detail-Schaltfläche",
    language: "Sprache",
    lang_auto: "Automatisch",
    starts_on: "Beginnt am {date}",
    period_range: "{from} → {to}",
    period_until: "Bis {date}",
    period_from: "Ab {date}",
    schedule_options: "Optionen",
    tab_slot: "Zeitfenster",
    tab_schedule: "Zeitplan",
    tab_options: "Optionen",
    mode_time: "Uhrzeit",
    at_time: "Um",
    sunrise: "Sonnenaufgang",
    sunset: "Sonnenuntergang",
    before: "Vor",
    after: "Nach",
    offset: "Versatz",
    approx_today: "≈ {time} heute",
    days_daily: "Jeden Tag",
    days_workday: "Werktage",
    days_weekend: "Wochenende",
    days_custom: "Benutzerdefiniert",
    days_workday_note: "Werktage folgen dem Workday-Sensor: Feiertage werden übersprungen.",
    remove: "Entfernen",
    tags: "Tags",
    add_tag: "Tag hinzufügen",
    conditions: "Bedingungen",
    cond_all: "Alle",
    cond_any: "Mindestens eine",
    add_condition: "Bedingung hinzufügen",
    cond_pick: "Wert wählen…",
    cond_other: "Anderer Wert…",
    match_is: "ist",
    match_not: "ist nicht",
    match_below: "unter",
    match_above: "über",
    cond_is: "{entity} ist {value}",
    cond_not: "{entity} ist nicht {value}",
    cond_below: "{entity} unter {value}",
    cond_above: "{entity} über {value}",
    track_conditions: "Aktion ausführen, sobald sie erfüllt sind",
    period: "Zeitraum",
    period_hint: "Nur zwischen zwei Daten",
    date_from: "Von",
    date_to: "Bis",
    after_last: "Nach dem letzten Zeitfenster",
    repeat_repeat: "Wiederholen",
    repeat_stop: "Stoppen",
    repeat_delete: "Löschen",
    repeat_hint: "Stoppen deaktiviert den Zeitplan, Löschen entfernt ihn, sobald sein letztes Zeitfenster vorbei ist.",
    repeat_pause_badge: "Einmalig · dann Stopp",
    repeat_single_badge: "Einmalig · dann Löschen",
    duplicate: "Duplizieren",
    copy_name: "{name} (Kopie)",
    split: "Teilen",
    merge_next: "Mit nächstem zusammenführen",
    kind: "Art",
    kind_slots: "Zeitfenster",
    kind_single: "Einzelne Uhrzeit",
    kind_slots_hint: "Ein Beginn und ein Ende: die Aktion gilt im Zeitfenster.",
    kind_single_hint: "Eine Aktion zu einer festen Uhrzeit, z. B. um 23:00 ausschalten.",
    entities: "Entitäten",
    add_entity: "Entität derselben Art hinzufügen",
    change_entities: "Ändern",
    entities_note: "Sie gelten für den ganzen Zeitplan, wie die Tage.",
    show_entities: "Entitäten auf den Kacheln",
    err_condition: "Jede Bedingung ausfüllen oder entfernen.",
    err_dates: "Das Enddatum muss nach dem Startdatum liegen.",
    show_badges: "Plaketten",
    show_condition_status: "Bedingungsstatus",
    condition_status_animation: "Pulsieren, wenn die Bedingungen erfüllt sind",
    cstat_met: "Bedingungen erfüllt",
    cstat_wait: "Wartet auf seine Bedingungen",
    cstat_skip: "Übersprungen: Bedingungen nicht erfüllt",
    cstat_unavailable: "nicht verfügbar",
    sort_by: "Sortierung",
    sort_name: "Name",
    sort_next: "Nächste Aktion",
    sort_state: "Laufende zuerst",
    time_step: "Zeitschritt",
    exclude_tags: "Ausgeblendete Tags",
  },
  es: {
    schedules: "Programaciones",
    enabled_one: "{n} activada",
    enabled_other: "{n} activadas",
    disabled_one: "{n} desactivada",
    disabled_other: "{n} desactivadas",
    now_hint: "Línea roja = ahora",
    next_time: "Próxima {time}",
    new_schedule: "Nueva programación",
    state_disabled: "Desactivada",
    state_enabled: "Activada",
    state_completed: "Completada",
    value_now: "{value} ahora",
    until: "hasta las {time}",
    action_at: "{action} a las {time}",
    action_on_day: "{action} el {day} a las {time}",
    done_today: "Hecho hoy",
    next_lower: "próxima {time}",
    no_upcoming: "Ninguna acción próxima",
    week_total: "{value} {h} h / semana",
    week_total_all: "{h} h / semana",
    default_value: "{value} (predeterminado)",
    back: "Volver a la línea de tiempo de hoy",
    no_entities: "No se han encontrado programaciones. ¿Está instalado el componente Scheduler?",
    no_match: "Ninguna programación coincide con los filtros de la tarjeta.",
    act_on: "Encender",
    act_off: "Apagar",
    act_open: "Abrir",
    act_close: "Cerrar",
    act_stop: "Detener",
    act_lock: "Bloquear",
    act_unlock: "Desbloquear",
    act_run: "Ejecutar",
    act_activate: "Activar",
    act_start: "Iniciar",
    act_dock: "Volver a la base",
    act_play: "Reproducir",
    act_pause: "Pausa",
    act_toggle: "Alternar",
    act_temperature: "Temperatura",
    act_position: "Posición",
    act_value: "Valor",
    edit_slot: "Editar franja",
    add_slot: "Añadir franja",
    start: "Inicio",
    end: "Fin",
    end_hint: "Dejar vacío para una acción puntual",
    action: "Acción",
    days: "Días",
    days_note: "Los días se aplican a toda la programación.",
    name: "Nombre",
    entity: "Entidad",
    save: "Guardar",
    cancel: "Cancelar",
    close: "Cerrar",
    delete_slot: "Eliminar franja",
    delete_schedule: "Eliminar programación",
    confirm_delete: "¿Eliminar?",
    loading: "Cargando…",
    err_overlap: "Esta franja se solapa con otra.",
    err_same: "El fin debe ser distinto del inicio.",
    err_time: "Introduce una hora de inicio.",
    err_entity: "Elige una entidad.",
    err_action: "Elige una acción.",
    err_days: "Elige al menos un día.",
    err_load: "No se ha podido cargar la programación.",
    err_save: "No se ha podido guardar: {error}",
    zoom_in: "Mostrar la tarjeta completa",
    zoom_out: "Volver a la vista compacta",
    status_active: "En curso",
    status_idle: "En reposo",
    status_warn: "Sin programación",
    title: "Título",
    illustration: "Ilustración",
    illustration_theme: "Tema de la ilustración",
    theme_auto: "Automático (sigue el tema)",
    theme_day: "Día",
    theme_night: "Noche",
    show_disabled: "Programaciones desactivadas",
    editable: "Edición de franjas",
    show_header_toggle: "Interruptor de todas las programaciones",
    all_on: "Activar todas",
    all_off: "Desactivar todas",
    err_toggle: "No se pudieron cambiar {count} de {total} programaciones",
    next_actions: "Próximas acciones",
    zoom: "Botón de detalle",
    language: "Idioma",
    lang_auto: "Automático",
    starts_on: "Empieza el {date}",
    period_range: "{from} → {to}",
    period_until: "Hasta el {date}",
    period_from: "Desde el {date}",
    schedule_options: "Opciones",
    tab_slot: "Franja",
    tab_schedule: "Programa",
    tab_options: "Opciones",
    mode_time: "Hora",
    at_time: "A las",
    sunrise: "Amanecer",
    sunset: "Atardecer",
    before: "Antes",
    after: "Después",
    offset: "Desfase",
    approx_today: "≈ {time} hoy",
    days_daily: "Todos los días",
    days_workday: "Laborables",
    days_weekend: "Fin de semana",
    days_custom: "Personalizado",
    days_workday_note: "Los laborables siguen el sensor Workday: los festivos se omiten.",
    remove: "Quitar",
    tags: "Etiquetas",
    add_tag: "Añadir una etiqueta",
    conditions: "Condiciones",
    cond_all: "Todas",
    cond_any: "Alguna",
    add_condition: "Añadir condición",
    cond_pick: "Elegir un valor…",
    cond_other: "Otro valor…",
    match_is: "es",
    match_not: "no es",
    match_below: "por debajo de",
    match_above: "por encima de",
    cond_is: "{entity} es {value}",
    cond_not: "{entity} no es {value}",
    cond_below: "{entity} por debajo de {value}",
    cond_above: "{entity} por encima de {value}",
    track_conditions: "Ejecutar la acción en cuanto se cumplan",
    period: "Periodo",
    period_hint: "Solo entre dos fechas",
    date_from: "Desde",
    date_to: "Hasta",
    after_last: "Tras la última franja",
    repeat_repeat: "Repetir",
    repeat_stop: "Detener",
    repeat_delete: "Eliminar",
    repeat_hint: "Detener desactiva el programa, Eliminar lo borra, una vez pasada su última franja.",
    repeat_pause_badge: "Una vez · luego se detiene",
    repeat_single_badge: "Una vez · luego se elimina",
    duplicate: "Duplicar",
    copy_name: "{name} (copia)",
    split: "Dividir",
    merge_next: "Unir con la siguiente",
    kind: "Tipo",
    kind_slots: "Franjas horarias",
    kind_single: "Hora única",
    kind_slots_hint: "Un inicio y un fin: la acción dura toda la franja.",
    kind_single_hint: "Una acción a una hora fija, p. ej. apagar a las 23:00.",
    entities: "Entidades",
    add_entity: "Añadir una entidad del mismo tipo",
    change_entities: "Cambiar",
    entities_note: "Se aplican a toda la programación, como los días.",
    show_entities: "Entidades en los mosaicos",
    err_condition: "Completa o quita cada condición.",
    err_dates: "La fecha de fin debe ser posterior a la de inicio.",
    show_badges: "Insignias",
    show_condition_status: "Estado de las condiciones",
    condition_status_animation: "Latido cuando se cumplen las condiciones",
    cstat_met: "Condiciones cumplidas",
    cstat_wait: "Esperando sus condiciones",
    cstat_skip: "Omitido: condiciones no cumplidas",
    cstat_unavailable: "no disponible",
    sort_by: "Orden",
    sort_name: "Nombre",
    sort_next: "Próxima acción",
    sort_state: "En curso primero",
    time_step: "Paso de tiempo",
    exclude_tags: "Etiquetas ocultas",
  },
  sr: {
    schedules: "Распореди",
    enabled_one: "{n} укључен",
    enabled_few: "{n} укључена",
    enabled_other: "{n} укључених",
    disabled_one: "{n} искључен",
    disabled_few: "{n} искључена",
    disabled_other: "{n} искључених",
    now_hint: "Црвена линија = сада",
    next_time: "Следеће {time}",
    new_schedule: "Нови распоред",
    state_disabled: "Искључен",
    state_enabled: "Укључен",
    state_completed: "Завршен",
    value_now: "{value} сада",
    until: "до {time}",
    action_at: "{action} у {time}",
    action_on_day: "{action} {day} у {time}",
    done_today: "Завршено данас",
    next_lower: "следеће {time}",
    no_upcoming: "Нема предстојећих радњи",
    week_total: "{value} {h} ч / недељно",
    week_total_all: "{h} ч / недељно",
    default_value: "{value} (подразумевано)",
    back: "Назад на данашњи преглед",
    no_entities: "Нису пронађени распореди. Да ли је компонента Scheduler инсталирана?",
    no_match: "Ниједан распоред не одговара филтерима картице.",
    act_on: "Укључи",
    act_off: "Искључи",
    act_open: "Отвори",
    act_close: "Затвори",
    act_stop: "Заустави",
    act_lock: "Закључај",
    act_unlock: "Откључај",
    act_run: "Покрени",
    act_activate: "Активирај",
    act_start: "Започни",
    act_dock: "Назад на базу",
    act_play: "Пусти",
    act_pause: "Пауза",
    act_toggle: "Промени",
    act_temperature: "Температура",
    act_position: "Положај",
    act_value: "Вредност",
    edit_slot: "Измени термин",
    add_slot: "Додај термин",
    start: "Почетак",
    end: "Крај",
    end_hint: "Оставите празно за једнократну радњу",
    action: "Радња",
    days: "Дани",
    days_note: "Дани важе за цео распоред.",
    name: "Назив",
    entity: "Ентитет",
    save: "Сачувај",
    cancel: "Откажи",
    close: "Затвори",
    delete_slot: "Обриши термин",
    delete_schedule: "Обриши распоред",
    confirm_delete: "Обрисати?",
    loading: "Учитавање…",
    err_overlap: "Овај термин се преклапа са другим.",
    err_same: "Крај мора да се разликује од почетка.",
    err_time: "Унесите време почетка.",
    err_entity: "Изаберите ентитет.",
    err_action: "Изаберите радњу.",
    err_days: "Изаберите бар један дан.",
    err_load: "Распоред није могао да се учита.",
    err_save: "Чување није успело: {error}",
    zoom_in: "Прикажи целу картицу",
    zoom_out: "Назад на компактни приказ",
    status_active: "У току",
    status_idle: "Мирује",
    status_warn: "Нема распореда",
    title: "Наслов",
    illustration: "Илустрација",
    illustration_theme: "Тема илустрације",
    theme_auto: "Аутоматски (прати тему)",
    theme_day: "Дан",
    theme_night: "Ноћ",
    show_disabled: "Искључени распореди",
    editable: "Измена термина",
    show_header_toggle: "Прекидач за све распореде",
    all_on: "Укључи све",
    all_off: "Искључи све",
    err_toggle: "Није могуће променити {count} од {total} распореда",
    next_actions: "Предстојеће радње",
    zoom: "Дугме за детаље",
    language: "Језик",
    lang_auto: "Аутоматски",
    starts_on: "Почиње {date}",
    period_range: "{from} → {to}",
    period_until: "До {date}",
    period_from: "Од {date}",
    schedule_options: "Опције",
    tab_slot: "Термин",
    tab_schedule: "Распоред",
    tab_options: "Опције",
    mode_time: "Време",
    at_time: "У",
    sunrise: "Излазак сунца",
    sunset: "Залазак сунца",
    before: "Пре",
    after: "После",
    offset: "Померај",
    approx_today: "≈ {time} данас",
    days_daily: "Сваког дана",
    days_workday: "Радни дани",
    days_weekend: "Викенд",
    days_custom: "Прилагођено",
    days_workday_note: "Радни дани прате Workday сензор: празници се прескачу.",
    remove: "Уклони",
    tags: "Ознаке",
    add_tag: "Додај ознаку",
    conditions: "Услови",
    cond_all: "Сви",
    cond_any: "Бар један",
    add_condition: "Додај услов",
    cond_pick: "Изаберите вредност…",
    cond_other: "Друга вредност…",
    match_is: "је",
    match_not: "није",
    match_below: "испод",
    match_above: "изнад",
    cond_is: "{entity} је {value}",
    cond_not: "{entity} није {value}",
    cond_below: "{entity} испод {value}",
    cond_above: "{entity} изнад {value}",
    track_conditions: "Изврши радњу чим су испуњени",
    period: "Период",
    period_hint: "Само између два датума",
    date_from: "Од",
    date_to: "До",
    after_last: "После последњег термина",
    repeat_repeat: "Понављај",
    repeat_stop: "Заустави",
    repeat_delete: "Обриши",
    repeat_hint: "Заустави искључује распоред, Обриши га брише, након последњег термина.",
    repeat_pause_badge: "Једном · па стоп",
    repeat_single_badge: "Једном · па брисање",
    duplicate: "Дуплирај",
    copy_name: "{name} (копија)",
    split: "Подели",
    merge_next: "Спој са следећим",
    kind: "Врста",
    kind_slots: "Термини",
    kind_single: "Једно време",
    kind_slots_hint: "Почетак и крај: радња траје током термина.",
    kind_single_hint: "Једна радња у задато време, нпр. искључи у 23:00.",
    entities: "Ентитети",
    add_entity: "Додај ентитет исте врсте",
    change_entities: "Измени",
    entities_note: "Важе за цео распоред, као и дани.",
    show_entities: "Ентитети на плочицама",
    err_condition: "Попуните или уклоните сваки услов.",
    err_dates: "Датум краја мора бити после датума почетка.",
    show_badges: "Значке",
    show_condition_status: "Стање услова",
    condition_status_animation: "Пулсирање када су услови испуњени",
    cstat_met: "Услови испуњени",
    cstat_wait: "Чека своје услове",
    cstat_skip: "Прескочено: услови нису испуњени",
    cstat_unavailable: "недоступно",
    sort_by: "Редослед",
    sort_name: "Назив",
    sort_next: "Следећа радња",
    sort_state: "Активни прво",
    time_step: "Корак времена",
    exclude_tags: "Скривене ознаке",
  },
  "sr-Latn": {
    schedules: "Rasporedi",
    enabled_one: "{n} uključen",
    enabled_few: "{n} uključena",
    enabled_other: "{n} uključenih",
    disabled_one: "{n} isključen",
    disabled_few: "{n} isključena",
    disabled_other: "{n} isključenih",
    now_hint: "Crvena linija = sada",
    next_time: "Sledeće {time}",
    new_schedule: "Novi raspored",
    state_disabled: "Isključen",
    state_enabled: "Uključen",
    state_completed: "Završen",
    value_now: "{value} sada",
    until: "do {time}",
    action_at: "{action} u {time}",
    action_on_day: "{action} {day} u {time}",
    done_today: "Završeno danas",
    next_lower: "sledeće {time}",
    no_upcoming: "Nema predstojećih radnji",
    week_total: "{value} {h} č / nedeljno",
    week_total_all: "{h} č / nedeljno",
    default_value: "{value} (podrazumevano)",
    back: "Nazad na današnji pregled",
    no_entities: "Nisu pronađeni rasporedi. Da li je komponenta Scheduler instalirana?",
    no_match: "Nijedan raspored ne odgovara filterima kartice.",
    act_on: "Uključi",
    act_off: "Isključi",
    act_open: "Otvori",
    act_close: "Zatvori",
    act_stop: "Zaustavi",
    act_lock: "Zaključaj",
    act_unlock: "Otključaj",
    act_run: "Pokreni",
    act_activate: "Aktiviraj",
    act_start: "Započni",
    act_dock: "Nazad na bazu",
    act_play: "Pusti",
    act_pause: "Pauza",
    act_toggle: "Promeni",
    act_temperature: "Temperatura",
    act_position: "Položaj",
    act_value: "Vrednost",
    edit_slot: "Izmeni termin",
    add_slot: "Dodaj termin",
    start: "Početak",
    end: "Kraj",
    end_hint: "Ostavite prazno za jednokratnu radnju",
    action: "Radnja",
    days: "Dani",
    days_note: "Dani važe za ceo raspored.",
    name: "Naziv",
    entity: "Entitet",
    save: "Sačuvaj",
    cancel: "Otkaži",
    close: "Zatvori",
    delete_slot: "Obriši termin",
    delete_schedule: "Obriši raspored",
    confirm_delete: "Obrisati?",
    loading: "Učitavanje…",
    err_overlap: "Ovaj termin se preklapa sa drugim.",
    err_same: "Kraj mora da se razlikuje od početka.",
    err_time: "Unesite vreme početka.",
    err_entity: "Izaberite entitet.",
    err_action: "Izaberite radnju.",
    err_days: "Izaberite bar jedan dan.",
    err_load: "Raspored nije mogao da se učita.",
    err_save: "Čuvanje nije uspelo: {error}",
    zoom_in: "Prikaži celu karticu",
    zoom_out: "Nazad na kompaktni prikaz",
    status_active: "U toku",
    status_idle: "Miruje",
    status_warn: "Nema rasporeda",
    title: "Naslov",
    illustration: "Ilustracija",
    illustration_theme: "Tema ilustracije",
    theme_auto: "Automatski (prati temu)",
    theme_day: "Dan",
    theme_night: "Noć",
    show_disabled: "Isključeni rasporedi",
    editable: "Izmena termina",
    show_header_toggle: "Prekidač za sve rasporede",
    all_on: "Uključi sve",
    all_off: "Isključi sve",
    err_toggle: "Nije moguće promeniti {count} od {total} rasporeda",
    next_actions: "Predstojeće radnje",
    zoom: "Dugme za detalje",
    language: "Jezik",
    lang_auto: "Automatski",
    starts_on: "Počinje {date}",
    period_range: "{from} → {to}",
    period_until: "Do {date}",
    period_from: "Od {date}",
    schedule_options: "Opcije",
    tab_slot: "Termin",
    tab_schedule: "Raspored",
    tab_options: "Opcije",
    mode_time: "Vreme",
    at_time: "U",
    sunrise: "Izlazak sunca",
    sunset: "Zalazak sunca",
    before: "Pre",
    after: "Posle",
    offset: "Pomeraj",
    approx_today: "≈ {time} danas",
    days_daily: "Svakog dana",
    days_workday: "Radni dani",
    days_weekend: "Vikend",
    days_custom: "Prilagođeno",
    days_workday_note: "Radni dani prate Workday senzor: praznici se preskaču.",
    remove: "Ukloni",
    tags: "Oznake",
    add_tag: "Dodaj oznaku",
    conditions: "Uslovi",
    cond_all: "Svi",
    cond_any: "Bar jedan",
    add_condition: "Dodaj uslov",
    cond_pick: "Izaberite vrednost…",
    cond_other: "Druga vrednost…",
    match_is: "je",
    match_not: "nije",
    match_below: "ispod",
    match_above: "iznad",
    cond_is: "{entity} je {value}",
    cond_not: "{entity} nije {value}",
    cond_below: "{entity} ispod {value}",
    cond_above: "{entity} iznad {value}",
    track_conditions: "Izvrši radnju čim su ispunjeni",
    period: "Period",
    period_hint: "Samo između dva datuma",
    date_from: "Od",
    date_to: "Do",
    after_last: "Posle poslednjeg termina",
    repeat_repeat: "Ponavljaj",
    repeat_stop: "Zaustavi",
    repeat_delete: "Obriši",
    repeat_hint: "Zaustavi isključuje raspored, Obriši ga briše, nakon poslednjeg termina.",
    repeat_pause_badge: "Jednom · pa stop",
    repeat_single_badge: "Jednom · pa brisanje",
    duplicate: "Dupliraj",
    copy_name: "{name} (kopija)",
    split: "Podeli",
    merge_next: "Spoji sa sledećim",
    kind: "Vrsta",
    kind_slots: "Termini",
    kind_single: "Jedno vreme",
    kind_slots_hint: "Početak i kraj: radnja traje tokom termina.",
    kind_single_hint: "Jedna radnja u zadato vreme, npr. isključi u 23:00.",
    entities: "Entiteti",
    add_entity: "Dodaj entitet iste vrste",
    change_entities: "Izmeni",
    entities_note: "Važe za ceo raspored, kao i dani.",
    show_entities: "Entiteti na pločicama",
    err_condition: "Popunite ili uklonite svaki uslov.",
    err_dates: "Datum kraja mora biti posle datuma početka.",
    show_badges: "Značke",
    show_condition_status: "Stanje uslova",
    condition_status_animation: "Pulsiranje kada su uslovi ispunjeni",
    cstat_met: "Uslovi ispunjeni",
    cstat_wait: "Čeka svoje uslove",
    cstat_skip: "Preskočeno: uslovi nisu ispunjeni",
    cstat_unavailable: "nedostupno",
    sort_by: "Redosled",
    sort_name: "Naziv",
    sort_next: "Sledeća radnja",
    sort_state: "Aktivni prvo",
    time_step: "Korak vremena",
    exclude_tags: "Skrivene oznake",
  },
  it: {
    schedules: "Programmazioni",
    enabled_one: "{n} attiva",
    enabled_other: "{n} attive",
    disabled_one: "{n} disattivata",
    disabled_other: "{n} disattivate",
    now_hint: "Linea rossa = adesso",
    next_time: "Prossima {time}",
    new_schedule: "Nuova programmazione",
    state_disabled: "Disattivata",
    state_enabled: "Attiva",
    state_completed: "Completata",
    value_now: "{value} ora",
    until: "fino alle {time}",
    action_at: "{action} alle {time}",
    action_on_day: "{action} {day} alle {time}",
    done_today: "Fatto oggi",
    next_lower: "prossima {time}",
    no_upcoming: "Nessuna azione in programma",
    week_total: "{value} {h} h / settimana",
    week_total_all: "{h} h / settimana",
    default_value: "{value} (predefinito)",
    back: "Torna alla linea temporale di oggi",
    no_entities: "Nessuna programmazione trovata. Il componente Scheduler è installato?",
    no_match: "Nessuna programmazione corrisponde ai filtri della scheda.",
    act_on: "Accendi",
    act_off: "Spegni",
    act_open: "Apri",
    act_close: "Chiudi",
    act_stop: "Ferma",
    act_lock: "Blocca",
    act_unlock: "Sblocca",
    act_run: "Esegui",
    act_activate: "Attiva",
    act_start: "Avvia",
    act_dock: "Torna alla base",
    act_play: "Riproduci",
    act_pause: "Pausa",
    act_toggle: "Commuta",
    act_temperature: "Temperatura",
    act_position: "Posizione",
    act_value: "Valore",
    edit_slot: "Modifica fascia",
    add_slot: "Aggiungi fascia",
    start: "Inizio",
    end: "Fine",
    end_hint: "Lascia vuoto per un'azione singola",
    action: "Azione",
    days: "Giorni",
    days_note: "I giorni valgono per tutta la programmazione.",
    name: "Nome",
    entity: "Entità",
    save: "Salva",
    cancel: "Annulla",
    close: "Chiudi",
    delete_slot: "Elimina fascia",
    delete_schedule: "Elimina programmazione",
    confirm_delete: "Eliminare?",
    loading: "Caricamento…",
    err_overlap: "Questa fascia si sovrappone a un'altra.",
    err_same: "La fine deve essere diversa dall'inizio.",
    err_time: "Inserisci un orario di inizio.",
    err_entity: "Scegli un'entità.",
    err_action: "Scegli un'azione.",
    err_days: "Scegli almeno un giorno.",
    err_load: "Impossibile caricare la programmazione.",
    err_save: "Salvataggio non riuscito: {error}",
    zoom_in: "Mostra la scheda completa",
    zoom_out: "Torna alla vista compatta",
    status_active: "In corso",
    status_idle: "A riposo",
    status_warn: "Nessuna pianificazione",
    title: "Titolo",
    illustration: "Illustrazione",
    illustration_theme: "Tema dell'illustrazione",
    theme_auto: "Automatico (segue il tema)",
    theme_day: "Giorno",
    theme_night: "Notte",
    show_disabled: "Programmazioni disattivate",
    editable: "Modifica delle fasce",
    show_header_toggle: "Interruttore di tutte le programmazioni",
    all_on: "Attiva tutte",
    all_off: "Disattiva tutte",
    err_toggle: "Impossibile modificare {count} programmazioni su {total}",
    next_actions: "Prossime azioni",
    zoom: "Pulsante dettagli",
    language: "Lingua",
    lang_auto: "Automatica",
    starts_on: "Inizia il {date}",
    period_range: "{from} → {to}",
    period_until: "Fino al {date}",
    period_from: "Dal {date}",
    schedule_options: "Opzioni",
    tab_slot: "Fascia",
    tab_schedule: "Programma",
    tab_options: "Opzioni",
    mode_time: "Ora",
    at_time: "Alle",
    sunrise: "Alba",
    sunset: "Tramonto",
    before: "Prima",
    after: "Dopo",
    offset: "Scostamento",
    approx_today: "≈ {time} oggi",
    days_daily: "Ogni giorno",
    days_workday: "Giorni feriali",
    days_weekend: "Fine settimana",
    days_custom: "Personalizzato",
    days_workday_note: "I giorni feriali seguono il sensore Workday: i festivi vengono saltati.",
    remove: "Rimuovi",
    tags: "Tag",
    add_tag: "Aggiungi un tag",
    conditions: "Condizioni",
    cond_all: "Tutte",
    cond_any: "Almeno una",
    add_condition: "Aggiungi condizione",
    cond_pick: "Scegli un valore…",
    cond_other: "Altro valore…",
    match_is: "è",
    match_not: "non è",
    match_below: "sotto",
    match_above: "sopra",
    cond_is: "{entity} è {value}",
    cond_not: "{entity} non è {value}",
    cond_below: "{entity} sotto {value}",
    cond_above: "{entity} sopra {value}",
    track_conditions: "Esegui l’azione appena sono soddisfatte",
    period: "Periodo",
    period_hint: "Solo tra due date",
    date_from: "Dal",
    date_to: "Al",
    after_last: "Dopo l’ultima fascia",
    repeat_repeat: "Ripeti",
    repeat_stop: "Ferma",
    repeat_delete: "Elimina",
    repeat_hint: "Ferma disattiva il programma, Elimina lo cancella, dopo la sua ultima fascia.",
    repeat_pause_badge: "Una volta · poi stop",
    repeat_single_badge: "Una volta · poi eliminato",
    duplicate: "Duplica",
    copy_name: "{name} (copia)",
    split: "Dividi",
    merge_next: "Unisci con la successiva",
    kind: "Tipo",
    kind_slots: "Fasce orarie",
    kind_single: "Ora singola",
    kind_slots_hint: "Un inizio e una fine: l’azione vale per tutta la fascia.",
    kind_single_hint: "Un’azione a un’ora fissa, es. spegnere alle 23:00.",
    entities: "Entità",
    add_entity: "Aggiungi un’entità dello stesso tipo",
    change_entities: "Modifica",
    entities_note: "Si applicano a tutta la programmazione, come i giorni.",
    show_entities: "Entità sui riquadri",
    err_condition: "Completa o rimuovi ogni condizione.",
    err_dates: "La data di fine deve seguire quella di inizio.",
    show_badges: "Badge",
    show_condition_status: "Stato delle condizioni",
    condition_status_animation: "Pulsazione quando le condizioni sono soddisfatte",
    cstat_met: "Condizioni soddisfatte",
    cstat_wait: "In attesa delle sue condizioni",
    cstat_skip: "Saltato: condizioni non soddisfatte",
    cstat_unavailable: "non disponibile",
    sort_by: "Ordine",
    sort_name: "Nome",
    sort_next: "Prossima azione",
    sort_state: "In corso prima",
    time_step: "Passo orario",
    exclude_tags: "Tag nascosti",
  },
  nl: {
    schedules: "Schema's",
    enabled_one: "{n} actief",
    enabled_other: "{n} actief",
    disabled_one: "{n} uitgeschakeld",
    disabled_other: "{n} uitgeschakeld",
    now_hint: "Rode lijn = nu",
    next_time: "Volgende {time}",
    new_schedule: "Nieuw schema",
    state_disabled: "Uitgeschakeld",
    state_enabled: "Ingeschakeld",
    state_completed: "Voltooid",
    value_now: "{value} nu",
    until: "tot {time}",
    action_at: "{action} om {time}",
    action_on_day: "{action} {day} om {time}",
    done_today: "Vandaag klaar",
    next_lower: "volgende {time}",
    no_upcoming: "Geen komende actie",
    week_total: "{value} {h} u / week",
    week_total_all: "{h} u / week",
    default_value: "{value} (standaard)",
    back: "Terug naar de tijdlijn van vandaag",
    no_entities: "Geen schema's gevonden. Is de Scheduler-component geïnstalleerd?",
    no_match: "Geen schema komt overeen met de filters van de kaart.",
    act_on: "Aan",
    act_off: "Uit",
    act_open: "Openen",
    act_close: "Sluiten",
    act_stop: "Stoppen",
    act_lock: "Vergrendelen",
    act_unlock: "Ontgrendelen",
    act_run: "Uitvoeren",
    act_activate: "Activeren",
    act_start: "Starten",
    act_dock: "Terug naar basis",
    act_play: "Afspelen",
    act_pause: "Pauzeren",
    act_toggle: "Omschakelen",
    act_temperature: "Temperatuur",
    act_position: "Positie",
    act_value: "Waarde",
    edit_slot: "Tijdvak bewerken",
    add_slot: "Tijdvak toevoegen",
    start: "Begin",
    end: "Einde",
    end_hint: "Leeg laten voor een enkele actie",
    action: "Actie",
    days: "Dagen",
    days_note: "De dagen gelden voor het hele schema.",
    name: "Naam",
    entity: "Entiteit",
    save: "Opslaan",
    cancel: "Annuleren",
    close: "Sluiten",
    delete_slot: "Tijdvak verwijderen",
    delete_schedule: "Schema verwijderen",
    confirm_delete: "Verwijderen?",
    loading: "Laden…",
    err_overlap: "Dit tijdvak overlapt met een ander.",
    err_same: "Het einde moet verschillen van het begin.",
    err_time: "Voer een begintijd in.",
    err_entity: "Kies een entiteit.",
    err_action: "Kies een actie.",
    err_days: "Kies minstens één dag.",
    err_load: "Het schema kon niet worden geladen.",
    err_save: "Opslaan mislukt: {error}",
    zoom_in: "Volledige kaart tonen",
    zoom_out: "Terug naar de compacte weergave",
    status_active: "Actief",
    status_idle: "Inactief",
    status_warn: "Geen schema",
    title: "Titel",
    illustration: "Illustratie",
    illustration_theme: "Thema van de illustratie",
    theme_auto: "Automatisch (volgt het thema)",
    theme_day: "Dag",
    theme_night: "Nacht",
    show_disabled: "Uitgeschakelde schema's",
    editable: "Tijdvakken bewerken",
    show_header_toggle: "Schakelaar voor alle schema's",
    all_on: "Alles inschakelen",
    all_off: "Alles uitschakelen",
    err_toggle: "{count} van {total} schema's konden niet worden gewijzigd",
    next_actions: "Komende acties",
    zoom: "Detailknop",
    language: "Taal",
    lang_auto: "Automatisch",
    starts_on: "Begint op {date}",
    period_range: "{from} → {to}",
    period_until: "Tot {date}",
    period_from: "Vanaf {date}",
    schedule_options: "Opties",
    tab_slot: "Tijdvak",
    tab_schedule: "Schema",
    tab_options: "Opties",
    mode_time: "Tijd",
    at_time: "Om",
    sunrise: "Zonsopkomst",
    sunset: "Zonsondergang",
    before: "Voor",
    after: "Na",
    offset: "Verschuiving",
    approx_today: "≈ {time} vandaag",
    days_daily: "Elke dag",
    days_workday: "Werkdagen",
    days_weekend: "Weekend",
    days_custom: "Aangepast",
    days_workday_note: "Werkdagen volgen de Workday-sensor: feestdagen worden overgeslagen.",
    remove: "Verwijderen",
    tags: "Tags",
    add_tag: "Tag toevoegen",
    conditions: "Voorwaarden",
    cond_all: "Alle",
    cond_any: "Minstens één",
    add_condition: "Voorwaarde toevoegen",
    cond_pick: "Kies een waarde…",
    cond_other: "Andere waarde…",
    match_is: "is",
    match_not: "is niet",
    match_below: "onder",
    match_above: "boven",
    cond_is: "{entity} is {value}",
    cond_not: "{entity} is niet {value}",
    cond_below: "{entity} onder {value}",
    cond_above: "{entity} boven {value}",
    track_conditions: "Actie uitvoeren zodra ze kloppen",
    period: "Periode",
    period_hint: "Alleen tussen twee datums",
    date_from: "Van",
    date_to: "Tot",
    after_last: "Na het laatste tijdvak",
    repeat_repeat: "Herhalen",
    repeat_stop: "Stoppen",
    repeat_delete: "Verwijderen",
    repeat_hint: "Stoppen schakelt het schema uit, Verwijderen wist het, zodra het laatste tijdvak voorbij is.",
    repeat_pause_badge: "Eenmalig · dan stop",
    repeat_single_badge: "Eenmalig · dan verwijderd",
    duplicate: "Dupliceren",
    copy_name: "{name} (kopie)",
    split: "Splitsen",
    merge_next: "Samenvoegen met volgende",
    kind: "Soort",
    kind_slots: "Tijdvakken",
    kind_single: "Eén tijdstip",
    kind_slots_hint: "Een begin en een einde: de actie geldt tijdens het tijdvak.",
    kind_single_hint: "Eén actie op een vast tijdstip, bijv. uitschakelen om 23:00.",
    entities: "Entiteiten",
    add_entity: "Entiteit van dezelfde soort toevoegen",
    change_entities: "Wijzigen",
    entities_note: "Ze gelden voor het hele schema, net als de dagen.",
    show_entities: "Entiteiten op de tegels",
    err_condition: "Vul elke voorwaarde in of verwijder ze.",
    err_dates: "De einddatum moet na de begindatum liggen.",
    show_badges: "Badges",
    show_condition_status: "Status van de voorwaarden",
    condition_status_animation: "Pulseren als aan de voorwaarden is voldaan",
    cstat_met: "Voorwaarden vervuld",
    cstat_wait: "Wacht op zijn voorwaarden",
    cstat_skip: "Overgeslagen: voorwaarden niet vervuld",
    cstat_unavailable: "niet beschikbaar",
    sort_by: "Sorteren",
    sort_name: "Naam",
    sort_next: "Volgende actie",
    sort_state: "Actief eerst",
    time_step: "Tijdstap",
    exclude_tags: "Verborgen tags",
  },
  pt: {
    schedules: "Agendamentos",
    enabled_one: "{n} ativo",
    enabled_other: "{n} ativos",
    disabled_one: "{n} desativado",
    disabled_other: "{n} desativados",
    now_hint: "Linha vermelha = agora",
    next_time: "Próximo {time}",
    new_schedule: "Novo agendamento",
    state_disabled: "Desativado",
    state_enabled: "Ativado",
    state_completed: "Concluído",
    value_now: "{value} agora",
    until: "até às {time}",
    action_at: "{action} às {time}",
    action_on_day: "{action} {day} às {time}",
    done_today: "Feito hoje",
    next_lower: "próximo {time}",
    no_upcoming: "Nenhuma ação prevista",
    week_total: "{value} {h} h / semana",
    week_total_all: "{h} h / semana",
    default_value: "{value} (predefinido)",
    back: "Voltar à cronologia de hoje",
    no_entities: "Nenhum agendamento encontrado. O componente Scheduler está instalado?",
    no_match: "Nenhum agendamento corresponde aos filtros do cartão.",
    act_on: "Ligar",
    act_off: "Desligar",
    act_open: "Abrir",
    act_close: "Fechar",
    act_stop: "Parar",
    act_lock: "Trancar",
    act_unlock: "Destrancar",
    act_run: "Executar",
    act_activate: "Ativar",
    act_start: "Iniciar",
    act_dock: "Voltar à base",
    act_play: "Reproduzir",
    act_pause: "Pausa",
    act_toggle: "Alternar",
    act_temperature: "Temperatura",
    act_position: "Posição",
    act_value: "Valor",
    edit_slot: "Editar intervalo",
    add_slot: "Adicionar intervalo",
    start: "Início",
    end: "Fim",
    end_hint: "Deixe vazio para uma ação única",
    action: "Ação",
    days: "Dias",
    days_note: "Os dias aplicam-se a todo o agendamento.",
    name: "Nome",
    entity: "Entidade",
    save: "Guardar",
    cancel: "Cancelar",
    close: "Fechar",
    delete_slot: "Eliminar intervalo",
    delete_schedule: "Eliminar agendamento",
    confirm_delete: "Eliminar?",
    loading: "A carregar…",
    err_overlap: "Este intervalo sobrepõe-se a outro.",
    err_same: "O fim tem de ser diferente do início.",
    err_time: "Introduza uma hora de início.",
    err_entity: "Escolha uma entidade.",
    err_action: "Escolha uma ação.",
    err_days: "Escolha pelo menos um dia.",
    err_load: "Não foi possível carregar o agendamento.",
    err_save: "Não foi possível guardar: {error}",
    zoom_in: "Mostrar o cartão completo",
    zoom_out: "Voltar à vista compacta",
    status_active: "Em curso",
    status_idle: "Inativo",
    status_warn: "Sem agendamento",
    title: "Título",
    illustration: "Ilustração",
    illustration_theme: "Tema da ilustração",
    theme_auto: "Automático (segue o tema)",
    theme_day: "Dia",
    theme_night: "Noite",
    show_disabled: "Agendamentos desativados",
    editable: "Edição de intervalos",
    show_header_toggle: "Interruptor de todos os agendamentos",
    all_on: "Ativar todos",
    all_off: "Desativar todos",
    err_toggle: "Não foi possível alterar {count} de {total} agendamentos",
    next_actions: "Próximas ações",
    zoom: "Botão de detalhe",
    language: "Idioma",
    lang_auto: "Automático",
    starts_on: "Começa a {date}",
    period_range: "{from} → {to}",
    period_until: "Até {date}",
    period_from: "A partir de {date}",
    schedule_options: "Opções",
    tab_slot: "Intervalo",
    tab_schedule: "Agendamento",
    tab_options: "Opções",
    mode_time: "Hora",
    at_time: "Às",
    sunrise: "Nascer do sol",
    sunset: "Pôr do sol",
    before: "Antes",
    after: "Depois",
    offset: "Desvio",
    approx_today: "≈ {time} hoje",
    days_daily: "Todos os dias",
    days_workday: "Dias úteis",
    days_weekend: "Fim de semana",
    days_custom: "Personalizado",
    days_workday_note: "Os dias úteis seguem o sensor Workday: os feriados são saltados.",
    remove: "Remover",
    tags: "Etiquetas",
    add_tag: "Adicionar etiqueta",
    conditions: "Condições",
    cond_all: "Todas",
    cond_any: "Pelo menos uma",
    add_condition: "Adicionar condição",
    cond_pick: "Escolher um valor…",
    cond_other: "Outro valor…",
    match_is: "é",
    match_not: "não é",
    match_below: "abaixo de",
    match_above: "acima de",
    cond_is: "{entity} é {value}",
    cond_not: "{entity} não é {value}",
    cond_below: "{entity} abaixo de {value}",
    cond_above: "{entity} acima de {value}",
    track_conditions: "Executar a ação assim que se cumprirem",
    period: "Período",
    period_hint: "Apenas entre duas datas",
    date_from: "De",
    date_to: "Até",
    after_last: "Após o último intervalo",
    repeat_repeat: "Repetir",
    repeat_stop: "Parar",
    repeat_delete: "Eliminar",
    repeat_hint: "Parar desativa o agendamento, Eliminar apaga-o, depois do seu último intervalo.",
    repeat_pause_badge: "Uma vez · depois para",
    repeat_single_badge: "Uma vez · depois eliminado",
    duplicate: "Duplicar",
    copy_name: "{name} (cópia)",
    split: "Dividir",
    merge_next: "Juntar com o seguinte",
    kind: "Tipo",
    kind_slots: "Intervalos",
    kind_single: "Hora única",
    kind_slots_hint: "Um início e um fim: a ação vale durante o intervalo.",
    kind_single_hint: "Uma ação a uma hora fixa, p. ex. desligar às 23:00.",
    entities: "Entidades",
    add_entity: "Adicionar entidade do mesmo tipo",
    change_entities: "Alterar",
    entities_note: "Aplicam-se a todo o agendamento, tal como os dias.",
    show_entities: "Entidades nos mosaicos",
    err_condition: "Preencha ou remova cada condição.",
    err_dates: "A data de fim deve ser posterior à de início.",
    show_badges: "Distintivos",
    show_condition_status: "Estado das condições",
    condition_status_animation: "Pulsar quando as condições são cumpridas",
    cstat_met: "Condições cumpridas",
    cstat_wait: "À espera das suas condições",
    cstat_skip: "Ignorado: condições não cumpridas",
    cstat_unavailable: "indisponível",
    sort_by: "Ordenação",
    sort_name: "Nome",
    sort_next: "Próxima ação",
    sort_state: "Em curso primeiro",
    time_step: "Passo de tempo",
    exclude_tags: "Etiquetas ocultas",
  },
  pl: {
    schedules: "Harmonogramy",
    enabled_one: "{n} włączony",
    enabled_few: "{n} włączone",
    enabled_many: "{n} włączonych",
    enabled_other: "{n} włączonego",
    disabled_one: "{n} wyłączony",
    disabled_few: "{n} wyłączone",
    disabled_many: "{n} wyłączonych",
    disabled_other: "{n} wyłączonego",
    now_hint: "Czerwona linia = teraz",
    next_time: "Następne {time}",
    new_schedule: "Nowy harmonogram",
    state_disabled: "Wyłączony",
    state_enabled: "Włączony",
    state_completed: "Zakończony",
    value_now: "{value} teraz",
    until: "do {time}",
    action_at: "{action} o {time}",
    action_on_day: "{action} {day} o {time}",
    done_today: "Wykonano dzisiaj",
    next_lower: "następne {time}",
    no_upcoming: "Brak nadchodzących akcji",
    week_total: "{value} {h} h / tydzień",
    week_total_all: "{h} h / tydzień",
    default_value: "{value} (domyślnie)",
    back: "Wróć do dzisiejszej osi czasu",
    no_entities: "Nie znaleziono harmonogramów. Czy komponent Scheduler jest zainstalowany?",
    no_match: "Żaden harmonogram nie pasuje do filtrów karty.",
    act_on: "Włącz",
    act_off: "Wyłącz",
    act_open: "Otwórz",
    act_close: "Zamknij",
    act_stop: "Zatrzymaj",
    act_lock: "Zablokuj",
    act_unlock: "Odblokuj",
    act_run: "Uruchom",
    act_activate: "Aktywuj",
    act_start: "Rozpocznij",
    act_dock: "Powrót do stacji",
    act_play: "Odtwórz",
    act_pause: "Pauza",
    act_toggle: "Przełącz",
    act_temperature: "Temperatura",
    act_position: "Pozycja",
    act_value: "Wartość",
    edit_slot: "Edytuj przedział",
    add_slot: "Dodaj przedział",
    start: "Początek",
    end: "Koniec",
    end_hint: "Pozostaw puste dla pojedynczej akcji",
    action: "Akcja",
    days: "Dni",
    days_note: "Dni dotyczą całego harmonogramu.",
    name: "Nazwa",
    entity: "Encja",
    save: "Zapisz",
    cancel: "Anuluj",
    close: "Zamknij",
    delete_slot: "Usuń przedział",
    delete_schedule: "Usuń harmonogram",
    confirm_delete: "Usunąć?",
    loading: "Wczytywanie…",
    err_overlap: "Ten przedział nakłada się na inny.",
    err_same: "Koniec musi być różny od początku.",
    err_time: "Podaj godzinę rozpoczęcia.",
    err_entity: "Wybierz encję.",
    err_action: "Wybierz akcję.",
    err_days: "Wybierz co najmniej jeden dzień.",
    err_load: "Nie udało się wczytać harmonogramu.",
    err_save: "Nie udało się zapisać: {error}",
    zoom_in: "Pokaż pełną kartę",
    zoom_out: "Wróć do widoku kompaktowego",
    status_active: "W toku",
    status_idle: "Bezczynny",
    status_warn: "Brak harmonogramu",
    title: "Tytuł",
    illustration: "Ilustracja",
    illustration_theme: "Motyw ilustracji",
    theme_auto: "Automatycznie (zgodnie z motywem)",
    theme_day: "Dzień",
    theme_night: "Noc",
    show_disabled: "Wyłączone harmonogramy",
    editable: "Edycja przedziałów",
    show_header_toggle: "Przełącznik wszystkich harmonogramów",
    all_on: "Włącz wszystkie",
    all_off: "Wyłącz wszystkie",
    err_toggle: "Nie udało się zmienić {count} z {total} harmonogramów",
    next_actions: "Nadchodzące akcje",
    zoom: "Przycisk szczegółów",
    language: "Język",
    lang_auto: "Automatycznie",
    starts_on: "Zaczyna się {date}",
    period_range: "{from} → {to}",
    period_until: "Do {date}",
    period_from: "Od {date}",
    schedule_options: "Opcje",
    tab_slot: "Przedział",
    tab_schedule: "Harmonogram",
    tab_options: "Opcje",
    mode_time: "Godzina",
    at_time: "O",
    sunrise: "Wschód słońca",
    sunset: "Zachód słońca",
    before: "Przed",
    after: "Po",
    offset: "Przesunięcie",
    approx_today: "≈ {time} dziś",
    days_daily: "Codziennie",
    days_workday: "Dni robocze",
    days_weekend: "Weekend",
    days_custom: "Własne",
    days_workday_note: "Dni robocze wynikają z czujnika Workday: święta są pomijane.",
    remove: "Usuń",
    tags: "Tagi",
    add_tag: "Dodaj tag",
    conditions: "Warunki",
    cond_all: "Wszystkie",
    cond_any: "Którykolwiek",
    add_condition: "Dodaj warunek",
    cond_pick: "Wybierz wartość…",
    cond_other: "Inna wartość…",
    match_is: "jest",
    match_not: "nie jest",
    match_below: "poniżej",
    match_above: "powyżej",
    cond_is: "{entity} jest {value}",
    cond_not: "{entity} nie jest {value}",
    cond_below: "{entity} poniżej {value}",
    cond_above: "{entity} powyżej {value}",
    track_conditions: "Wykonaj akcję, gdy tylko zostaną spełnione",
    period: "Okres",
    period_hint: "Tylko między dwiema datami",
    date_from: "Od",
    date_to: "Do",
    after_last: "Po ostatnim przedziale",
    repeat_repeat: "Powtarzaj",
    repeat_stop: "Zatrzymaj",
    repeat_delete: "Usuń",
    repeat_hint: "Zatrzymaj wyłącza harmonogram, Usuń kasuje go po ostatnim przedziale.",
    repeat_pause_badge: "Raz · potem stop",
    repeat_single_badge: "Raz · potem usunięcie",
    duplicate: "Duplikuj",
    copy_name: "{name} (kopia)",
    split: "Podziel",
    merge_next: "Połącz z następnym",
    kind: "Rodzaj",
    kind_slots: "Przedziały czasu",
    kind_single: "Jedna godzina",
    kind_slots_hint: "Początek i koniec: akcja trwa przez przedział.",
    kind_single_hint: "Jedna akcja o stałej godzinie, np. wyłącz o 23:00.",
    entities: "Encje",
    add_entity: "Dodaj encję tego samego rodzaju",
    change_entities: "Zmień",
    entities_note: "Dotyczą całego harmonogramu, tak jak dni.",
    show_entities: "Encje na kafelkach",
    err_condition: "Uzupełnij lub usuń każdy warunek.",
    err_dates: "Data końcowa musi być po dacie początkowej.",
    show_badges: "Plakietki",
    show_condition_status: "Stan warunków",
    condition_status_animation: "Pulsowanie, gdy warunki są spełnione",
    cstat_met: "Warunki spełnione",
    cstat_wait: "Czeka na swoje warunki",
    cstat_skip: "Pominięty: warunki niespełnione",
    cstat_unavailable: "niedostępny",
    sort_by: "Sortowanie",
    sort_name: "Nazwa",
    sort_next: "Następna akcja",
    sort_state: "Aktywne najpierw",
    time_step: "Krok czasu",
    exclude_tags: "Ukryte tagi",
  },
  ro: {
    schedules: "Programări",
    enabled_one: "{n} activă",
    enabled_few: "{n} active",
    enabled_other: "{n} de active",
    disabled_one: "{n} dezactivată",
    disabled_few: "{n} dezactivate",
    disabled_other: "{n} de dezactivate",
    now_hint: "Linia roșie = acum",
    next_time: "Următoarea {time}",
    new_schedule: "Programare nouă",
    state_disabled: "Dezactivată",
    state_enabled: "Activată",
    state_completed: "Finalizată",
    value_now: "{value} acum",
    until: "până la {time}",
    action_at: "{action} la {time}",
    action_on_day: "{action} {day} la {time}",
    done_today: "Gata azi",
    next_lower: "următoarea {time}",
    no_upcoming: "Nicio acțiune programată",
    week_total: "{value} {h} h / săptămână",
    week_total_all: "{h} h / săptămână",
    default_value: "{value} (implicit)",
    back: "Înapoi la cronologia de azi",
    no_entities: "Nu s-au găsit programări. Este instalată componenta Scheduler?",
    no_match: "Nicio programare nu corespunde filtrelor cardului.",
    act_on: "Pornește",
    act_off: "Oprește",
    act_open: "Deschide",
    act_close: "Închide",
    act_stop: "Stop",
    act_lock: "Încuie",
    act_unlock: "Descuie",
    act_run: "Rulează",
    act_activate: "Activează",
    act_start: "Pornește",
    act_dock: "Înapoi la bază",
    act_play: "Redă",
    act_pause: "Pauză",
    act_toggle: "Comută",
    act_temperature: "Temperatură",
    act_position: "Poziție",
    act_value: "Valoare",
    edit_slot: "Editează intervalul",
    add_slot: "Adaugă interval",
    start: "Început",
    end: "Sfârșit",
    end_hint: "Lăsați gol pentru o acțiune unică",
    action: "Acțiune",
    days: "Zile",
    days_note: "Zilele se aplică întregii programări.",
    name: "Nume",
    entity: "Entitate",
    save: "Salvează",
    cancel: "Anulează",
    close: "Închide",
    delete_slot: "Șterge intervalul",
    delete_schedule: "Șterge programarea",
    confirm_delete: "Ștergeți?",
    loading: "Se încarcă…",
    err_overlap: "Acest interval se suprapune cu altul.",
    err_same: "Sfârșitul trebuie să difere de început.",
    err_time: "Introduceți o oră de început.",
    err_entity: "Alegeți o entitate.",
    err_action: "Alegeți o acțiune.",
    err_days: "Alegeți cel puțin o zi.",
    err_load: "Programarea nu a putut fi încărcată.",
    err_save: "Salvarea a eșuat: {error}",
    zoom_in: "Afișează cardul complet",
    zoom_out: "Înapoi la vizualizarea compactă",
    status_active: "În curs",
    status_idle: "Inactiv",
    status_warn: "Niciun program",
    title: "Titlu",
    illustration: "Ilustrație",
    illustration_theme: "Tema ilustrației",
    theme_auto: "Automat (urmează tema)",
    theme_day: "Zi",
    theme_night: "Noapte",
    show_disabled: "Programări dezactivate",
    editable: "Editarea intervalelor",
    show_header_toggle: "Comutator pentru toate programările",
    all_on: "Activează toate",
    all_off: "Dezactivează toate",
    err_toggle: "Nu s-au putut modifica {count} din {total} programări",
    next_actions: "Acțiuni următoare",
    zoom: "Buton de detalii",
    language: "Limbă",
    lang_auto: "Automat",
    starts_on: "Începe pe {date}",
    period_range: "{from} → {to}",
    period_until: "Până pe {date}",
    period_from: "Din {date}",
    schedule_options: "Opțiuni",
    tab_slot: "Interval",
    tab_schedule: "Program",
    tab_options: "Opțiuni",
    mode_time: "Oră",
    at_time: "La",
    sunrise: "Răsărit",
    sunset: "Apus",
    before: "Înainte",
    after: "După",
    offset: "Decalaj",
    approx_today: "≈ {time} azi",
    days_daily: "Zilnic",
    days_workday: "Zile lucrătoare",
    days_weekend: "Weekend",
    days_custom: "Personalizat",
    days_workday_note: "Zilele lucrătoare urmează senzorul Workday: sărbătorile sunt sărite.",
    remove: "Elimină",
    tags: "Etichete",
    add_tag: "Adaugă o etichetă",
    conditions: "Condiții",
    cond_all: "Toate",
    cond_any: "Oricare",
    add_condition: "Adaugă condiție",
    cond_pick: "Alege o valoare…",
    cond_other: "Altă valoare…",
    match_is: "este",
    match_not: "nu este",
    match_below: "sub",
    match_above: "peste",
    cond_is: "{entity} este {value}",
    cond_not: "{entity} nu este {value}",
    cond_below: "{entity} sub {value}",
    cond_above: "{entity} peste {value}",
    track_conditions: "Rulează acțiunea imediat ce sunt îndeplinite",
    period: "Perioadă",
    period_hint: "Doar între două date",
    date_from: "De la",
    date_to: "Până la",
    after_last: "După ultimul interval",
    repeat_repeat: "Repetă",
    repeat_stop: "Oprește",
    repeat_delete: "Șterge",
    repeat_hint: "Oprește dezactivează programul, Șterge îl elimină, după ultimul interval.",
    repeat_pause_badge: "O dată · apoi oprire",
    repeat_single_badge: "O dată · apoi ștergere",
    duplicate: "Duplică",
    copy_name: "{name} (copie)",
    split: "Împarte",
    merge_next: "Unește cu următorul",
    kind: "Tip",
    kind_slots: "Intervale orare",
    kind_single: "O singură oră",
    kind_slots_hint: "Un început și un sfârșit: acțiunea ține pe tot intervalul.",
    kind_single_hint: "O acțiune la o oră fixă, de ex. oprire la 23:00.",
    entities: "Entități",
    add_entity: "Adaugă o entitate de același tip",
    change_entities: "Modifică",
    entities_note: "Se aplică întregii programări, ca și zilele.",
    show_entities: "Entități pe plăci",
    err_condition: "Completează sau elimină fiecare condiție.",
    err_dates: "Data de sfârșit trebuie să fie după data de început.",
    show_badges: "Insigne",
    show_condition_status: "Starea condițiilor",
    condition_status_animation: "Pulsare când condițiile sunt îndeplinite",
    cstat_met: "Condiții îndeplinite",
    cstat_wait: "Își așteaptă condițiile",
    cstat_skip: "Omis: condiții neîndeplinite",
    cstat_unavailable: "indisponibil",
    sort_by: "Sortare",
    sort_name: "Nume",
    sort_next: "Următoarea acțiune",
    sort_state: "Active întâi",
    time_step: "Pas de timp",
    exclude_tags: "Etichete ascunse",
  },
  da: {
    schedules: "Tidsplaner",
    enabled_one: "{n} aktiv",
    enabled_other: "{n} aktive",
    disabled_one: "{n} deaktiveret",
    disabled_other: "{n} deaktiverede",
    now_hint: "Rød streg = nu",
    next_time: "Næste {time}",
    new_schedule: "Ny tidsplan",
    state_disabled: "Deaktiveret",
    state_enabled: "Aktiveret",
    state_completed: "Fuldført",
    value_now: "{value} nu",
    until: "indtil {time}",
    action_at: "{action} kl. {time}",
    action_on_day: "{action} {day} kl. {time}",
    done_today: "Færdig i dag",
    next_lower: "næste {time}",
    no_upcoming: "Ingen kommende handling",
    week_total: "{value} {h} t / uge",
    week_total_all: "{h} t / uge",
    default_value: "{value} (standard)",
    back: "Tilbage til dagens tidslinje",
    no_entities: "Ingen tidsplaner fundet. Er Scheduler-komponenten installeret?",
    no_match: "Ingen tidsplan matcher kortets filtre.",
    act_on: "Tænd",
    act_off: "Sluk",
    act_open: "Åbn",
    act_close: "Luk",
    act_stop: "Stop",
    act_lock: "Lås",
    act_unlock: "Lås op",
    act_run: "Kør",
    act_activate: "Aktivér",
    act_start: "Start",
    act_dock: "Tilbage til base",
    act_play: "Afspil",
    act_pause: "Pause",
    act_toggle: "Skift",
    act_temperature: "Temperatur",
    act_position: "Position",
    act_value: "Værdi",
    edit_slot: "Rediger tidsrum",
    add_slot: "Tilføj tidsrum",
    start: "Start",
    end: "Slut",
    end_hint: "Lad stå tomt for en enkelt handling",
    action: "Handling",
    days: "Dage",
    days_note: "Dagene gælder for hele tidsplanen.",
    name: "Navn",
    entity: "Entitet",
    save: "Gem",
    cancel: "Annuller",
    close: "Luk",
    delete_slot: "Slet tidsrum",
    delete_schedule: "Slet tidsplan",
    confirm_delete: "Slet?",
    loading: "Indlæser…",
    err_overlap: "Dette tidsrum overlapper et andet.",
    err_same: "Slut skal være forskellig fra start.",
    err_time: "Angiv et starttidspunkt.",
    err_entity: "Vælg en entitet.",
    err_action: "Vælg en handling.",
    err_days: "Vælg mindst én dag.",
    err_load: "Tidsplanen kunne ikke indlæses.",
    err_save: "Kunne ikke gemme: {error}",
    zoom_in: "Vis hele kortet",
    zoom_out: "Tilbage til kompakt visning",
    status_active: "Kører",
    status_idle: "Inaktiv",
    status_warn: "Ingen tidsplan",
    title: "Titel",
    illustration: "Illustration",
    illustration_theme: "Illustrationens tema",
    theme_auto: "Automatisk (følger temaet)",
    theme_day: "Dag",
    theme_night: "Nat",
    show_disabled: "Deaktiverede tidsplaner",
    editable: "Redigering af tidsrum",
    show_header_toggle: "Kontakt til alle tidsplaner",
    all_on: "Aktivér alle",
    all_off: "Deaktivér alle",
    err_toggle: "{count} af {total} tidsplaner kunne ikke ændres",
    next_actions: "Kommende handlinger",
    zoom: "Detaljeknap",
    language: "Sprog",
    lang_auto: "Automatisk",
    starts_on: "Starter {date}",
    period_range: "{from} → {to}",
    period_until: "Indtil {date}",
    period_from: "Fra {date}",
    schedule_options: "Indstillinger",
    tab_slot: "Tidsrum",
    tab_schedule: "Tidsplan",
    tab_options: "Indstillinger",
    mode_time: "Tid",
    at_time: "Kl.",
    sunrise: "Solopgang",
    sunset: "Solnedgang",
    before: "Før",
    after: "Efter",
    offset: "Forskydning",
    approx_today: "≈ {time} i dag",
    days_daily: "Hver dag",
    days_workday: "Arbejdsdage",
    days_weekend: "Weekend",
    days_custom: "Tilpasset",
    days_workday_note: "Arbejdsdage følger Workday-sensoren: helligdage springes over.",
    remove: "Fjern",
    tags: "Tags",
    add_tag: "Tilføj et tag",
    conditions: "Betingelser",
    cond_all: "Alle",
    cond_any: "Mindst én",
    add_condition: "Tilføj betingelse",
    cond_pick: "Vælg en værdi…",
    cond_other: "Anden værdi…",
    match_is: "er",
    match_not: "er ikke",
    match_below: "under",
    match_above: "over",
    cond_is: "{entity} er {value}",
    cond_not: "{entity} er ikke {value}",
    cond_below: "{entity} under {value}",
    cond_above: "{entity} over {value}",
    track_conditions: "Udfør handlingen så snart de er opfyldt",
    period: "Periode",
    period_hint: "Kun mellem to datoer",
    date_from: "Fra",
    date_to: "Til",
    after_last: "Efter det sidste tidsrum",
    repeat_repeat: "Gentag",
    repeat_stop: "Stop",
    repeat_delete: "Slet",
    repeat_hint: "Stop deaktiverer tidsplanen, Slet fjerner den, når det sidste tidsrum er kørt.",
    repeat_pause_badge: "Én gang · så stop",
    repeat_single_badge: "Én gang · så slettet",
    duplicate: "Dupliker",
    copy_name: "{name} (kopi)",
    split: "Del",
    merge_next: "Flet med næste",
    kind: "Type",
    kind_slots: "Tidsrum",
    kind_single: "Ét tidspunkt",
    kind_slots_hint: "En start og en slutning: handlingen gælder i tidsrummet.",
    kind_single_hint: "Én handling på et fast tidspunkt, f.eks. sluk kl. 23:00.",
    entities: "Enheder",
    add_entity: "Tilføj en enhed af samme type",
    change_entities: "Skift",
    entities_note: "De gælder for hele tidsplanen, ligesom dagene.",
    show_entities: "Enheder på fliserne",
    err_condition: "Udfyld eller fjern hver betingelse.",
    err_dates: "Slutdatoen skal ligge efter startdatoen.",
    show_badges: "Mærker",
    show_condition_status: "Status for betingelser",
    condition_status_animation: "Puls, når betingelserne er opfyldt",
    cstat_met: "Betingelser opfyldt",
    cstat_wait: "Venter på sine betingelser",
    cstat_skip: "Sprunget over: betingelser ikke opfyldt",
    cstat_unavailable: "utilgængelig",
    sort_by: "Sortering",
    sort_name: "Navn",
    sort_next: "Næste handling",
    sort_state: "Aktive først",
    time_step: "Tidstrin",
    exclude_tags: "Skjulte tags",
  },
  sv: {
    schedules: "Scheman",
    enabled_one: "{n} aktivt",
    enabled_other: "{n} aktiva",
    disabled_one: "{n} inaktiverat",
    disabled_other: "{n} inaktiverade",
    now_hint: "Röd linje = nu",
    next_time: "Nästa {time}",
    new_schedule: "Nytt schema",
    state_disabled: "Inaktiverat",
    state_enabled: "Aktiverat",
    state_completed: "Slutfört",
    value_now: "{value} nu",
    until: "till {time}",
    action_at: "{action} kl. {time}",
    action_on_day: "{action} {day} kl. {time}",
    done_today: "Klart i dag",
    next_lower: "nästa {time}",
    no_upcoming: "Ingen kommande åtgärd",
    week_total: "{value} {h} h / vecka",
    week_total_all: "{h} h / vecka",
    default_value: "{value} (standard)",
    back: "Tillbaka till dagens tidslinje",
    no_entities: "Inga scheman hittades. Är Scheduler-komponenten installerad?",
    no_match: "Inget schema matchar kortets filter.",
    act_on: "Slå på",
    act_off: "Stäng av",
    act_open: "Öppna",
    act_close: "Stäng",
    act_stop: "Stoppa",
    act_lock: "Lås",
    act_unlock: "Lås upp",
    act_run: "Kör",
    act_activate: "Aktivera",
    act_start: "Starta",
    act_dock: "Tillbaka till basen",
    act_play: "Spela",
    act_pause: "Paus",
    act_toggle: "Växla",
    act_temperature: "Temperatur",
    act_position: "Position",
    act_value: "Värde",
    edit_slot: "Redigera tidsintervall",
    add_slot: "Lägg till tidsintervall",
    start: "Start",
    end: "Slut",
    end_hint: "Lämna tomt för en enstaka åtgärd",
    action: "Åtgärd",
    days: "Dagar",
    days_note: "Dagarna gäller hela schemat.",
    name: "Namn",
    entity: "Entitet",
    save: "Spara",
    cancel: "Avbryt",
    close: "Stäng",
    delete_slot: "Ta bort tidsintervall",
    delete_schedule: "Ta bort schema",
    confirm_delete: "Ta bort?",
    loading: "Laddar…",
    err_overlap: "Det här intervallet överlappar ett annat.",
    err_same: "Slutet måste skilja sig från starten.",
    err_time: "Ange en starttid.",
    err_entity: "Välj en entitet.",
    err_action: "Välj en åtgärd.",
    err_days: "Välj minst en dag.",
    err_load: "Schemat kunde inte laddas.",
    err_save: "Kunde inte spara: {error}",
    zoom_in: "Visa hela kortet",
    zoom_out: "Tillbaka till kompakt vy",
    status_active: "Pågår",
    status_idle: "Vilande",
    status_warn: "Inget schema",
    title: "Titel",
    illustration: "Illustration",
    illustration_theme: "Illustrationens tema",
    theme_auto: "Automatiskt (följer temat)",
    theme_day: "Dag",
    theme_night: "Natt",
    show_disabled: "Inaktiverade scheman",
    editable: "Redigering av intervall",
    show_header_toggle: "Brytare för alla scheman",
    all_on: "Aktivera alla",
    all_off: "Inaktivera alla",
    err_toggle: "{count} av {total} scheman kunde inte ändras",
    next_actions: "Kommande åtgärder",
    zoom: "Detaljknapp",
    language: "Språk",
    lang_auto: "Automatiskt",
    starts_on: "Börjar {date}",
    period_range: "{from} → {to}",
    period_until: "Till {date}",
    period_from: "Från {date}",
    schedule_options: "Alternativ",
    tab_slot: "Tidsfönster",
    tab_schedule: "Schema",
    tab_options: "Alternativ",
    mode_time: "Tid",
    at_time: "Kl.",
    sunrise: "Soluppgång",
    sunset: "Solnedgång",
    before: "Före",
    after: "Efter",
    offset: "Förskjutning",
    approx_today: "≈ {time} i dag",
    days_daily: "Varje dag",
    days_workday: "Arbetsdagar",
    days_weekend: "Helg",
    days_custom: "Anpassat",
    days_workday_note: "Arbetsdagar följer Workday-sensorn: helgdagar hoppas över.",
    remove: "Ta bort",
    tags: "Taggar",
    add_tag: "Lägg till en tagg",
    conditions: "Villkor",
    cond_all: "Alla",
    cond_any: "Minst ett",
    add_condition: "Lägg till villkor",
    cond_pick: "Välj ett värde…",
    cond_other: "Annat värde…",
    match_is: "är",
    match_not: "är inte",
    match_below: "under",
    match_above: "över",
    cond_is: "{entity} är {value}",
    cond_not: "{entity} är inte {value}",
    cond_below: "{entity} under {value}",
    cond_above: "{entity} över {value}",
    track_conditions: "Kör åtgärden så snart de uppfylls",
    period: "Period",
    period_hint: "Endast mellan två datum",
    date_from: "Från",
    date_to: "Till",
    after_last: "Efter sista tidsfönstret",
    repeat_repeat: "Upprepa",
    repeat_stop: "Stoppa",
    repeat_delete: "Radera",
    repeat_hint: "Stoppa inaktiverar schemat, Radera tar bort det, när sista tidsfönstret har körts.",
    repeat_pause_badge: "En gång · sedan stopp",
    repeat_single_badge: "En gång · sedan raderat",
    duplicate: "Duplicera",
    copy_name: "{name} (kopia)",
    split: "Dela",
    merge_next: "Slå ihop med nästa",
    kind: "Typ",
    kind_slots: "Tidsfönster",
    kind_single: "En tidpunkt",
    kind_slots_hint: "En start och ett slut: åtgärden gäller under tidsfönstret.",
    kind_single_hint: "En åtgärd vid en fast tid, t.ex. stäng av kl. 23:00.",
    entities: "Entiteter",
    add_entity: "Lägg till en entitet av samma typ",
    change_entities: "Ändra",
    entities_note: "De gäller för hela schemat, liksom dagarna.",
    show_entities: "Entiteter på rutorna",
    err_condition: "Fyll i eller ta bort varje villkor.",
    err_dates: "Slutdatumet måste ligga efter startdatumet.",
    show_badges: "Märken",
    show_condition_status: "Villkorsstatus",
    condition_status_animation: "Pulsera när villkoren är uppfyllda",
    cstat_met: "Villkor uppfyllda",
    cstat_wait: "Väntar på sina villkor",
    cstat_skip: "Hoppas över: villkor ej uppfyllda",
    cstat_unavailable: "otillgänglig",
    sort_by: "Sortering",
    sort_name: "Namn",
    sort_next: "Nästa åtgärd",
    sort_state: "Pågående först",
    time_step: "Tidssteg",
    exclude_tags: "Dolda taggar",
  },
  bg: {
    schedules: "Графици",
    enabled_one: "{n} активен",
    enabled_other: "{n} активни",
    disabled_one: "{n} изключен",
    disabled_other: "{n} изключени",
    now_hint: "Червена линия = сега",
    next_time: "Следващо {time}",
    new_schedule: "Нов график",
    state_disabled: "Изключен",
    state_enabled: "Включен",
    state_completed: "Завършен",
    value_now: "{value} сега",
    until: "до {time}",
    action_at: "{action} в {time}",
    action_on_day: "{action} {day} в {time}",
    done_today: "Изпълнено днес",
    next_lower: "следващо {time}",
    no_upcoming: "Няма предстоящо действие",
    week_total: "{value} {h} ч / седмица",
    week_total_all: "{h} ч / седмица",
    default_value: "{value} (по подразбиране)",
    back: "Назад към днешната времева линия",
    no_entities: "Не са намерени графици. Инсталиран ли е компонентът Scheduler?",
    no_match: "Никой график не отговаря на филтрите на картата.",
    act_on: "Включи",
    act_off: "Изключи",
    act_open: "Отвори",
    act_close: "Затвори",
    act_stop: "Спри",
    act_lock: "Заключи",
    act_unlock: "Отключи",
    act_run: "Изпълни",
    act_activate: "Активирай",
    act_start: "Стартирай",
    act_dock: "Към базата",
    act_play: "Пусни",
    act_pause: "Пауза",
    act_toggle: "Превключи",
    act_temperature: "Температура",
    act_position: "Позиция",
    act_value: "Стойност",
    edit_slot: "Редактиране на интервал",
    add_slot: "Добавяне на интервал",
    start: "Начало",
    end: "Край",
    end_hint: "Оставете празно за еднократно действие",
    action: "Действие",
    days: "Дни",
    days_note: "Дните важат за целия график.",
    name: "Име",
    entity: "Обект",
    save: "Запази",
    cancel: "Отказ",
    close: "Затвори",
    delete_slot: "Изтрий интервала",
    delete_schedule: "Изтрий графика",
    confirm_delete: "Изтриване?",
    loading: "Зареждане…",
    err_overlap: "Този интервал се припокрива с друг.",
    err_same: "Краят трябва да е различен от началото.",
    err_time: "Въведете начален час.",
    err_entity: "Изберете обект.",
    err_action: "Изберете действие.",
    err_days: "Изберете поне един ден.",
    err_load: "Графикът не можа да бъде зареден.",
    err_save: "Неуспешно запазване: {error}",
    zoom_in: "Покажи цялата карта",
    zoom_out: "Назад към компактния изглед",
    status_active: "Изпълнява се",
    status_idle: "Неактивно",
    status_warn: "Няма график",
    title: "Заглавие",
    illustration: "Илюстрация",
    illustration_theme: "Тема на илюстрацията",
    theme_auto: "Автоматично (следва темата)",
    theme_day: "Ден",
    theme_night: "Нощ",
    show_disabled: "Изключени графици",
    editable: "Редактиране на интервали",
    show_header_toggle: "Превключвател за всички графици",
    all_on: "Включи всички",
    all_off: "Изключи всички",
    err_toggle: "{count} от {total} графика не можаха да бъдат променени",
    next_actions: "Предстоящи действия",
    zoom: "Бутон за детайли",
    language: "Език",
    lang_auto: "Автоматично",
    starts_on: "Започва на {date}",
    period_range: "{from} → {to}",
    period_until: "До {date}",
    period_from: "От {date}",
    schedule_options: "Опции",
    tab_slot: "Интервал",
    tab_schedule: "График",
    tab_options: "Опции",
    mode_time: "Час",
    at_time: "В",
    sunrise: "Изгрев",
    sunset: "Залез",
    before: "Преди",
    after: "След",
    offset: "Отместване",
    approx_today: "≈ {time} днес",
    days_daily: "Всеки ден",
    days_workday: "Работни дни",
    days_weekend: "Уикенд",
    days_custom: "Персонализирано",
    days_workday_note: "Работните дни следват сензора Workday: празниците се пропускат.",
    remove: "Премахни",
    tags: "Етикети",
    add_tag: "Добави етикет",
    conditions: "Условия",
    cond_all: "Всички",
    cond_any: "Поне едно",
    add_condition: "Добави условие",
    cond_pick: "Изберете стойност…",
    cond_other: "Друга стойност…",
    match_is: "е",
    match_not: "не е",
    match_below: "под",
    match_above: "над",
    cond_is: "{entity} е {value}",
    cond_not: "{entity} не е {value}",
    cond_below: "{entity} под {value}",
    cond_above: "{entity} над {value}",
    track_conditions: "Изпълни действието веднага щом са изпълнени",
    period: "Период",
    period_hint: "Само между две дати",
    date_from: "От",
    date_to: "До",
    after_last: "След последния интервал",
    repeat_repeat: "Повтаряй",
    repeat_stop: "Спри",
    repeat_delete: "Изтрий",
    repeat_hint: "Спри изключва графика, Изтрий го премахва, след последния му интервал.",
    repeat_pause_badge: "Веднъж · после спира",
    repeat_single_badge: "Веднъж · после се изтрива",
    duplicate: "Дублирай",
    copy_name: "{name} (копие)",
    split: "Раздели",
    merge_next: "Слей със следващия",
    kind: "Вид",
    kind_slots: "Интервали",
    kind_single: "Един час",
    kind_slots_hint: "Начало и край: действието важи през интервала.",
    kind_single_hint: "Едно действие в определен час, напр. изключване в 23:00.",
    entities: "Обекти",
    add_entity: "Добави обект от същия вид",
    change_entities: "Промени",
    entities_note: "Важат за целия график, както и дните.",
    show_entities: "Обекти в плочките",
    err_condition: "Попълнете или премахнете всяко условие.",
    err_dates: "Крайната дата трябва да е след началната.",
    show_badges: "Значки",
    show_condition_status: "Състояние на условията",
    condition_status_animation: "Пулсиране при изпълнени условия",
    cstat_met: "Условията са изпълнени",
    cstat_wait: "Изчаква условията си",
    cstat_skip: "Пропуснат: условията не са изпълнени",
    cstat_unavailable: "недостъпно",
    sort_by: "Подреждане",
    sort_name: "Име",
    sort_next: "Следващо действие",
    sort_state: "Активните първо",
    time_step: "Стъпка на времето",
    exclude_tags: "Скрити етикети",
  },
  ru: {
    schedules: "Расписания",
    enabled_one: "{n} включено",
    enabled_few: "{n} включено",
    enabled_many: "{n} включено",
    enabled_other: "{n} включено",
    disabled_one: "{n} отключено",
    disabled_few: "{n} отключено",
    disabled_many: "{n} отключено",
    disabled_other: "{n} отключено",
    now_hint: "Красная линия = сейчас",
    next_time: "Следующее {time}",
    new_schedule: "Новое расписание",
    state_disabled: "Отключено",
    state_enabled: "Включено",
    state_completed: "Завершено",
    value_now: "{value} сейчас",
    until: "до {time}",
    action_at: "{action} в {time}",
    action_on_day: "{action} {day} в {time}",
    done_today: "Выполнено сегодня",
    next_lower: "следующее {time}",
    no_upcoming: "Нет предстоящих действий",
    week_total: "{value} {h} ч / неделю",
    week_total_all: "{h} ч / неделю",
    default_value: "{value} (по умолчанию)",
    back: "Назад к сегодняшней шкале",
    no_entities: "Расписания не найдены. Установлен ли компонент Scheduler?",
    no_match: "Ни одно расписание не соответствует фильтрам карточки.",
    act_on: "Включить",
    act_off: "Выключить",
    act_open: "Открыть",
    act_close: "Закрыть",
    act_stop: "Стоп",
    act_lock: "Запереть",
    act_unlock: "Отпереть",
    act_run: "Запустить",
    act_activate: "Активировать",
    act_start: "Начать",
    act_dock: "На базу",
    act_play: "Воспроизвести",
    act_pause: "Пауза",
    act_toggle: "Переключить",
    act_temperature: "Температура",
    act_position: "Положение",
    act_value: "Значение",
    edit_slot: "Изменить интервал",
    add_slot: "Добавить интервал",
    start: "Начало",
    end: "Конец",
    end_hint: "Оставьте пустым для однократного действия",
    action: "Действие",
    days: "Дни",
    days_note: "Дни применяются ко всему расписанию.",
    name: "Название",
    entity: "Объект",
    save: "Сохранить",
    cancel: "Отмена",
    close: "Закрыть",
    delete_slot: "Удалить интервал",
    delete_schedule: "Удалить расписание",
    confirm_delete: "Удалить?",
    loading: "Загрузка…",
    err_overlap: "Этот интервал пересекается с другим.",
    err_same: "Конец должен отличаться от начала.",
    err_time: "Введите время начала.",
    err_entity: "Выберите объект.",
    err_action: "Выберите действие.",
    err_days: "Выберите хотя бы один день.",
    err_load: "Не удалось загрузить расписание.",
    err_save: "Не удалось сохранить: {error}",
    zoom_in: "Показать полную карточку",
    zoom_out: "Назад к компактному виду",
    status_active: "Выполняется",
    status_idle: "Неактивно",
    status_warn: "Нет расписания",
    title: "Заголовок",
    illustration: "Иллюстрация",
    illustration_theme: "Тема иллюстрации",
    theme_auto: "Автоматически (по теме)",
    theme_day: "День",
    theme_night: "Ночь",
    show_disabled: "Отключённые расписания",
    editable: "Изменение интервалов",
    show_header_toggle: "Переключатель всех расписаний",
    all_on: "Включить все",
    all_off: "Отключить все",
    err_toggle: "Не удалось изменить {count} из {total} расписаний",
    next_actions: "Ближайшие действия",
    zoom: "Кнопка подробностей",
    language: "Язык",
    lang_auto: "Автоматически",
    starts_on: "Начнётся {date}",
    period_range: "{from} → {to}",
    period_until: "До {date}",
    period_from: "С {date}",
    schedule_options: "Параметры",
    tab_slot: "Интервал",
    tab_schedule: "Расписание",
    tab_options: "Параметры",
    mode_time: "Время",
    at_time: "В",
    sunrise: "Восход",
    sunset: "Закат",
    before: "До",
    after: "После",
    offset: "Смещение",
    approx_today: "≈ {time} сегодня",
    days_daily: "Каждый день",
    days_workday: "Рабочие дни",
    days_weekend: "Выходные",
    days_custom: "Свои дни",
    days_workday_note: "Рабочие дни берутся из датчика Workday: праздники пропускаются.",
    remove: "Удалить",
    tags: "Теги",
    add_tag: "Добавить тег",
    conditions: "Условия",
    cond_all: "Все",
    cond_any: "Любое",
    add_condition: "Добавить условие",
    cond_pick: "Выберите значение…",
    cond_other: "Другое значение…",
    match_is: "равно",
    match_not: "не равно",
    match_below: "ниже",
    match_above: "выше",
    cond_is: "{entity} равно {value}",
    cond_not: "{entity} не равно {value}",
    cond_below: "{entity} ниже {value}",
    cond_above: "{entity} выше {value}",
    track_conditions: "Выполнить действие, как только они выполнятся",
    period: "Период",
    period_hint: "Только между двумя датами",
    date_from: "С",
    date_to: "По",
    after_last: "После последнего интервала",
    repeat_repeat: "Повторять",
    repeat_stop: "Остановить",
    repeat_delete: "Удалить",
    repeat_hint: "«Остановить» отключает расписание, «Удалить» удаляет его после последнего интервала.",
    repeat_pause_badge: "Один раз · затем стоп",
    repeat_single_badge: "Один раз · затем удаление",
    duplicate: "Дублировать",
    copy_name: "{name} (копия)",
    split: "Разделить",
    merge_next: "Объединить со следующим",
    kind: "Тип",
    kind_slots: "Интервалы",
    kind_single: "Одно время",
    kind_slots_hint: "Начало и конец: действие держится весь интервал.",
    kind_single_hint: "Одно действие в заданное время, напр. выключить в 23:00.",
    entities: "Объекты",
    add_entity: "Добавить объект того же типа",
    change_entities: "Изменить",
    entities_note: "Они применяются ко всему расписанию, как и дни.",
    show_entities: "Объекты на плитках",
    err_condition: "Заполните или удалите каждое условие.",
    err_dates: "Дата окончания должна быть позже даты начала.",
    show_badges: "Значки",
    show_condition_status: "Состояние условий",
    condition_status_animation: "Пульсация, когда условия выполнены",
    cstat_met: "Условия выполнены",
    cstat_wait: "Ожидает своих условий",
    cstat_skip: "Пропущено: условия не выполнены",
    cstat_unavailable: "недоступно",
    sort_by: "Сортировка",
    sort_name: "Название",
    sort_next: "Следующее действие",
    sort_state: "Активные сначала",
    time_step: "Шаг времени",
    exclude_tags: "Скрытые теги",
  },
  uk: {
    schedules: "Розклади",
    enabled_one: "{n} увімкнено",
    enabled_few: "{n} увімкнено",
    enabled_many: "{n} увімкнено",
    enabled_other: "{n} увімкнено",
    disabled_one: "{n} вимкнено",
    disabled_few: "{n} вимкнено",
    disabled_many: "{n} вимкнено",
    disabled_other: "{n} вимкнено",
    now_hint: "Червона лінія = зараз",
    next_time: "Наступне {time}",
    new_schedule: "Новий розклад",
    state_disabled: "Вимкнено",
    state_enabled: "Увімкнено",
    state_completed: "Завершено",
    value_now: "{value} зараз",
    until: "до {time}",
    action_at: "{action} о {time}",
    action_on_day: "{action} {day} о {time}",
    done_today: "Виконано сьогодні",
    next_lower: "наступне {time}",
    no_upcoming: "Немає запланованих дій",
    week_total: "{value} {h} год / тиждень",
    week_total_all: "{h} год / тиждень",
    default_value: "{value} (типово)",
    back: "Назад до сьогоднішньої шкали",
    no_entities: "Розклади не знайдено. Чи встановлено компонент Scheduler?",
    no_match: "Жоден розклад не відповідає фільтрам картки.",
    act_on: "Увімкнути",
    act_off: "Вимкнути",
    act_open: "Відкрити",
    act_close: "Закрити",
    act_stop: "Зупинити",
    act_lock: "Замкнути",
    act_unlock: "Відімкнути",
    act_run: "Запустити",
    act_activate: "Активувати",
    act_start: "Почати",
    act_dock: "На базу",
    act_play: "Відтворити",
    act_pause: "Пауза",
    act_toggle: "Перемкнути",
    act_temperature: "Температура",
    act_position: "Положення",
    act_value: "Значення",
    edit_slot: "Змінити інтервал",
    add_slot: "Додати інтервал",
    start: "Початок",
    end: "Кінець",
    end_hint: "Залиште порожнім для одноразової дії",
    action: "Дія",
    days: "Дні",
    days_note: "Дні застосовуються до всього розкладу.",
    name: "Назва",
    entity: "Об'єкт",
    save: "Зберегти",
    cancel: "Скасувати",
    close: "Закрити",
    delete_slot: "Видалити інтервал",
    delete_schedule: "Видалити розклад",
    confirm_delete: "Видалити?",
    loading: "Завантаження…",
    err_overlap: "Цей інтервал перетинається з іншим.",
    err_same: "Кінець має відрізнятися від початку.",
    err_time: "Введіть час початку.",
    err_entity: "Виберіть об'єкт.",
    err_action: "Виберіть дію.",
    err_days: "Виберіть принаймні один день.",
    err_load: "Не вдалося завантажити розклад.",
    err_save: "Не вдалося зберегти: {error}",
    zoom_in: "Показати повну картку",
    zoom_out: "Назад до компактного вигляду",
    status_active: "Виконується",
    status_idle: "Неактивно",
    status_warn: "Немає розкладу",
    title: "Заголовок",
    illustration: "Ілюстрація",
    illustration_theme: "Тема ілюстрації",
    theme_auto: "Автоматично (за темою)",
    theme_day: "День",
    theme_night: "Ніч",
    show_disabled: "Вимкнені розклади",
    editable: "Зміна інтервалів",
    show_header_toggle: "Перемикач усіх розкладів",
    all_on: "Увімкнути всі",
    all_off: "Вимкнути всі",
    err_toggle: "Не вдалося змінити {count} з {total} розкладів",
    next_actions: "Найближчі дії",
    zoom: "Кнопка деталей",
    language: "Мова",
    lang_auto: "Автоматично",
    starts_on: "Почнеться {date}",
    period_range: "{from} → {to}",
    period_until: "До {date}",
    period_from: "З {date}",
    schedule_options: "Параметри",
    tab_slot: "Інтервал",
    tab_schedule: "Розклад",
    tab_options: "Параметри",
    mode_time: "Час",
    at_time: "О",
    sunrise: "Схід сонця",
    sunset: "Захід сонця",
    before: "До",
    after: "Після",
    offset: "Зсув",
    approx_today: "≈ {time} сьогодні",
    days_daily: "Щодня",
    days_workday: "Робочі дні",
    days_weekend: "Вихідні",
    days_custom: "Власні дні",
    days_workday_note: "Робочі дні беруться з датчика Workday: свята пропускаються.",
    remove: "Видалити",
    tags: "Теги",
    add_tag: "Додати тег",
    conditions: "Умови",
    cond_all: "Усі",
    cond_any: "Будь-яка",
    add_condition: "Додати умову",
    cond_pick: "Виберіть значення…",
    cond_other: "Інше значення…",
    match_is: "дорівнює",
    match_not: "не дорівнює",
    match_below: "нижче",
    match_above: "вище",
    cond_is: "{entity} дорівнює {value}",
    cond_not: "{entity} не дорівнює {value}",
    cond_below: "{entity} нижче {value}",
    cond_above: "{entity} вище {value}",
    track_conditions: "Виконати дію, щойно їх буде виконано",
    period: "Період",
    period_hint: "Лише між двома датами",
    date_from: "З",
    date_to: "По",
    after_last: "Після останнього інтервалу",
    repeat_repeat: "Повторювати",
    repeat_stop: "Зупинити",
    repeat_delete: "Видалити",
    repeat_hint: "«Зупинити» вимикає розклад, «Видалити» видаляє його після останнього інтервалу.",
    repeat_pause_badge: "Один раз · потім стоп",
    repeat_single_badge: "Один раз · потім видалення",
    duplicate: "Дублювати",
    copy_name: "{name} (копія)",
    split: "Розділити",
    merge_next: "Об’єднати з наступним",
    kind: "Тип",
    kind_slots: "Інтервали",
    kind_single: "Один час",
    kind_slots_hint: "Початок і кінець: дія триває весь інтервал.",
    kind_single_hint: "Одна дія в заданий час, напр. вимкнути о 23:00.",
    entities: "Об’єкти",
    add_entity: "Додати об’єкт того ж типу",
    change_entities: "Змінити",
    entities_note: "Вони застосовуються до всього розкладу, як і дні.",
    show_entities: "Об'єкти на плитках",
    err_condition: "Заповніть або видаліть кожну умову.",
    err_dates: "Дата завершення має бути пізніше дати початку.",
    show_badges: "Значки",
    show_condition_status: "Стан умов",
    condition_status_animation: "Пульсація, коли умови виконано",
    cstat_met: "Умови виконано",
    cstat_wait: "Очікує своїх умов",
    cstat_skip: "Пропущено: умови не виконано",
    cstat_unavailable: "недоступно",
    sort_by: "Сортування",
    sort_name: "Назва",
    sort_next: "Наступна дія",
    sort_state: "Активні спершу",
    time_step: "Крок часу",
    exclude_tags: "Приховані теги",
  },
  hu: {
    schedules: "Ütemezések",
    enabled_one: "{n} engedélyezve",
    enabled_other: "{n} engedélyezve",
    disabled_one: "{n} letiltva",
    disabled_other: "{n} letiltva",
    now_hint: "Piros vonal = most",
    next_time: "Következő {time}",
    new_schedule: "Új ütemezés",
    state_disabled: "Letiltva",
    state_enabled: "Engedélyezve",
    state_completed: "Befejezve",
    value_now: "{value} most",
    until: "{time}-ig",
    action_at: "{action} {time}-kor",
    action_on_day: "{action} {day} {time}-kor",
    done_today: "Ma kész",
    next_lower: "következő {time}",
    no_upcoming: "Nincs közelgő művelet",
    week_total: "{value} {h} ó / hét",
    week_total_all: "{h} ó / hét",
    default_value: "{value} (alapértelmezett)",
    back: "Vissza a mai idővonalhoz",
    no_entities: "Nem található ütemezés. Telepítve van a Scheduler komponens?",
    no_match: "Egyetlen ütemezés sem felel meg a kártya szűrőinek.",
    act_on: "Bekapcsolás",
    act_off: "Kikapcsolás",
    act_open: "Nyitás",
    act_close: "Zárás",
    act_stop: "Leállítás",
    act_lock: "Zárolás",
    act_unlock: "Feloldás",
    act_run: "Futtatás",
    act_activate: "Aktiválás",
    act_start: "Indítás",
    act_dock: "Vissza a dokkolóba",
    act_play: "Lejátszás",
    act_pause: "Szünet",
    act_toggle: "Váltás",
    act_temperature: "Hőmérséklet",
    act_position: "Pozíció",
    act_value: "Érték",
    edit_slot: "Idősáv szerkesztése",
    add_slot: "Idősáv hozzáadása",
    start: "Kezdet",
    end: "Vége",
    end_hint: "Hagyja üresen egyszeri művelethez",
    action: "Művelet",
    days: "Napok",
    days_note: "A napok a teljes ütemezésre vonatkoznak.",
    name: "Név",
    entity: "Entitás",
    save: "Mentés",
    cancel: "Mégse",
    close: "Bezárás",
    delete_slot: "Idősáv törlése",
    delete_schedule: "Ütemezés törlése",
    confirm_delete: "Törli?",
    loading: "Betöltés…",
    err_overlap: "Ez az idősáv átfedésben van egy másikkal.",
    err_same: "A vége nem egyezhet meg a kezdettel.",
    err_time: "Adjon meg kezdési időpontot.",
    err_entity: "Válasszon entitást.",
    err_action: "Válasszon műveletet.",
    err_days: "Válasszon legalább egy napot.",
    err_load: "Az ütemezést nem sikerült betölteni.",
    err_save: "A mentés nem sikerült: {error}",
    zoom_in: "Teljes kártya megjelenítése",
    zoom_out: "Vissza a kompakt nézethez",
    status_active: "Fut",
    status_idle: "Tétlen",
    status_warn: "Nincs ütemezés",
    title: "Cím",
    illustration: "Illusztráció",
    illustration_theme: "Az illusztráció témája",
    theme_auto: "Automatikus (a témát követi)",
    theme_day: "Nappal",
    theme_night: "Éjszaka",
    show_disabled: "Letiltott ütemezések",
    editable: "Idősávok szerkesztése",
    show_header_toggle: "Kapcsoló az összes ütemezéshez",
    all_on: "Összes engedélyezése",
    all_off: "Összes letiltása",
    err_toggle: "{total} ütemezésből {count} nem módosítható",
    next_actions: "Közelgő műveletek",
    zoom: "Részletek gomb",
    language: "Nyelv",
    lang_auto: "Automatikus",
    starts_on: "Kezdés: {date}",
    period_range: "{from} → {to}",
    period_until: "Eddig: {date}",
    period_from: "Ettől: {date}",
    schedule_options: "Beállítások",
    tab_slot: "Idősáv",
    tab_schedule: "Ütemezés",
    tab_options: "Beállítások",
    mode_time: "Idő",
    at_time: "Ekkor",
    sunrise: "Napkelte",
    sunset: "Napnyugta",
    before: "Előtte",
    after: "Utána",
    offset: "Eltolás",
    approx_today: "≈ {time} ma",
    days_daily: "Minden nap",
    days_workday: "Munkanapok",
    days_weekend: "Hétvége",
    days_custom: "Egyéni",
    days_workday_note: "A munkanapok a Workday érzékelőt követik: az ünnepnapok kimaradnak.",
    remove: "Eltávolítás",
    tags: "Címkék",
    add_tag: "Címke hozzáadása",
    conditions: "Feltételek",
    cond_all: "Mind",
    cond_any: "Bármelyik",
    add_condition: "Feltétel hozzáadása",
    cond_pick: "Válasszon értéket…",
    cond_other: "Más érték…",
    match_is: "egyenlő",
    match_not: "nem egyenlő",
    match_below: "alatt",
    match_above: "felett",
    cond_is: "{entity} egyenlő: {value}",
    cond_not: "{entity} nem egyenlő: {value}",
    cond_below: "{entity} {value} alatt",
    cond_above: "{entity} {value} felett",
    track_conditions: "A művelet futtatása, amint teljesülnek",
    period: "Időszak",
    period_hint: "Csak két dátum között",
    date_from: "Ettől",
    date_to: "Eddig",
    after_last: "Az utolsó idősáv után",
    repeat_repeat: "Ismétlés",
    repeat_stop: "Leállítás",
    repeat_delete: "Törlés",
    repeat_hint: "A Leállítás kikapcsolja az ütemezést, a Törlés eltávolítja, az utolsó idősáv után.",
    repeat_pause_badge: "Egyszer · aztán leáll",
    repeat_single_badge: "Egyszer · aztán törlődik",
    duplicate: "Másolat",
    copy_name: "{name} (másolat)",
    split: "Felosztás",
    merge_next: "Összevonás a következővel",
    kind: "Fajta",
    kind_slots: "Idősávok",
    kind_single: "Egy időpont",
    kind_slots_hint: "Kezdet és vég: a művelet az idősáv alatt érvényes.",
    kind_single_hint: "Egy művelet adott időben, pl. kikapcsolás 23:00-kor.",
    entities: "Entitások",
    add_entity: "Azonos fajtájú entitás hozzáadása",
    change_entities: "Módosítás",
    entities_note: "A teljes ütemezésre vonatkoznak, mint a napok.",
    show_entities: "Entitások a csempéken",
    err_condition: "Töltsön ki vagy távolítson el minden feltételt.",
    err_dates: "A záró dátumnak a kezdő dátum után kell lennie.",
    show_badges: "Jelvények",
    show_condition_status: "Feltételek állapota",
    condition_status_animation: "Pulzálás, ha a feltételek teljesülnek",
    cstat_met: "Feltételek teljesülnek",
    cstat_wait: "A feltételeire vár",
    cstat_skip: "Kihagyva: a feltételek nem teljesülnek",
    cstat_unavailable: "nem elérhető",
    sort_by: "Rendezés",
    sort_name: "Név",
    sort_next: "Következő művelet",
    sort_state: "Futók elöl",
    time_step: "Időlépés",
    exclude_tags: "Elrejtett címkék",
  },
  sk: {
    schedules: "Plány",
    enabled_one: "{n} zapnutý",
    enabled_few: "{n} zapnuté",
    enabled_many: "{n} zapnutých",
    enabled_other: "{n} zapnutých",
    disabled_one: "{n} vypnutý",
    disabled_few: "{n} vypnuté",
    disabled_many: "{n} vypnutých",
    disabled_other: "{n} vypnutých",
    now_hint: "Červená čiara = teraz",
    next_time: "Ďalšie {time}",
    new_schedule: "Nový plán",
    state_disabled: "Vypnutý",
    state_enabled: "Zapnutý",
    state_completed: "Dokončený",
    value_now: "{value} teraz",
    until: "do {time}",
    action_at: "{action} o {time}",
    action_on_day: "{action} {day} o {time}",
    done_today: "Dnes hotovo",
    next_lower: "ďalšie {time}",
    no_upcoming: "Žiadna nadchádzajúca akcia",
    week_total: "{value} {h} h / týždeň",
    week_total_all: "{h} h / týždeň",
    default_value: "{value} (predvolené)",
    back: "Späť na dnešnú časovú os",
    no_entities: "Nenašli sa žiadne plány. Je nainštalovaný komponent Scheduler?",
    no_match: "Filtrom karty nezodpovedá žiadny plán.",
    act_on: "Zapnúť",
    act_off: "Vypnúť",
    act_open: "Otvoriť",
    act_close: "Zatvoriť",
    act_stop: "Zastaviť",
    act_lock: "Zamknúť",
    act_unlock: "Odomknúť",
    act_run: "Spustiť",
    act_activate: "Aktivovať",
    act_start: "Začať",
    act_dock: "Späť na základňu",
    act_play: "Prehrať",
    act_pause: "Pauza",
    act_toggle: "Prepnúť",
    act_temperature: "Teplota",
    act_position: "Poloha",
    act_value: "Hodnota",
    edit_slot: "Upraviť interval",
    add_slot: "Pridať interval",
    start: "Začiatok",
    end: "Koniec",
    end_hint: "Nechajte prázdne pre jednorazovú akciu",
    action: "Akcia",
    days: "Dni",
    days_note: "Dni platia pre celý plán.",
    name: "Názov",
    entity: "Entita",
    save: "Uložiť",
    cancel: "Zrušiť",
    close: "Zavrieť",
    delete_slot: "Odstrániť interval",
    delete_schedule: "Odstrániť plán",
    confirm_delete: "Odstrániť?",
    loading: "Načítava sa…",
    err_overlap: "Tento interval sa prekrýva s iným.",
    err_same: "Koniec sa musí líšiť od začiatku.",
    err_time: "Zadajte čas začiatku.",
    err_entity: "Vyberte entitu.",
    err_action: "Vyberte akciu.",
    err_days: "Vyberte aspoň jeden deň.",
    err_load: "Plán sa nepodarilo načítať.",
    err_save: "Uloženie zlyhalo: {error}",
    zoom_in: "Zobraziť celú kartu",
    zoom_out: "Späť na kompaktné zobrazenie",
    status_active: "Prebieha",
    status_idle: "Nečinné",
    status_warn: "Žiadny plán",
    title: "Názov",
    illustration: "Ilustrácia",
    illustration_theme: "Téma ilustrácie",
    theme_auto: "Automaticky (podľa témy)",
    theme_day: "Deň",
    theme_night: "Noc",
    show_disabled: "Vypnuté plány",
    editable: "Úprava intervalov",
    show_header_toggle: "Prepínač všetkých plánov",
    all_on: "Zapnúť všetky",
    all_off: "Vypnúť všetky",
    err_toggle: "Nepodarilo sa zmeniť {count} z {total} plánov",
    next_actions: "Nadchádzajúce akcie",
    zoom: "Tlačidlo podrobností",
    language: "Jazyk",
    lang_auto: "Automaticky",
    starts_on: "Začína {date}",
    period_range: "{from} → {to}",
    period_until: "Do {date}",
    period_from: "Od {date}",
    schedule_options: "Možnosti",
    tab_slot: "Interval",
    tab_schedule: "Plán",
    tab_options: "Možnosti",
    mode_time: "Čas",
    at_time: "O",
    sunrise: "Východ slnka",
    sunset: "Západ slnka",
    before: "Pred",
    after: "Po",
    offset: "Posun",
    approx_today: "≈ {time} dnes",
    days_daily: "Každý deň",
    days_workday: "Pracovné dni",
    days_weekend: "Víkend",
    days_custom: "Vlastné",
    days_workday_note: "Pracovné dni sa riadia senzorom Workday: sviatky sa preskakujú.",
    remove: "Odstrániť",
    tags: "Štítky",
    add_tag: "Pridať štítok",
    conditions: "Podmienky",
    cond_all: "Všetky",
    cond_any: "Ktorákoľvek",
    add_condition: "Pridať podmienku",
    cond_pick: "Vyberte hodnotu…",
    cond_other: "Iná hodnota…",
    match_is: "je",
    match_not: "nie je",
    match_below: "pod",
    match_above: "nad",
    cond_is: "{entity} je {value}",
    cond_not: "{entity} nie je {value}",
    cond_below: "{entity} pod {value}",
    cond_above: "{entity} nad {value}",
    track_conditions: "Spustiť akciu hneď, ako sú splnené",
    period: "Obdobie",
    period_hint: "Len medzi dvoma dátumami",
    date_from: "Od",
    date_to: "Do",
    after_last: "Po poslednom intervale",
    repeat_repeat: "Opakovať",
    repeat_stop: "Zastaviť",
    repeat_delete: "Odstrániť",
    repeat_hint: "Zastaviť vypne plán, Odstrániť ho zmaže, po jeho poslednom intervale.",
    repeat_pause_badge: "Raz · potom stop",
    repeat_single_badge: "Raz · potom zmazanie",
    duplicate: "Duplikovať",
    copy_name: "{name} (kópia)",
    split: "Rozdeliť",
    merge_next: "Zlúčiť s ďalším",
    kind: "Druh",
    kind_slots: "Časové intervaly",
    kind_single: "Jeden čas",
    kind_slots_hint: "Začiatok a koniec: akcia platí počas intervalu.",
    kind_single_hint: "Jedna akcia v pevnom čase, napr. vypnúť o 23:00.",
    entities: "Entity",
    add_entity: "Pridať entitu rovnakého druhu",
    change_entities: "Zmeniť",
    entities_note: "Platia pre celý plán, rovnako ako dni.",
    show_entities: "Entity na dlaždiciach",
    err_condition: "Vyplňte alebo odstráňte každú podmienku.",
    err_dates: "Dátum konca musí byť po dátume začiatku.",
    show_badges: "Odznaky",
    show_condition_status: "Stav podmienok",
    condition_status_animation: "Pulzovanie, keď sú podmienky splnené",
    cstat_met: "Podmienky splnené",
    cstat_wait: "Čaká na svoje podmienky",
    cstat_skip: "Preskočené: podmienky nesplnené",
    cstat_unavailable: "nedostupné",
    sort_by: "Zoradenie",
    sort_name: "Názov",
    sort_next: "Ďalšia akcia",
    sort_state: "Bežiace najprv",
    time_step: "Časový krok",
    exclude_tags: "Skryté štítky",
  },
  cs: {
    schedules: "Plány",
    enabled_one: "{n} zapnutý",
    enabled_few: "{n} zapnuté",
    enabled_many: "{n} zapnutých",
    enabled_other: "{n} zapnutých",
    disabled_one: "{n} vypnutý",
    disabled_few: "{n} vypnuté",
    disabled_many: "{n} vypnutých",
    disabled_other: "{n} vypnutých",
    now_hint: "Červená čára = teď",
    next_time: "Další {time}",
    new_schedule: "Nový plán",
    state_disabled: "Vypnutý",
    state_enabled: "Zapnutý",
    state_completed: "Dokončený",
    value_now: "{value} nyní",
    until: "do {time}",
    action_at: "{action} v {time}",
    action_on_day: "{action} {day} v {time}",
    done_today: "Dnes hotovo",
    next_lower: "další {time}",
    no_upcoming: "Žádná nadcházející akce",
    week_total: "{value} {h} h / týden",
    week_total_all: "{h} h / týden",
    default_value: "{value} (výchozí)",
    back: "Zpět na dnešní časovou osu",
    no_entities: "Nebyly nalezeny žádné plány. Je nainstalována komponenta Scheduler?",
    no_match: "Filtrům karty neodpovídá žádný plán.",
    act_on: "Zapnout",
    act_off: "Vypnout",
    act_open: "Otevřít",
    act_close: "Zavřít",
    act_stop: "Zastavit",
    act_lock: "Zamknout",
    act_unlock: "Odemknout",
    act_run: "Spustit",
    act_activate: "Aktivovat",
    act_start: "Začít",
    act_dock: "Zpět na základnu",
    act_play: "Přehrát",
    act_pause: "Pauza",
    act_toggle: "Přepnout",
    act_temperature: "Teplota",
    act_position: "Poloha",
    act_value: "Hodnota",
    edit_slot: "Upravit interval",
    add_slot: "Přidat interval",
    start: "Začátek",
    end: "Konec",
    end_hint: "Ponechte prázdné pro jednorázovou akci",
    action: "Akce",
    days: "Dny",
    days_note: "Dny platí pro celý plán.",
    name: "Název",
    entity: "Entita",
    save: "Uložit",
    cancel: "Zrušit",
    close: "Zavřít",
    delete_slot: "Smazat interval",
    delete_schedule: "Smazat plán",
    confirm_delete: "Smazat?",
    loading: "Načítání…",
    err_overlap: "Tento interval se překrývá s jiným.",
    err_same: "Konec se musí lišit od začátku.",
    err_time: "Zadejte čas začátku.",
    err_entity: "Vyberte entitu.",
    err_action: "Vyberte akci.",
    err_days: "Vyberte alespoň jeden den.",
    err_load: "Plán se nepodařilo načíst.",
    err_save: "Uložení se nezdařilo: {error}",
    zoom_in: "Zobrazit celou kartu",
    zoom_out: "Zpět na kompaktní zobrazení",
    status_active: "Probíhá",
    status_idle: "Nečinné",
    status_warn: "Žádný plán",
    title: "Název",
    illustration: "Ilustrace",
    illustration_theme: "Motiv ilustrace",
    theme_auto: "Automaticky (podle motivu)",
    theme_day: "Den",
    theme_night: "Noc",
    show_disabled: "Vypnuté plány",
    editable: "Úprava intervalů",
    show_header_toggle: "Přepínač všech plánů",
    all_on: "Zapnout vše",
    all_off: "Vypnout vše",
    err_toggle: "Nepodařilo se změnit {count} z {total} plánů",
    next_actions: "Nadcházející akce",
    zoom: "Tlačítko podrobností",
    language: "Jazyk",
    lang_auto: "Automaticky",
    starts_on: "Začíná {date}",
    period_range: "{from} → {to}",
    period_until: "Do {date}",
    period_from: "Od {date}",
    schedule_options: "Možnosti",
    tab_slot: "Interval",
    tab_schedule: "Plán",
    tab_options: "Možnosti",
    mode_time: "Čas",
    at_time: "V",
    sunrise: "Východ slunce",
    sunset: "Západ slunce",
    before: "Před",
    after: "Po",
    offset: "Posun",
    approx_today: "≈ {time} dnes",
    days_daily: "Každý den",
    days_workday: "Pracovní dny",
    days_weekend: "Víkend",
    days_custom: "Vlastní",
    days_workday_note: "Pracovní dny se řídí senzorem Workday: svátky se přeskakují.",
    remove: "Odebrat",
    tags: "Štítky",
    add_tag: "Přidat štítek",
    conditions: "Podmínky",
    cond_all: "Všechny",
    cond_any: "Kterákoli",
    add_condition: "Přidat podmínku",
    cond_pick: "Vyberte hodnotu…",
    cond_other: "Jiná hodnota…",
    match_is: "je",
    match_not: "není",
    match_below: "pod",
    match_above: "nad",
    cond_is: "{entity} je {value}",
    cond_not: "{entity} není {value}",
    cond_below: "{entity} pod {value}",
    cond_above: "{entity} nad {value}",
    track_conditions: "Spustit akci, jakmile jsou splněny",
    period: "Období",
    period_hint: "Jen mezi dvěma daty",
    date_from: "Od",
    date_to: "Do",
    after_last: "Po posledním intervalu",
    repeat_repeat: "Opakovat",
    repeat_stop: "Zastavit",
    repeat_delete: "Smazat",
    repeat_hint: "Zastavit vypne plán, Smazat ho odstraní, po jeho posledním intervalu.",
    repeat_pause_badge: "Jednou · pak stop",
    repeat_single_badge: "Jednou · pak smazání",
    duplicate: "Duplikovat",
    copy_name: "{name} (kopie)",
    split: "Rozdělit",
    merge_next: "Sloučit s dalším",
    kind: "Druh",
    kind_slots: "Časové intervaly",
    kind_single: "Jeden čas",
    kind_slots_hint: "Začátek a konec: akce platí po celý interval.",
    kind_single_hint: "Jedna akce v pevný čas, např. vypnout ve 23:00.",
    entities: "Entity",
    add_entity: "Přidat entitu stejného druhu",
    change_entities: "Změnit",
    entities_note: "Platí pro celý plán, stejně jako dny.",
    show_entities: "Entity na dlaždicích",
    err_condition: "Vyplňte nebo odeberte každou podmínku.",
    err_dates: "Datum konce musí být po datu začátku.",
    show_badges: "Odznaky",
    show_condition_status: "Stav podmínek",
    condition_status_animation: "Pulzování, když jsou podmínky splněny",
    cstat_met: "Podmínky splněny",
    cstat_wait: "Čeká na své podmínky",
    cstat_skip: "Přeskočeno: podmínky nesplněny",
    cstat_unavailable: "nedostupné",
    sort_by: "Řazení",
    sort_name: "Název",
    sort_next: "Další akce",
    sort_state: "Běžící nejdřív",
    time_step: "Časový krok",
    exclude_tags: "Skryté štítky",
  },
  sl: {
    schedules: "Urniki",
    enabled_one: "{n} vklopljen",
    enabled_two: "{n} vklopljena",
    enabled_few: "{n} vklopljeni",
    enabled_other: "{n} vklopljenih",
    disabled_one: "{n} izklopljen",
    disabled_two: "{n} izklopljena",
    disabled_few: "{n} izklopljeni",
    disabled_other: "{n} izklopljenih",
    now_hint: "Rdeča črta = zdaj",
    next_time: "Naslednje {time}",
    new_schedule: "Nov urnik",
    state_disabled: "Izklopljen",
    state_enabled: "Vklopljen",
    state_completed: "Končan",
    value_now: "{value} zdaj",
    until: "do {time}",
    action_at: "{action} ob {time}",
    action_on_day: "{action} {day} ob {time}",
    done_today: "Danes opravljeno",
    next_lower: "naslednje {time}",
    no_upcoming: "Ni prihajajočih dejanj",
    week_total: "{value} {h} h / teden",
    week_total_all: "{h} h / teden",
    default_value: "{value} (privzeto)",
    back: "Nazaj na današnjo časovnico",
    no_entities: "Ni najdenih urnikov. Ali je komponenta Scheduler nameščena?",
    no_match: "Noben urnik ne ustreza filtrom kartice.",
    act_on: "Vklopi",
    act_off: "Izklopi",
    act_open: "Odpri",
    act_close: "Zapri",
    act_stop: "Ustavi",
    act_lock: "Zakleni",
    act_unlock: "Odkleni",
    act_run: "Zaženi",
    act_activate: "Aktiviraj",
    act_start: "Začni",
    act_dock: "Nazaj na bazo",
    act_play: "Predvajaj",
    act_pause: "Premor",
    act_toggle: "Preklopi",
    act_temperature: "Temperatura",
    act_position: "Položaj",
    act_value: "Vrednost",
    edit_slot: "Uredi interval",
    add_slot: "Dodaj interval",
    start: "Začetek",
    end: "Konec",
    end_hint: "Pustite prazno za enkratno dejanje",
    action: "Dejanje",
    days: "Dnevi",
    days_note: "Dnevi veljajo za celoten urnik.",
    name: "Ime",
    entity: "Entiteta",
    save: "Shrani",
    cancel: "Prekliči",
    close: "Zapri",
    delete_slot: "Izbriši interval",
    delete_schedule: "Izbriši urnik",
    confirm_delete: "Izbrišem?",
    loading: "Nalaganje…",
    err_overlap: "Ta interval se prekriva z drugim.",
    err_same: "Konec se mora razlikovati od začetka.",
    err_time: "Vnesite čas začetka.",
    err_entity: "Izberite entiteto.",
    err_action: "Izberite dejanje.",
    err_days: "Izberite vsaj en dan.",
    err_load: "Urnika ni bilo mogoče naložiti.",
    err_save: "Shranjevanje ni uspelo: {error}",
    zoom_in: "Prikaži celotno kartico",
    zoom_out: "Nazaj na strnjen prikaz",
    status_active: "Poteka",
    status_idle: "Nedejavno",
    status_warn: "Ni urnika",
    title: "Naslov",
    illustration: "Ilustracija",
    illustration_theme: "Tema ilustracije",
    theme_auto: "Samodejno (sledi temi)",
    theme_day: "Dan",
    theme_night: "Noč",
    show_disabled: "Izklopljeni urniki",
    editable: "Urejanje intervalov",
    show_header_toggle: "Stikalo za vse urnike",
    all_on: "Vklopi vse",
    all_off: "Izklopi vse",
    err_toggle: "{count} od {total} urnikov ni bilo mogoče spremeniti",
    next_actions: "Prihajajoča dejanja",
    zoom: "Gumb za podrobnosti",
    language: "Jezik",
    lang_auto: "Samodejno",
    starts_on: "Začne se {date}",
    period_range: "{from} → {to}",
    period_until: "Do {date}",
    period_from: "Od {date}",
    schedule_options: "Možnosti",
    tab_slot: "Termin",
    tab_schedule: "Urnik",
    tab_options: "Možnosti",
    mode_time: "Čas",
    at_time: "Ob",
    sunrise: "Sončni vzhod",
    sunset: "Sončni zahod",
    before: "Pred",
    after: "Po",
    offset: "Zamik",
    approx_today: "≈ {time} danes",
    days_daily: "Vsak dan",
    days_workday: "Delovni dnevi",
    days_weekend: "Vikend",
    days_custom: "Po meri",
    days_workday_note: "Delovni dnevi sledijo senzorju Workday: prazniki se preskočijo.",
    remove: "Odstrani",
    tags: "Oznake",
    add_tag: "Dodaj oznako",
    conditions: "Pogoji",
    cond_all: "Vsi",
    cond_any: "Kateri koli",
    add_condition: "Dodaj pogoj",
    cond_pick: "Izberite vrednost…",
    cond_other: "Druga vrednost…",
    match_is: "je",
    match_not: "ni",
    match_below: "pod",
    match_above: "nad",
    cond_is: "{entity} je {value}",
    cond_not: "{entity} ni {value}",
    cond_below: "{entity} pod {value}",
    cond_above: "{entity} nad {value}",
    track_conditions: "Izvedi dejanje takoj, ko so izpolnjeni",
    period: "Obdobje",
    period_hint: "Samo med dvema datumoma",
    date_from: "Od",
    date_to: "Do",
    after_last: "Po zadnjem terminu",
    repeat_repeat: "Ponavljaj",
    repeat_stop: "Ustavi",
    repeat_delete: "Izbriši",
    repeat_hint: "Ustavi onemogoči urnik, Izbriši ga odstrani, po zadnjem terminu.",
    repeat_pause_badge: "Enkrat · nato ustavitev",
    repeat_single_badge: "Enkrat · nato izbris",
    duplicate: "Podvoji",
    copy_name: "{name} (kopija)",
    split: "Razdeli",
    merge_next: "Združi z naslednjim",
    kind: "Vrsta",
    kind_slots: "Termini",
    kind_single: "En čas",
    kind_slots_hint: "Začetek in konec: dejanje velja ves termin.",
    kind_single_hint: "Eno dejanje ob določenem času, npr. izklop ob 23:00.",
    entities: "Entitete",
    add_entity: "Dodaj entiteto iste vrste",
    change_entities: "Spremeni",
    entities_note: "Veljajo za ves urnik, tako kot dnevi.",
    show_entities: "Entitete na ploščicah",
    err_condition: "Izpolnite ali odstranite vsak pogoj.",
    err_dates: "Končni datum mora biti po začetnem.",
    show_badges: "Značke",
    show_condition_status: "Stanje pogojev",
    condition_status_animation: "Utripanje, ko so pogoji izpolnjeni",
    cstat_met: "Pogoji izpolnjeni",
    cstat_wait: "Čaka na svoje pogoje",
    cstat_skip: "Preskočeno: pogoji niso izpolnjeni",
    cstat_unavailable: "ni na voljo",
    sort_by: "Razvrščanje",
    sort_name: "Ime",
    sort_next: "Naslednje dejanje",
    sort_state: "Aktivni najprej",
    time_step: "Časovni korak",
    exclude_tags: "Skrite oznake",
  },
  lv: {
    schedules: "Grafiki",
    enabled_zero: "{n} ieslēgti",
    enabled_one: "{n} ieslēgts",
    enabled_other: "{n} ieslēgti",
    disabled_zero: "{n} izslēgti",
    disabled_one: "{n} izslēgts",
    disabled_other: "{n} izslēgti",
    now_hint: "Sarkanā līnija = tagad",
    next_time: "Nākamais {time}",
    new_schedule: "Jauns grafiks",
    state_disabled: "Izslēgts",
    state_enabled: "Ieslēgts",
    state_completed: "Pabeigts",
    value_now: "{value} tagad",
    until: "līdz {time}",
    action_at: "{action} plkst. {time}",
    action_on_day: "{action} {day} plkst. {time}",
    done_today: "Šodien izpildīts",
    next_lower: "nākamais {time}",
    no_upcoming: "Nav gaidāmu darbību",
    week_total: "{value} {h} h / nedēļā",
    week_total_all: "{h} h / nedēļā",
    default_value: "{value} (noklusējums)",
    back: "Atpakaļ uz šodienas laika joslu",
    no_entities: "Grafiki nav atrasti. Vai komponents Scheduler ir instalēts?",
    no_match: "Neviens grafiks neatbilst kartītes filtriem.",
    act_on: "Ieslēgt",
    act_off: "Izslēgt",
    act_open: "Atvērt",
    act_close: "Aizvērt",
    act_stop: "Apturēt",
    act_lock: "Aizslēgt",
    act_unlock: "Atslēgt",
    act_run: "Palaist",
    act_activate: "Aktivizēt",
    act_start: "Sākt",
    act_dock: "Atpakaļ uz bāzi",
    act_play: "Atskaņot",
    act_pause: "Pauze",
    act_toggle: "Pārslēgt",
    act_temperature: "Temperatūra",
    act_position: "Pozīcija",
    act_value: "Vērtība",
    edit_slot: "Rediģēt intervālu",
    add_slot: "Pievienot intervālu",
    start: "Sākums",
    end: "Beigas",
    end_hint: "Atstājiet tukšu vienreizējai darbībai",
    action: "Darbība",
    days: "Dienas",
    days_note: "Dienas attiecas uz visu grafiku.",
    name: "Nosaukums",
    entity: "Entītija",
    save: "Saglabāt",
    cancel: "Atcelt",
    close: "Aizvērt",
    delete_slot: "Dzēst intervālu",
    delete_schedule: "Dzēst grafiku",
    confirm_delete: "Dzēst?",
    loading: "Ielādē…",
    err_overlap: "Šis intervāls pārklājas ar citu.",
    err_same: "Beigām jāatšķiras no sākuma.",
    err_time: "Ievadiet sākuma laiku.",
    err_entity: "Izvēlieties entītiju.",
    err_action: "Izvēlieties darbību.",
    err_days: "Izvēlieties vismaz vienu dienu.",
    err_load: "Grafiku neizdevās ielādēt.",
    err_save: "Neizdevās saglabāt: {error}",
    zoom_in: "Rādīt pilno kartīti",
    zoom_out: "Atpakaļ uz kompakto skatu",
    status_active: "Darbojas",
    status_idle: "Dīkstāvē",
    status_warn: "Nav grafika",
    title: "Virsraksts",
    illustration: "Ilustrācija",
    illustration_theme: "Ilustrācijas tēma",
    theme_auto: "Automātiski (atbilstoši tēmai)",
    theme_day: "Diena",
    theme_night: "Nakts",
    show_disabled: "Izslēgtie grafiki",
    editable: "Intervālu rediģēšana",
    show_header_toggle: "Visu grafiku slēdzis",
    all_on: "Ieslēgt visus",
    all_off: "Izslēgt visus",
    err_toggle: "Neizdevās mainīt {count} no {total} grafikiem",
    next_actions: "Gaidāmās darbības",
    zoom: "Detaļu poga",
    language: "Valoda",
    lang_auto: "Automātiski",
    starts_on: "Sākas {date}",
    period_range: "{from} → {to}",
    period_until: "Līdz {date}",
    period_from: "No {date}",
    schedule_options: "Opcijas",
    tab_slot: "Intervāls",
    tab_schedule: "Grafiks",
    tab_options: "Opcijas",
    mode_time: "Laiks",
    at_time: "Plkst.",
    sunrise: "Saullēkts",
    sunset: "Saulriets",
    before: "Pirms",
    after: "Pēc",
    offset: "Nobīde",
    approx_today: "≈ {time} šodien",
    days_daily: "Katru dienu",
    days_workday: "Darba dienas",
    days_weekend: "Nedēļas nogale",
    days_custom: "Pielāgots",
    days_workday_note: "Darba dienas seko Workday sensoram: svētku dienas tiek izlaistas.",
    remove: "Noņemt",
    tags: "Birkas",
    add_tag: "Pievienot birku",
    conditions: "Nosacījumi",
    cond_all: "Visi",
    cond_any: "Jebkurš",
    add_condition: "Pievienot nosacījumu",
    cond_pick: "Izvēlieties vērtību…",
    cond_other: "Cita vērtība…",
    match_is: "ir",
    match_not: "nav",
    match_below: "zem",
    match_above: "virs",
    cond_is: "{entity} ir {value}",
    cond_not: "{entity} nav {value}",
    cond_below: "{entity} zem {value}",
    cond_above: "{entity} virs {value}",
    track_conditions: "Izpildīt darbību, tiklīdz tie ir izpildīti",
    period: "Periods",
    period_hint: "Tikai starp diviem datumiem",
    date_from: "No",
    date_to: "Līdz",
    after_last: "Pēc pēdējā intervāla",
    repeat_repeat: "Atkārtot",
    repeat_stop: "Apturēt",
    repeat_delete: "Dzēst",
    repeat_hint: "Apturēt izslēdz grafiku, Dzēst to izdzēš pēc pēdējā intervāla.",
    repeat_pause_badge: "Vienreiz · tad stop",
    repeat_single_badge: "Vienreiz · tad dzēšana",
    duplicate: "Dublēt",
    copy_name: "{name} (kopija)",
    split: "Sadalīt",
    merge_next: "Apvienot ar nākamo",
    kind: "Veids",
    kind_slots: "Laika intervāli",
    kind_single: "Viens laiks",
    kind_slots_hint: "Sākums un beigas: darbība ilgst visu intervālu.",
    kind_single_hint: "Viena darbība noteiktā laikā, piem., izslēgt 23:00.",
    entities: "Entītijas",
    add_entity: "Pievienot tāda paša veida entītiju",
    change_entities: "Mainīt",
    entities_note: "Tās attiecas uz visu grafiku, tāpat kā dienas.",
    show_entities: "Entītijas uz flīzēm",
    err_condition: "Aizpildiet vai noņemiet katru nosacījumu.",
    err_dates: "Beigu datumam jābūt pēc sākuma datuma.",
    show_badges: "Žetoni",
    show_condition_status: "Nosacījumu stāvoklis",
    condition_status_animation: "Pulsēt, kad nosacījumi ir izpildīti",
    cstat_met: "Nosacījumi izpildīti",
    cstat_wait: "Gaida savus nosacījumus",
    cstat_skip: "Izlaists: nosacījumi nav izpildīti",
    cstat_unavailable: "nav pieejams",
    sort_by: "Kārtošana",
    sort_name: "Nosaukums",
    sort_next: "Nākamā darbība",
    sort_state: "Aktīvie vispirms",
    time_step: "Laika solis",
    exclude_tags: "Slēptās birkas",
  },
  el: {
    schedules: "Προγράμματα",
    enabled_one: "{n} ενεργό",
    enabled_other: "{n} ενεργά",
    disabled_one: "{n} ανενεργό",
    disabled_other: "{n} ανενεργά",
    now_hint: "Κόκκινη γραμμή = τώρα",
    next_time: "Επόμενο {time}",
    new_schedule: "Νέο πρόγραμμα",
    state_disabled: "Απενεργοποιημένο",
    state_enabled: "Ενεργοποιημένο",
    state_completed: "Ολοκληρώθηκε",
    value_now: "{value} τώρα",
    until: "έως {time}",
    action_at: "{action} στις {time}",
    action_on_day: "{action} {day} στις {time}",
    done_today: "Ολοκληρώθηκε σήμερα",
    next_lower: "επόμενο {time}",
    no_upcoming: "Καμία επερχόμενη ενέργεια",
    week_total: "{value} {h} ώ / εβδομάδα",
    week_total_all: "{h} ώ / εβδομάδα",
    default_value: "{value} (προεπιλογή)",
    back: "Πίσω στη σημερινή γραμμή χρόνου",
    no_entities: "Δεν βρέθηκαν προγράμματα. Είναι εγκατεστημένο το στοιχείο Scheduler;",
    no_match: "Κανένα πρόγραμμα δεν ταιριάζει με τα φίλτρα της κάρτας.",
    act_on: "Ενεργοποίηση",
    act_off: "Απενεργοποίηση",
    act_open: "Άνοιγμα",
    act_close: "Κλείσιμο",
    act_stop: "Διακοπή",
    act_lock: "Κλείδωμα",
    act_unlock: "Ξεκλείδωμα",
    act_run: "Εκτέλεση",
    act_activate: "Ενεργοποίηση",
    act_start: "Έναρξη",
    act_dock: "Επιστροφή στη βάση",
    act_play: "Αναπαραγωγή",
    act_pause: "Παύση",
    act_toggle: "Εναλλαγή",
    act_temperature: "Θερμοκρασία",
    act_position: "Θέση",
    act_value: "Τιμή",
    edit_slot: "Επεξεργασία διαστήματος",
    add_slot: "Προσθήκη διαστήματος",
    start: "Έναρξη",
    end: "Λήξη",
    end_hint: "Αφήστε κενό για μία μεμονωμένη ενέργεια",
    action: "Ενέργεια",
    days: "Ημέρες",
    days_note: "Οι ημέρες ισχύουν για όλο το πρόγραμμα.",
    name: "Όνομα",
    entity: "Οντότητα",
    save: "Αποθήκευση",
    cancel: "Ακύρωση",
    close: "Κλείσιμο",
    delete_slot: "Διαγραφή διαστήματος",
    delete_schedule: "Διαγραφή προγράμματος",
    confirm_delete: "Διαγραφή;",
    loading: "Φόρτωση…",
    err_overlap: "Αυτό το διάστημα επικαλύπτεται με άλλο.",
    err_same: "Η λήξη πρέπει να διαφέρει από την έναρξη.",
    err_time: "Εισαγάγετε ώρα έναρξης.",
    err_entity: "Επιλέξτε οντότητα.",
    err_action: "Επιλέξτε ενέργεια.",
    err_days: "Επιλέξτε τουλάχιστον μία ημέρα.",
    err_load: "Δεν ήταν δυνατή η φόρτωση του προγράμματος.",
    err_save: "Η αποθήκευση απέτυχε: {error}",
    zoom_in: "Εμφάνιση πλήρους κάρτας",
    zoom_out: "Επιστροφή στη συμπαγή προβολή",
    status_active: "Σε εξέλιξη",
    status_idle: "Αδρανές",
    status_warn: "Κανένα πρόγραμμα",
    title: "Τίτλος",
    illustration: "Εικονογράφηση",
    illustration_theme: "Θέμα εικονογράφησης",
    theme_auto: "Αυτόματο (ακολουθεί το θέμα)",
    theme_day: "Ημέρα",
    theme_night: "Νύχτα",
    show_disabled: "Απενεργοποιημένα προγράμματα",
    editable: "Επεξεργασία διαστημάτων",
    show_header_toggle: "Διακόπτης όλων των προγραμμάτων",
    all_on: "Ενεργοποίηση όλων",
    all_off: "Απενεργοποίηση όλων",
    err_toggle: "Δεν ήταν δυνατή η αλλαγή {count} από {total} προγράμματα",
    next_actions: "Επερχόμενες ενέργειες",
    zoom: "Κουμπί λεπτομερειών",
    language: "Γλώσσα",
    lang_auto: "Αυτόματα",
    starts_on: "Ξεκινά {date}",
    period_range: "{from} → {to}",
    period_until: "Έως {date}",
    period_from: "Από {date}",
    schedule_options: "Επιλογές",
    tab_slot: "Διάστημα",
    tab_schedule: "Πρόγραμμα",
    tab_options: "Επιλογές",
    mode_time: "Ώρα",
    at_time: "Στις",
    sunrise: "Ανατολή",
    sunset: "Δύση",
    before: "Πριν",
    after: "Μετά",
    offset: "Μετατόπιση",
    approx_today: "≈ {time} σήμερα",
    days_daily: "Κάθε μέρα",
    days_workday: "Εργάσιμες",
    days_weekend: "Σαββατοκύριακο",
    days_custom: "Προσαρμογή",
    days_workday_note: "Οι εργάσιμες ακολουθούν τον αισθητήρα Workday: οι αργίες παραλείπονται.",
    remove: "Αφαίρεση",
    tags: "Ετικέτες",
    add_tag: "Προσθήκη ετικέτας",
    conditions: "Συνθήκες",
    cond_all: "Όλες",
    cond_any: "Οποιαδήποτε",
    add_condition: "Προσθήκη συνθήκης",
    cond_pick: "Επιλέξτε τιμή…",
    cond_other: "Άλλη τιμή…",
    match_is: "είναι",
    match_not: "δεν είναι",
    match_below: "κάτω από",
    match_above: "πάνω από",
    cond_is: "{entity} είναι {value}",
    cond_not: "{entity} δεν είναι {value}",
    cond_below: "{entity} κάτω από {value}",
    cond_above: "{entity} πάνω από {value}",
    track_conditions: "Εκτέλεση της ενέργειας μόλις ισχύσουν",
    period: "Περίοδος",
    period_hint: "Μόνο μεταξύ δύο ημερομηνιών",
    date_from: "Από",
    date_to: "Έως",
    after_last: "Μετά το τελευταίο διάστημα",
    repeat_repeat: "Επανάληψη",
    repeat_stop: "Διακοπή",
    repeat_delete: "Διαγραφή",
    repeat_hint: "Η Διακοπή απενεργοποιεί το πρόγραμμα, η Διαγραφή το αφαιρεί, μετά το τελευταίο διάστημα.",
    repeat_pause_badge: "Μία φορά · μετά διακοπή",
    repeat_single_badge: "Μία φορά · μετά διαγραφή",
    duplicate: "Αντίγραφο",
    copy_name: "{name} (αντίγραφο)",
    split: "Διαίρεση",
    merge_next: "Συγχώνευση με το επόμενο",
    kind: "Είδος",
    kind_slots: "Χρονικά διαστήματα",
    kind_single: "Μία ώρα",
    kind_slots_hint: "Αρχή και τέλος: η ενέργεια ισχύει όλο το διάστημα.",
    kind_single_hint: "Μία ενέργεια σε σταθερή ώρα, π.χ. απενεργοποίηση στις 23:00.",
    entities: "Οντότητες",
    add_entity: "Προσθήκη οντότητας ίδιου είδους",
    change_entities: "Αλλαγή",
    entities_note: "Ισχύουν για όλο το πρόγραμμα, όπως οι ημέρες.",
    show_entities: "Οντότητες στα πλακίδια",
    err_condition: "Συμπληρώστε ή αφαιρέστε κάθε συνθήκη.",
    err_dates: "Η ημερομηνία λήξης πρέπει να είναι μετά την έναρξη.",
    show_badges: "Σήματα",
    show_condition_status: "Κατάσταση συνθηκών",
    condition_status_animation: "Παλμός όταν πληρούνται οι συνθήκες",
    cstat_met: "Οι συνθήκες πληρούνται",
    cstat_wait: "Αναμένει τις συνθήκες του",
    cstat_skip: "Παραλείφθηκε: οι συνθήκες δεν πληρούνται",
    cstat_unavailable: "μη διαθέσιμο",
    sort_by: "Ταξινόμηση",
    sort_name: "Όνομα",
    sort_next: "Επόμενη ενέργεια",
    sort_state: "Ενεργά πρώτα",
    time_step: "Βήμα χρόνου",
    exclude_tags: "Κρυφές ετικέτες",
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const lang = (hass, config) => {
  const l = config?.language || (hass && (hass.locale?.language || hass.language)) || "en";
  return STRINGS[l] ? l : STRINGS[l.split("-")[0]] ? l.split("-")[0] : "en";
};

// Locale for Intl: Home Assistant's full locale when its base matches the card's resolved language (keeps the
// region, e.g. pt-BR or de-CH), otherwise the resolved language. Home Assistant's "pt" is European Portuguese,
// which Intl would format as Brazilian, so bare "pt" becomes "pt-PT".
const fmtLang = (hass, config) => {
  const l = lang(hass, config);
  const ha = hass && (hass.locale?.language || hass.language);
  const loc = ha && ha.split("-")[0] === l.split("-")[0] && l !== "sr-Latn" ? ha : l;
  return loc === "pt" ? "pt-PT" : loc;
};

// A text of the card's language, English when missing, with its {placeholders} filled.
const t = (hass, config, key, vars = {}) => {
  const s = STRINGS[lang(hass, config)][key] ?? STRINGS.en[key] ?? key;
  return String(s).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
};

// "4 enabled": the plural form of the card's language (Intl.PluralRules), the `_other` form when the language has
// no text for that form.
const plural = (hass, config, key, n) => {
  let cat = "other";
  try {
    cat = new Intl.PluralRules(fmtLang(hass, config)).select(n);
  } catch (_e) {
    /* default form */
  }
  const table = STRINGS[lang(hass, config)];
  const k = `${key}_${cat}` in table ? `${key}_${cat}` : `${key}_other`;
  return t(hass, config, k, { n });
};

// The whole width of an element's text in its own font, an ellipsised one included.
const textWidth = (el) => {
  const range = document.createRange();
  range.selectNodeContents(el);
  return range.getBoundingClientRect().width;
};

const svgIcon = (path, cls = "") => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;
const num = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const cap = (s) => {
  const v = String(s ?? "").replace(/_/g, " ");
  return v.charAt(0).toUpperCase() + v.slice(1);
};
const domainOf = (id) => String(id || "").split(".")[0];

// ---------------------------------------------------------------------------
// Time: minutes of the day in Home Assistant's time zone
// ---------------------------------------------------------------------------

const DAY = 1440;
const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const _zoneFmt = new Map();
// The time zone of the dates: the server's, unless the user chose the browser's.
const tzOf = (hass) => (hass?.locale?.time_zone === "local" ? undefined : hass?.config?.time_zone) || undefined;

// A moment (ms) in a time zone: its weekday (0 = Monday), its minute of the day and its date.
const zoned = (ms, tz) => {
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
const sunTimes = (hass) => {
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
const parseTime = (s, sun = { rise: 420, set: 1140 }) => {
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

const hm = (min) => {
  const v = ((Math.round(min) % DAY) + DAY) % DAY;
  return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
};

// ---------------------------------------------------------------------------
// Schedules (switch.schedule_* entities of the Scheduler component)
// ---------------------------------------------------------------------------

const PLATFORM = "scheduler";

// The schedule entities: the scheduler platform's registry entries, else (no registry, or none of them in it, as in
// some setups) any switch.schedule_* entity carrying the component's attributes. The registry scan is kept per
// registry object: the card looks its schedules up on every state change, which should not walk every entity and
// every state each time.
const _scheduleIds = new WeakMap();
const discover = (hass) => {
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
const WORKDAY_ENTITY = "binary_sensor.workday_sensor";
const workdaysOf = (hass) => {
  const w = hass?.states?.[WORKDAY_ENTITY]?.attributes?.workdays;
  const days = Array.isArray(w) ? w.map((d) => WEEKDAYS.indexOf(String(d).toLowerCase())).filter((d) => d >= 0) : [];
  return days.length ? days : [0, 1, 2, 3, 4];
};

// Does a schedule run on weekday `wd`? `today` uses the workday sensor's state for workday / weekend schedules.
const runsOn = (weekdays, wd, hass, today = false) => {
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
const slotsOf = (attrs, sun) =>
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

// ---------------------------------------------------------------------------
// Actions: what a slot does, in words, and its colour
// ---------------------------------------------------------------------------

const OFF_COLOR = "#9e9e9e";
const ACCENT = "#0f8b8d";
const DOMAIN_COLORS = {
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
const DOMAIN_ICONS = {
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
const PRESET_COLORS = { comfort: "#ff9800", home: "#ff9800", boost: "#f4511e", eco: "#00acc1", away: "#78909c", sleep: "#5c6bc0", frost_protection: "#4fc3f7", none: OFF_COLOR };
const PALETTE = ["#7e57c2", "#ec407a", "#43a047", "#5c6bc0", "#8d6e63"];
const COOL = "#00acc1";

// A stable key for an action (service and data, keys sorted).
const actionKey = (service, data) => {
  const d = data && typeof data === "object" ? data : {};
  return `${service}|${JSON.stringify(Object.fromEntries(Object.keys(d).sort().map((k) => [k, d[k]])))}`;
};

const fmtNum = (v, loc) => {
  try {
    return new Intl.NumberFormat(loc, { maximumFractionDigits: 1 }).format(Number(v));
  } catch (_e) {
    return String(v);
  }
};

// What an action does: `label` (« 20 °C », « On 60 % », « Comfort »), `short` (the grid's block: « 20° »),
// `verb` (a built-in word, lowered inside a sentence), `off` (turns something off, closes it), `num` (a temperature).
const actionInfo = (hass, tr, loc, action, entityId) => {
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
const valueColors = (infos, base) => {
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
const segmentsOf = (slots, infos) => {
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
const defaultValue = (slots, infos) => {
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
const scheduleModel = (hass, config, id, tr, loc, item = null) => {
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
const SPECIAL_TAGS = ["none", "enabled", "disabled"];
const listOf = (v) => (Array.isArray(v) ? v.map(String) : v !== undefined && v !== null && v !== "" ? [String(v)] : []);
const pickSchedules = (models, config = {}, rank = null) => {
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
const toggleTargets = (models, config = {}) =>
  pickSchedules(models, { ...config, show_disabled: true, tags: listOf(config.tags).filter((x) => x !== "enabled" && x !== "disabled") });

// The tags a new schedule gets from the card: its own, the special values left out.
const cardTags = (config = {}) => listOf(config.tags).filter((x) => !SPECIAL_TAGS.includes(x));

// The next starts of a schedule's slots, from `now` ({ wd, min }) over the next `days` days.
const occurrences = (m, now, hass, days = 8) => {
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
const upcoming = (models, now, hass, n = 3) =>
  models
    .filter((m) => m.enabled)
    .flatMap((m) => occurrences(m, now, hass).slice(0, n))
    .sort((a, b) => a.at - b.at || a.m.name.localeCompare(b.m.name))
    .slice(0, n);

// Whether a condition of the scheduler component holds now: is / not / below / above, on the entity's state (or
// its `attribute`; the component stores `attribute: "state"` for the state itself). An unavailable or unknown entity,
// or a missing attribute, does not meet it.
const condMet = (hass, c) => {
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
const condState = (hass, m, now) => {
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
const daySegments = (m) => segmentsOf(m.slots, m.infos);

// Total time per value over a week (minutes), the background value left out.
const weekTotals = (m, hass, def) => {
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
const cleanSlot = (s) => {
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
const scheduleEntities = (item) => {
  const out = [];
  for (const ts of Array.isArray(item?.timeslots) ? item.timeslots : [])
    for (const a of Array.isArray(ts?.actions) ? ts.actions : []) if (a?.entity_id && !out.includes(a.entity_id)) out.push(a.entity_id);
  return out;
};

// A slot's actions on the schedule's new entities `ents` (#23; `prev`: its entities before): each kept entity keeps
// its own action, an added one takes the action of the slot's first entity (a slot that acted on only some of the
// entities keeps acting on those); actions without an entity are kept as they are.
const remapActions = (actions, ents, prev = []) => {
  const list = Array.isArray(actions) ? actions : [];
  const withId = list.filter((a) => a?.entity_id);
  if (!withId.length || !ents.length) return list;
  const byId = new Map(withId.map((a) => [a.entity_id, a]));
  const kept = ents.filter((id) => byId.has(id) || !prev.includes(id));
  return [...(kept.length ? kept : ents).map((id) => byId.get(id) || { ...withId[0], entity_id: id }), ...list.filter((a) => !a?.entity_id)];
};

// A timeslot's start and end (minutes; an end at midnight closes the day; null without an end).
const slotRange = (s, sun) => {
  const a = parseTime(s.start, sun)?.min ?? 0;
  const b = s.stop ? (parseTime(s.stop, sun)?.min ?? a) : null;
  return [a, b === null ? null : b === 0 && a > 0 ? DAY : b];
};

// Does timeslot `k` run into another one (same start, or ranges crossing, over midnight too)?
const slotsClash = (slots, k, sun) => {
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
const weekdaysPayload = (days, original, hass) => {
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
const splitTime = (raw, sun) => {
  const str = String(raw ?? "").trim();
  const r = /^(sunrise|sunset)([+-])(\d{1,2}):(\d{2})/.exec(str);
  if (r) return { mode: r[1], sign: r[2], off: `${r[3].padStart(2, "0")}:${r[4]}`, time: hm(parseTime(str, sun).min) };
  const p = str ? parseTime(str, sun) : null;
  return { mode: "time", sign: "-", off: "00:00", time: p ? hm(p.min) : "" };
};

// The time the component stores: "07:30:00", or "sunset-00:30:00" relative to the sun ("" when no fixed time).
const joinTime = (mode, time, sign, off) => {
  if (mode === "sunrise" || mode === "sunset") {
    const o = /^(\d{1,2}):(\d{2})$/.exec(String(off || "").trim());
    return `${mode}${sign === "+" ? "+" : "-"}${o ? `${o[1].padStart(2, "0")}:${o[2]}` : "00:00"}:00`;
  }
  return time ? `${time}:00` : "";
};

// The editable options of a schedule (the same for all its slots): name, tags, conditions (from its first slot),
// the dates it runs between and what it does after its last slot.
const MATCH_TYPES = ["is", "not", "below", "above"];
const REPEAT_TYPES = ["repeat", "pause", "single"];
const optionsOf = (item = {}) => {
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
const conditionsPayload = (o) => {
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
const withConditions = (slots, o, conds) =>
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
const actionVars = (vars) => {
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
const customActions = (config, entityId) => {
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
const tidy = (n) => Math.round(n * 1e6) / 1e6;
const sameValue = (a, b) => JSON.stringify(a) === JSON.stringify(b) || (num(a) !== null && num(a) === num(b) && typeof a !== "boolean" && typeof b !== "boolean");

// The editor's values of an action with variables, read from a stored action's data: `{ vals, keep }` (`keep`:
// the data the action does not set, kept as is), or null when the stored action is not this one.
const matchVars = (opt, service, data) => {
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
const varDefaults = (opt, prev = {}) => {
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
const varsData = (opt, vals = {}, keep = {}) => {
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
const pickable = (hass, config = {}) => {
  const inc = listOf(config.include);
  const exc = listOf(config.exclude);
  return Object.keys(hass?.states || {})
    .filter((id) => (inc.length ? matchesAny(id, inc) : ACTION_DOMAINS.includes(domainOf(id))))
    .filter((id) => !matchesAny(id, exc) && !id.startsWith("switch.schedule_"))
    .sort();
};

// Does an entity id match one of these patterns: an entity id, a domain, or a pattern with `*` wildcards
// ("sensor.*_temperature", "binary_sensor.bedroom_*")?
const globRe = (p) => new RegExp("^" + p.replace(/[.+?^$|()[\]{}\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
const matchesAny = (id, patterns) =>
  patterns.some((p) => (p.includes("*") ? globRe(p).test(id) : p.includes(".") ? p === id : p === domainOf(id)));

// The entities offered for a condition: every entity, narrowed by `condition_include` and `condition_exclude`
// (entity ids, domains or wildcards), independently of `include` / `exclude`.
const conditionPickable = (hass, config = {}) => {
  const inc = listOf(config.condition_include);
  const exc = listOf(config.condition_exclude);
  return Object.keys(hass?.states || {})
    .filter((id) => (!inc.length || matchesAny(id, inc)) && !matchesAny(id, exc))
    .sort();
};

// The states of a few domains, for a condition's value.
const ON_OFF_DOMAINS = ["binary_sensor", "input_boolean", "switch", "light", "fan", "automation", "humidifier", "siren", "remote", "script"];
const DOMAIN_STATES = {
  sun: ["above_horizon", "below_horizon"],
  cover: ["open", "closed", "opening", "closing"],
  valve: ["open", "closed", "opening", "closing"],
  lock: ["locked", "unlocked", "locking", "unlocking", "jammed", "open"],
  alarm_control_panel: ["disarmed", "armed_home", "armed_away", "armed_night", "armed_vacation", "armed_custom_bypass", "pending", "arming", "triggered"],
  media_player: ["on", "off", "playing", "paused", "idle", "standby", "buffering"],
  vacuum: ["cleaning", "docked", "returning", "idle", "paused", "error"],
  lawn_mower: ["mowing", "docked", "paused", "returning", "error"],
};
const NUMBER_DOMAINS = ["input_number", "number", "counter"];
// The « Other value… » choice of a condition's list of states: a free value instead.
const OTHER_VALUE = "__sc_other__";

// The value a condition on an entity takes: { kind: "list", values: [{ value, name }] } (its known states),
// { kind: "number", min, max, step, unit }, or null (a free value). `condition_states` (by entity id, wildcard or
// domain: a list of states — strings or { value, name } — or { min, max, step, unit }) comes first.
const conditionValues = (hass, config, id) => {
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
const addDays = (date, d) => {
  const ms = Date.parse(`${date}T12:00:00Z`);
  return Number.isFinite(ms) ? new Date(ms + d * 86400000).toISOString().slice(0, 10) : date;
};

// The actions the editor offers for an entity: turning on and off, opening and closing, a temperature or a
// position to enter, a preset or an option to pick.
const domainActions = (hass, entityId) => {
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
const ACTION_DOMAINS = ["light", "switch", "input_boolean", "fan", "humidifier", "media_player", "automation", "water_heater", "cover", "valve", "climate", "input_number", "number", "select", "input_select", "lock", "vacuum", "script", "scene"];

// ---------------------------------------------------------------------------
// Shadow DOM patching (kept nodes keep their focus, hover, inputs and running animations)
// ---------------------------------------------------------------------------

const patchAttrs = (cur, next) => {
  for (const { name } of [...cur.attributes]) if (!next.hasAttribute(name)) cur.removeAttribute(name);
  for (const { name, value } of next.attributes) if (cur.getAttribute(name) !== value) cur.setAttribute(name, value);
};
const keyOf = (n) => (n.nodeType === 1 ? n.getAttribute("data-key") : null);
const sameNode = (a, b) => !!a && a.nodeType === b.nodeType && a.nodeName === b.nodeName;
const patchChildren = (cur, next) => {
  const old = [...cur.childNodes];
  const fresh = [...next.childNodes];
  const byKey = new Map();
  for (const o of old) {
    const k = keyOf(o);
    if (k !== null && !byKey.has(k)) byKey.set(k, o);
  }
  const used = new Set();
  fresh.forEach((n, i) => {
    const k = keyOf(n);
    let o = k !== null ? byKey.get(k) : old[i];
    if (!sameNode(o, n) || used.has(o) || (k === null && keyOf(o) !== null)) o = null;
    const ref = cur.childNodes[i] ?? null;
    if (!o) {
      cur.insertBefore(n, ref);
      return;
    }
    used.add(o);
    if (o !== ref) cur.insertBefore(o, ref);
    if (n.nodeType === 1) {
      patchAttrs(o, n);
      patchChildren(o, n);
    } else if (o.nodeValue !== n.nodeValue) o.nodeValue = n.nodeValue;
  });
  while (cur.childNodes.length > fresh.length) cur.removeChild(cur.lastChild);
};
const morph = (root, html) => {
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  patchChildren(root, tpl.content);
};

// A click inside a dialog (more-info opened from the card) is not a click outside the card.
const inDialog = (ev) => ev.composedPath().some((n) => ["ha-more-info-dialog", "ha-dialog", "dialog"].includes(n.localName));

// "A click elsewhere" is caught on the pointer, not only on the click event: on iOS (Safari and the companion app)
// a tap on something that is not clickable sends no click to the page. The handler runs when the press and the
// release are both outside the card; keyboard clicks (no click count) still go through the click event.
const watchOutside = (card, handler) => {
  let downOutside = false;
  const outside = (ev) => !ev.composedPath().includes(card);
  const onDown = (ev) => {
    downOutside = outside(ev);
  };
  const onUp = (ev) => {
    if (downOutside && outside(ev)) handler(ev);
    downOutside = false;
  };
  const onClick = (ev) => {
    if (ev.detail === 0 && outside(ev)) handler(ev);
  };
  return {
    on() {
      document.addEventListener("pointerdown", onDown, true);
      document.addEventListener("pointerup", onUp, true);
      document.addEventListener("click", onClick, true);
    },
    off() {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("pointerup", onUp, true);
      document.removeEventListener("click", onClick, true);
    },
    tap(ev) {
      onDown(ev);
      onUp(ev);
    },
  };
};

// ---------------------------------------------------------------------------
// The illustration: today's timeline of the schedules, with a "now" cursor
// ---------------------------------------------------------------------------

// Every animation of the illustration lasts a divisor of 12 s, so a recording of 12 s loops.

// The hours written under the timeline.
const SCENE_HOURS = [0, 6, 12, 18, 24];
const pctOf = (v) => ((v / DAY) * 100).toFixed(2);

// One row of the illustration: a schedule's icon in its colour, its track, today's blocks (the one running now
// pulses), dots for its one-off actions. `rows`: [{ icon, color, on, bits: [{ a, b, c, now } | { at, c }] }].
const sceneHtml = (rows, nowMin) => {
  const n = Math.max(1, rows.length);
  // The rows centred in the 54 px between the top of the scene and the hours.
  const top0 = 4 + (54 - (n * 18 - 10)) / 2;
  const rowHtml = rows
    .map((r, i) => {
      const bits = r.bits
        .map((b) =>
          b.at !== undefined
            ? `<i class="pt" style="left:${pctOf(b.at)}%;--c:${b.c}"></i>`
            : `<i class="bk${b.now ? " on" : ""}" style="left:${pctOf(b.a)}%;width:${pctOf(b.b - b.a)}%;--c:${b.c}"></i>`,
        )
        .join("");
      return `<div class="tr${r.on ? "" : " off"}" style="top:${(top0 + i * 18).toFixed(1)}px;--b:${r.color}">
        <span class="ri"><ha-icon icon="${esc(r.icon)}"></ha-icon></span><span class="tk">${bits}</span></div>`;
    })
    .join("");
  return `<div class="scene" aria-hidden="true"><div class="in">
      ${SCENE_HOURS.map((h) => `<span class="gl" style="left:${(h / 24) * 100}%"></span><span class="hr" style="left:${(h / 24) * 100}%">${String(h).padStart(2, "0")}h</span>`).join("")}
      ${rowHtml}
      <span class="cur" style="left:${pctOf(nowMin)}%"></span>
    </div></div>`;
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const STYLE = `
  :host { --sc-accent: ${ACCENT}; --sc-ok: var(--success-color, #43a047); --sc-warn: var(--warning-color, #ffa600);
          --sc-danger: var(--error-color, #db4437); --sc-na: var(--disabled-text-color, #9e9e9e); display: block; }
  ha-card { overflow: hidden; position: relative; container-type: inline-size; }
  /* A size container has no width of its own content: in a parent sized by its content the card would fall to a
     few pixels. This empty grid gives it a natural width of 400 px without any minimum. */
  :host::before { content: ""; display: grid; grid-template-columns: minmax(0, 400px); height: 0; }
  ha-card.has-modal { min-height: 440px; }
  .icon { width: 18px; height: 18px; fill: currentColor; flex: none; }
  .muted { color: var(--secondary-text-color); }
  [role="button"] { cursor: pointer; }
  [role="button"]:focus-visible, button:focus-visible { outline: 2px solid var(--primary-color, #03a9f4); outline-offset: 2px; }
  .ok { --c: var(--sc-ok); } .accent { --c: var(--sc-accent); } .na { --c: var(--sc-na); } .danger { --c: var(--sc-danger); }
  /* Status pill: the state colour on a tint, the text mixed with the text colour to stay readable. */
  .chip { display: inline-flex; align-items: center; gap: 4px; padding: 1px 8px; border-radius: 12px; font-size: 11px; font-weight: 500;
          line-height: 16px; white-space: nowrap; min-width: 0; max-width: 100%; box-sizing: border-box; overflow: hidden;
          background: color-mix(in srgb, var(--c) 16%, transparent); color: color-mix(in srgb, var(--c) 40%, var(--primary-text-color, #212121)); }
  .chip .txt { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--c); flex: none; }
  .warning { padding: 16px; color: color-mix(in srgb, var(--sc-warn) 40%, var(--primary-text-color, #212121)); }

  /* ── Illustrated header: 90 px, the title on the sky at the left, today's timeline at the right, a ruler strip ── */
  .banner { position: relative; height: var(--banner-h, 90px); overflow: hidden; --strip-h: 10px;
            --sky-text: #16263a; --sky-muted: #4a5a6e; --tk: #e3e9f0; --gl: #dbe2ea; --hr: #8e98a4; --ri: #ffffff;
            background: linear-gradient(90deg, #f7f9fc 0%, #f1f4f8 40%, #e8eef5 100%); }
  /* Evening: the last two hours before sunset, a warmer sky. */
  .banner.evening { --sky-text: #3a2414; --sky-muted: #7a5236; --tk: #f1e2d4; --gl: #ecd9c6; --hr: #a08068;
                    background: linear-gradient(90deg, #fcf6ef 0%, #f8ecdf 40%, #f2dcc7 100%); }
  .banner.night { --sky-text: #ffffff; --sky-muted: rgba(255,255,255,.78); --tk: #252e3f; --gl: #2a3446; --hr: #7d8793; --ri: #2a3446;
                  background: linear-gradient(90deg, #222a3a 0%, #1c2230 45%, #161b27 100%); }
  .banner .scene { position: absolute; right: 0; bottom: var(--strip-h); height: calc(100% - var(--strip-h));
                   width: min(calc((var(--banner-h, 90px) - var(--strip-h)) * 2.5), var(--scene-max, 58%)); overflow: hidden; }
  /* The timeline's tracks (0 to 24 h), the icons in a column at their left. */
  .scene .in { position: absolute; top: 0; bottom: 0; right: var(--scene-right, 8px); width: 112px; }
  .scene .gl { position: absolute; top: 6px; bottom: 12px; width: 1px; margin-left: -.5px; background: var(--gl); }
  .scene .hr { position: absolute; bottom: 1px; transform: translateX(-50%); font-size: 8px; line-height: 10px; color: var(--hr); white-space: nowrap; }
  .scene .hr:last-of-type { transform: translateX(-80%); }
  .scene .tr { position: absolute; left: 0; right: 0; height: 8px; }
  .scene .tk { position: absolute; inset: 0; border-radius: 4px; background: var(--tk); }
  .scene .bk { position: absolute; top: 0; height: 8px; min-width: 4px; border-radius: 4px; background: var(--c, var(--b)); opacity: .45; }
  .scene .bk.on { opacity: 1; box-shadow: 0 0 0 1.5px color-mix(in srgb, var(--c, var(--b)) 35%, transparent); }
  .scene .pt { position: absolute; top: 1px; width: 6px; height: 6px; margin-left: -3px; border-radius: 50%; background: var(--c, var(--b)); opacity: .7; }
  .scene .ri { position: absolute; left: -20px; top: -4px; width: 14px; height: 14px; box-sizing: border-box; border-radius: 50%;
               display: grid; place-items: center; color: var(--b); background: var(--ri); box-shadow: inset 0 0 0 1px var(--b); }
  .scene .ri ha-icon { --mdc-icon-size: 9px; display: flex; }
  .scene .tr.off { --b: #9aa3ae; }
  .scene .tr.off .bk, .scene .tr.off .pt { --c: #9aa3ae; }
  .scene .tr.off .ri { opacity: .7; }
  .scene .cur { position: absolute; top: 6px; bottom: 11px; width: 1.5px; margin-left: -.75px; background: #e5484d; }
  .scene .cur::before { content: ""; position: absolute; top: -2.5px; left: -2px; width: 5.5px; height: 5.5px; border-radius: 50%; background: #e5484d; }
  /* The bottom strip: a ruler of the day, its hours ticked, under a blue line. */
  .strip { position: absolute; left: 0; right: 0; bottom: 0; height: var(--strip-h); overflow: hidden; }
  .g-timeline { background: #dfe5ee; background-image: repeating-linear-gradient(90deg, #8a95a5 0 1px, transparent 1px 8px),
                repeating-linear-gradient(90deg, #5f6b7a 0 1.5px, transparent 1.5px 48px);
                background-size: 100% 4px, 100% 7px; background-repeat: no-repeat; box-shadow: inset 0 2px 0 #2f80ed; }
  .night .g-timeline { background-color: #2a3242; box-shadow: inset 0 2px 0 #2f80ed; }
  .evening .g-timeline { background-color: #eadfd3; }
  .head { position: absolute; z-index: 1; left: 0; top: 0; bottom: var(--strip-h); box-sizing: border-box;
          right: min(calc((var(--banner-h, 90px) - var(--strip-h)) * 2.5), var(--scene-max, 58%));
          display: flex; align-items: center; gap: 10px; padding: 8px 8px 8px 14px; min-width: 0; color: var(--sky-text); }
  /* The header icon: its colour is the status (a schedule running now, idle, nothing to show). */
  .badge { --st: var(--sc-accent); width: 40px; height: 40px; flex: none; border-radius: 50%; display: grid; place-items: center; color: var(--st);
           background: rgba(255,255,255,.62); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--st) 22%, transparent); }
  .badge.st-idle { --st: #7d8794; }
  .badge.st-warn { --st: var(--sc-warn); }
  .night .badge { background: rgba(255,255,255,.12); box-shadow: inset 0 0 0 1px rgba(255,255,255,.14); }
  .night .badge.st-active { --st: #7fd6d8; }
  .night .badge.st-idle { --st: #a3adba; }
  .badge .icon { width: 24px; height: 24px; }
  .titles { flex: 1 1 0; min-width: 0; overflow: hidden; display: flex; flex-wrap: wrap; align-items: center; column-gap: 8px; }
  .titles > * { flex: 1 0 100%; min-width: 0; }
  .name { font-size: 16px; font-weight: 500; line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  /* The title, then its status pill 8 px after it, centred on it, while the whole title and the pill's whole label fit
     on that row; otherwise (measured by the card, see _fitPill) the title takes its whole line and the pill goes under
     the statistics (.below, kept to one line), its dot alone (.pill-dot) when even then the text would run into the
     timeline strip. Its colour is the header icon's. */
  .trow { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .trow .name { flex: 0 1 auto; min-width: 0; }
  .chip.status { flex: none; --c: var(--sc-accent); }
  .chip.status.st-idle { --c: #7d8794; } .chip.status.st-warn { --c: var(--sc-warn); }
  .night .chip.status.st-active { --c: #7fd6d8; } .night .chip.status.st-idle { --c: #a3adba; }
  .banner .chip { background: color-mix(in srgb, var(--c) 18%, rgba(255,255,255,.78)); color: color-mix(in srgb, var(--c) 45%, #0d2a45); }
  .banner.night .chip { background: color-mix(in srgb, var(--c) 30%, rgba(8,18,38,.55)); color: color-mix(in srgb, var(--c) 35%, #ffffff); }
  .banner .chip.status .dot { width: 7px; height: 7px; }
  .titles.below .trow { display: contents; }
  .titles.below .trow .name { flex: 1 0 100%; }
  .titles.below > .stats { order: 1; max-height: 16px; }
  .titles.below .chip.status { order: 2; margin-top: 2px; max-width: 100%; }
  .titles.pill-dot .chip.status, .mhd.pill-dot .chip.status { padding: 5px; }
  .titles.pill-dot .chip.status .txt, .mhd.pill-dot .chip.status .txt { display: none; }
  /* Under 200 px only its dot shows (its text stays its tooltip and accessible name). */
  @container (max-width: 200px) { .chip.status { padding: 5px; } .chip.status .txt { display: none; } }
  /* The statistics on two lines at most: a part that does not fit goes to a third line, clipped away; the "·" that
     starts a line sits in the negative margin, clipped too. */
  .stats { display: flex; flex-wrap: wrap; max-height: 32px; overflow: hidden; margin-left: -10px; font-size: 12px; line-height: 16px; color: var(--sky-muted); }
  .stats span { white-space: nowrap; }
  .stats span::before { content: "·"; display: inline-block; width: 10px; text-align: center; }
  /* ── Animations (each one a divisor of 12 s) ── */
  .scene .bk.on { animation: sc-pulse 2s ease-in-out infinite; }
  .scene .cur::before { animation: sc-beat 2s ease-in-out infinite; }
  @keyframes sc-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .62; } }
  @keyframes sc-beat { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.35); } }
  /* Switching views: the new view slides in. */
  .view { animation: sc-in .3s ease-out; }
  @keyframes sc-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  @media (prefers-reduced-motion: reduce) {
    .scene *, .scene *::before, .view { animation: none !important; }
  }
  /* A narrow card keeps the sky and the strip for its texts: no timeline. */
  @container (max-width: 300px) {
    .banner .scene { display: none; }
    .head { right: 0; }
  }

  /* ── Classic header (illustration: false) ── */
  .header { display: flex; align-items: center; gap: 10px; padding: 12px 14px 8px; }
  .header .badge { background: color-mix(in srgb, var(--st) 16%, transparent); box-shadow: none; }
  .header .stats { color: var(--secondary-text-color); }

  /* ── Chips line under the header ── */
  .chips { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 8px; padding: 10px 12px 0; }
  .chips .aside { margin-left: auto; font-size: 12px; color: var(--secondary-text-color); white-space: nowrap; }
  /* show_header_toggle: the switch for every schedule, at the end of the line, its label saying what a click does. */
  .chips .all { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--secondary-text-color);
                white-space: nowrap; }
  .chips .aside + .all { margin-left: 4px; }
  .chips + .err { margin: 8px 12px 0; }

  /* ── Today's timeline: one tile per schedule ── */
  .rows { display: flex; flex-direction: column; gap: 8px; padding: 10px 12px 12px; }
  .row { box-sizing: border-box; display: flex; flex-direction: column; gap: 6px; padding: 8px 10px 10px 8px; border-radius: 12px;
         background: var(--secondary-background-color, #f1f1f1); transition: background .2s; }
  .row:hover { background: color-mix(in srgb, var(--c) 8%, var(--secondary-background-color, #f1f1f1)); }
  .row .line { display: flex; align-items: center; gap: 10px; min-width: 0; }
  /* The tile look shared by the ha-* cards: a neutral tile, a round icon tinted in the schedule's colour (grey when
     disabled), the name in bold, a state line coloured while a slot runs, a status dot on every tile. */
  .ic { position: relative; flex: none; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center;
        color: var(--c); background: color-mix(in srgb, var(--c) 16%, transparent); }
  .ic ha-icon { --mdc-icon-size: 24px; }
  .row:not(.enabled) .ic { color: var(--sc-na); background: color-mix(in srgb, var(--sc-na) 14%, transparent); }
  .ic .on { position: absolute; right: -1px; bottom: -1px; width: 10px; height: 10px; border-radius: 50%; background: var(--sc-na);
            box-shadow: 0 0 0 2px var(--secondary-background-color, #f1f1f1); }
  .row.enabled .ic .on { background: var(--sc-ok); }
  .row.active .ic .on { background: var(--c); }
  .ic .on.cs { isolation: isolate; width: 14px; height: 14px; right: -3px; bottom: -3px; display: grid; place-items: center; }
  .ic .on.cs svg { width: 12px; height: 12px; fill: none; stroke: #fff; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
  .row .ic .on.cs-met { background: var(--sc-ok); }
  .row .ic .on.cs-wait { background: var(--sc-warn); }
  .row .ic .on.cs-skip { background: var(--sc-danger); }
  .ic .on.pulse::after { content: ""; position: absolute; inset: 0; border-radius: 50%; background: var(--sc-ok); animation: sc-ping 1.8s ease-out infinite; z-index: -1; }
  @keyframes sc-ping { from { opacity: .7; transform: scale(1); } to { opacity: 0; transform: scale(2.1); } }
  @media (prefers-reduced-motion: reduce) { .ic .on.pulse::after { animation: none; } }
  .row .txt { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .row .nm { font-size: 14px; font-weight: 600; line-height: 1.25; color: var(--primary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .row .stl { font-size: 12px; line-height: 1.25; color: var(--secondary-text-color); overflow-wrap: break-word; }
  .row.active .stl { color: color-mix(in srgb, var(--c) 60%, var(--primary-text-color, #212121)); }
  .row .ens { font-size: 11px; line-height: 1.25; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .row ha-switch { flex: none; }
  .bar { position: relative; margin-left: 50px; height: 8px; border-radius: 4px; background: color-mix(in srgb, var(--sc-na) 22%, transparent); }
  .bar .s { position: absolute; top: 0; height: 8px; border-radius: 4px; background: var(--b); }
  .bar .p { position: absolute; top: 0; width: 8px; height: 8px; margin-left: -4px; border-radius: 50%; background: var(--b); }
  .bar .now, .track .now { position: absolute; top: -3px; width: 2px; height: 14px; margin-left: -1px; border-radius: 1px; background: var(--primary-text-color, #212121); }
  .foot { display: flex; justify-content: flex-end; margin-top: 2px; }
  /* Tinted, never filled. */
  .btn { all: unset; box-sizing: border-box; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 8px;
         font-size: 13px; font-weight: 500; line-height: 16px; color: color-mix(in srgb, var(--c, var(--sc-accent)) 70%, var(--primary-text-color, #212121));
         background: color-mix(in srgb, var(--c, var(--sc-accent)) 14%, transparent); }
  .btn:hover { background: color-mix(in srgb, var(--c, var(--sc-accent)) 22%, transparent); }
  .btn.plain { background: none; color: var(--secondary-text-color); }
  .btn.plain:hover { background: color-mix(in srgb, var(--secondary-text-color) 12%, transparent); }
  .btn.small { padding: 4px 10px; font-size: 12px; }
  .btn .icon { width: 16px; height: 16px; }
  .btn[disabled] { opacity: .5; pointer-events: none; }
  .empty { padding: 14px 16px; font-size: 13px; color: var(--secondary-text-color); }

  /* ── Weekly grid of a schedule ── */
  .tabs { display: flex; align-items: center; gap: 18px; padding: 0 12px; border-bottom: 1px solid var(--divider-color, rgba(127,127,127,.2));
          overflow-x: auto; scrollbar-width: none; }
  .tabs::-webkit-scrollbar { display: none; }
  .tab { all: unset; cursor: pointer; padding: 9px 0 7px; font-size: 14px; font-weight: 500; color: var(--secondary-text-color);
         border-bottom: 2px solid transparent; margin-bottom: -1px; white-space: nowrap; }
  .tab:hover { color: var(--primary-text-color); }
  .tab[aria-selected="true"] { color: var(--primary-text-color); border-bottom-color: var(--sc-accent); }
  .tab.back { flex: none; display: grid; place-items: center; width: 28px; height: 28px; padding: 0; margin: 4px -8px 4px -4px; border-radius: 50%; border: 0; }
  .tab.back:hover { background: color-mix(in srgb, var(--secondary-text-color) 12%, transparent); }
  .week { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px 12px; }
  .axis { position: relative; height: 14px; margin-left: calc(var(--dl) + 16px); margin-right: 4px; font-size: 11px; color: var(--secondary-text-color); }
  .axis span { position: absolute; transform: translateX(-50%); white-space: nowrap; }
  .axis span:first-child { transform: none; }
  .axis span:last-child { transform: translateX(-100%); }
  .day { display: flex; align-items: center; gap: 8px; border-radius: 10px; padding: 4px 4px 4px 8px; }
  .day.today { background: color-mix(in srgb, var(--sc-accent) 8%, transparent); }
  .day .dl { flex: none; width: var(--dl); font-size: 12px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .day.today .dl { font-weight: 500; color: color-mix(in srgb, var(--sc-accent) 70%, var(--primary-text-color, #212121)); }
  .day.off .dl { opacity: .55; }
  .track { position: relative; flex: 1 1 0; min-width: 0; height: 24px; border-radius: 6px; background: color-mix(in srgb, var(--d) 16%, transparent); }
  .day.off .track { background: color-mix(in srgb, var(--sc-na) 10%, transparent); }
  .track.edit { cursor: copy; }
  .track .now { top: -3px; height: 30px; }
  .blk { all: unset; box-sizing: border-box; position: absolute; top: 0; height: 24px; border-radius: 6px; display: flex; align-items: center; justify-content: center;
         overflow: hidden; font-size: 11px; font-weight: 500; white-space: nowrap; background: color-mix(in srgb, var(--b) 85%, transparent);
         color: color-mix(in srgb, var(--b) 30%, #000); }
  .blk.pt { width: 6px; margin-left: -3px; }
  /* A block too narrow for its value keeps its colour, without a cut label. */
  .blk:not(.pt) { container-type: inline-size; }
  @container (max-width: 26px) { .blk .bl { visibility: hidden; } }
  .blk[role="button"]:hover { filter: brightness(1.06); box-shadow: inset 0 0 0 1px rgba(0,0,0,.18); }
  .legend { display: flex; align-items: center; gap: 6px 14px; flex-wrap: wrap; margin-top: 4px; font-size: 12px; color: var(--secondary-text-color); }
  .legend .sw { display: flex; align-items: center; gap: 6px; }
  .legend .sw i { width: 14px; height: 10px; border-radius: 3px; background: color-mix(in srgb, var(--b) 85%, transparent); }
  .legend .sw.def i { background: color-mix(in srgb, var(--b) 16%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--b) 30%, transparent); }
  .legend .btn { margin-left: auto; }
  .legend .btn + .btn { margin-left: 0; }

  /* ── Popup (slot editor, new schedule), at the top of the card ── */
  .backdrop { position: absolute; inset: 0; background: rgba(0,0,0,.4); display: flex; align-items: flex-start; justify-content: center;
              padding-top: 10px; box-sizing: border-box; z-index: 9; border-radius: inherit; }
  .modal { background: var(--card-background-color, #fff); color: var(--primary-text-color); width: min(94%, 380px); max-height: calc(100% - 20px);
           overflow: auto; box-sizing: border-box; border-radius: 14px; padding: 14px; box-shadow: 0 8px 30px rgba(0,0,0,.35);
           display: flex; flex-direction: column; gap: 10px; }
  .mhead { display: flex; align-items: flex-start; gap: 10px; }
  .mhead .badge { width: 36px; height: 36px; color: var(--c, var(--sc-accent)); background: color-mix(in srgb, var(--c, var(--sc-accent)) 16%, transparent); box-shadow: none; }
  .mhead .badge ha-icon { --mdc-icon-size: 20px; }
  .mhead .badge .icon { width: 20px; height: 20px; }
  .mhead h3 { margin: 0; font-size: 16px; font-weight: 500; line-height: 1.3; overflow-wrap: anywhere; }
  .mhead .sub { font-size: 12px; color: var(--secondary-text-color); overflow-wrap: anywhere; }
  .mhead > div:not(.badge) { flex: 1 1 auto; min-width: 0; }
  .close { all: unset; flex: none; cursor: pointer; width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center;
           color: var(--secondary-text-color); box-shadow: inset 0 0 0 1px var(--divider-color, rgba(127,127,127,.3)); }
  .close:hover { color: var(--primary-text-color); background: color-mix(in srgb, var(--secondary-text-color) 12%, transparent); }
  .close .icon { width: 16px; height: 16px; }
  .form { display: grid; grid-template-columns: max-content minmax(0, 1fr); align-items: center; gap: 8px 12px; font-size: 13px; }
  .form > label { color: var(--secondary-text-color); }
  .form .full { grid-column: 1 / -1; }
  .form input, .form select { box-sizing: border-box; width: 100%; min-width: 0; font: inherit; font-size: 14px; color: var(--primary-text-color);
                              background: transparent; border: 1px solid var(--divider-color, rgba(127,127,127,.3)); border-radius: 8px; padding: 6px 8px; }
  .form select option { color: #212121; }
  .form input:focus, .form select:focus { outline: 2px solid color-mix(in srgb, var(--sc-accent) 60%, transparent); outline-offset: 0; }
  .pair { display: flex; align-items: center; gap: 6px; min-width: 0; }
  .pair input, .pair select { flex: 1 1 0; }
  .pair .u { flex: none; color: var(--secondary-text-color); }
  .note { font-size: 12px; color: var(--secondary-text-color); }
  /* The schedule's entities above the times, and the actions entity by entity (#23). */
  .ents-h { display: flex; align-items: flex-start; gap: 8px; min-width: 0; }
  .ents-h .ents { flex: 1 1 auto; min-width: 0; }
  .ents-h .chg { flex: none; }
  .pes { gap: 8px; }
  .pe { display: flex; flex-direction: column; gap: 6px; padding: 8px; border-radius: 10px; min-width: 0;
        background: color-mix(in srgb, var(--secondary-text-color) 7%, transparent); }
  .pe-h { display: flex; align-items: center; gap: 8px; min-width: 0; font-size: 13px; font-weight: 600; }
  .pe-h ha-icon { --mdc-icon-size: 18px; color: var(--secondary-text-color); flex: none; }
  .pe-h .en { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .err { font-size: 12px; color: color-mix(in srgb, var(--sc-danger) 60%, var(--primary-text-color, #212121)); }
  .dayset { display: flex; flex-wrap: wrap; gap: 4px; }
  .dt { all: unset; cursor: pointer; box-sizing: border-box; min-width: 34px; padding: 3px 7px; border-radius: 999px; text-align: center; font-size: 12px;
        font-weight: 500; color: var(--secondary-text-color); box-shadow: inset 0 0 0 1px var(--divider-color, rgba(127,127,127,.3)); }
  .dt[aria-pressed="true"] { color: color-mix(in srgb, var(--sc-accent) 70%, var(--primary-text-color, #212121));
                             background: color-mix(in srgb, var(--sc-accent) 16%, transparent); box-shadow: none; }
  .mfoot { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .mfoot .grow { flex: 1 1 auto; }
  /* ── Badges of a tile: the sun, the days, a condition, the dates, after the last slot ── */
  .bdgs { display: flex; flex-wrap: wrap; gap: 4px; margin-left: 50px; }
  .bdg { --k: var(--sc-na); max-width: 100%; box-sizing: border-box; padding: 1px 8px; border-radius: 999px; font-size: 11px; font-weight: 500; line-height: 1.5;
         white-space: nowrap; overflow: hidden; text-overflow: ellipsis; background: color-mix(in srgb, var(--k) 16%, transparent);
         color: color-mix(in srgb, var(--k) 45%, var(--primary-text-color, #212121)); }
  .bdg.b-sun { --k: #f59e0b; }
  .bdg.b-cond { --k: #3b82f6; }
  .bdg.b-period { --k: #8b5cf6; }
  /* ── Popup tabs, segmented choices, conditions, tags, entities ── */
  .mtabs { display: flex; gap: 16px; border-bottom: 1px solid var(--divider-color, rgba(127,127,127,.2)); }
  .mtab { all: unset; cursor: pointer; padding: 4px 2px 6px; font-size: 13px; font-weight: 500; color: var(--secondary-text-color); border-bottom: 2px solid transparent; }
  .mtab[aria-selected="true"] { color: var(--primary-text-color); border-bottom-color: var(--sc-accent); }
  .stack { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .seg { display: flex; gap: 2px; padding: 2px; border-radius: 8px; background: color-mix(in srgb, var(--sc-na) 14%, transparent); min-width: 0; }
  .sg { all: unset; cursor: pointer; flex: 1 1 0; min-width: 0; text-align: center; padding: 4px 6px; border-radius: 6px; font-size: 12px; font-weight: 500;
        color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sg[aria-pressed="true"] { background: var(--card-background-color, #fff); color: color-mix(in srgb, var(--sc-accent) 70%, var(--primary-text-color, #212121));
                             box-shadow: 0 1px 2px rgba(0,0,0,.15); }
  .seg.narrow { flex: none; }
  .seg.narrow .sg { flex: none; padding: 4px 8px; }
  .dayset.preset .dt { cursor: pointer; opacity: .75; }
  .sect { grid-column: 1 / -1; margin-top: 4px; font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--secondary-text-color); }
  .conds { display: flex; flex-direction: column; gap: 6px; }
  .cond { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px; padding: 6px; border-radius: 8px;
          background: color-mix(in srgb, var(--sc-na) 10%, transparent); }
  .cond .pair { grid-column: 1 / -1; }
  .cond select { flex: none; width: auto; }
  .cond select[data-cfield="value"] { flex: 1 1 0; width: 100%; }
  .x { all: unset; cursor: pointer; width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; color: var(--secondary-text-color); }
  .x:hover { color: var(--primary-text-color); background: color-mix(in srgb, var(--secondary-text-color) 12%, transparent); }
  .x .icon { width: 14px; height: 14px; }
  .tagset { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
  .tg { display: inline-flex; align-items: center; gap: 2px; padding: 1px 2px 1px 8px; border-radius: 999px; font-size: 12px; font-weight: 500;
        color: color-mix(in srgb, var(--sc-accent) 70%, var(--primary-text-color, #212121)); background: color-mix(in srgb, var(--sc-accent) 16%, transparent); }
  .tg .x { width: 20px; height: 20px; }
  .form .tagset input { flex: 1 1 90px; width: auto; }
  .chk { display: flex; align-items: center; gap: 8px; color: var(--primary-text-color); }
  .form .chk input { width: 16px; height: 16px; margin: 0; flex: none; accent-color: var(--sc-accent); }
  .ents { display: flex; flex-direction: column; gap: 4px; }
  .ent { display: flex; align-items: center; gap: 8px; padding: 4px 4px 4px 8px; border-radius: 8px; font-size: 13px;
         background: color-mix(in srgb, var(--sc-na) 10%, transparent); }
  .ent .en { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ent ha-icon { --mdc-icon-size: 18px; color: var(--secondary-text-color); }
  /* ── Weekly grid: the edges of a slot are dragged ── */
  .hdl { position: absolute; top: 3px; bottom: 3px; width: 8px; margin-left: -4px; border-radius: 3px; cursor: ew-resize; touch-action: none; z-index: 1;
         background: var(--card-background-color, #fff); box-shadow: 0 0 0 1px color-mix(in srgb, var(--b) 80%, #000); opacity: 0; }
  .track:hover .hdl, .hdl.on { opacity: 1; }
  @media (hover: none) { .hdl { opacity: .9; } }
  .tip { position: absolute; top: -26px; transform: translateX(-50%); padding: 2px 6px; border-radius: 6px; font-size: 11px; font-weight: 500; white-space: nowrap;
         color: #fff; background: #16263a; pointer-events: none; z-index: 2; }
`;

// The mini card: the same 90 px banner (title and next action on the sky, today's timeline, the detail button at
// the top right), then the next actions; without the illustration, badge, title, next action and detail button.
const MINI_STYLE = `
  ha-card.mini-card { padding: 12px; }
  ha-card.mini-card.illustrated { padding: 0; }
  .illustrated .banner { --scene-right: 36px; }
  .illustrated .nx { padding: 4px 12px 8px; }
  .banner .zoom { position: absolute; z-index: 2; top: 5px; right: 5px; margin: 0; color: #33506b; background: rgba(255,255,255,.55);
                  box-shadow: inset 0 0 0 1px rgba(255,255,255,.7); backdrop-filter: blur(4px); }
  .banner .zoom:hover { background: rgba(255,255,255,.75); color: #33506b; }
  .banner.night .zoom:hover { background: rgba(255,255,255,.22); color: #ffffff; }
  /* No timeline on a narrow card: the texts end before the detail button. */
  @container (max-width: 300px) { .illustrated .head { padding-right: 34px; } }
  .banner.night .zoom { color: #ffffff; background: rgba(255,255,255,.12); box-shadow: inset 0 0 0 1px rgba(255,255,255,.2); }
  .mini { display: flex; align-items: flex-start; gap: 10px; }
  .mini .badge { background: color-mix(in srgb, var(--st) 16%, transparent); box-shadow: none; }
  .body { flex: 1; min-width: 0; min-height: 40px; display: flex; flex-direction: column; justify-content: center; gap: 4px; }
  .mhd { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .mhd .chip.status { flex: 0 0 auto; }
  .mhd .st { margin-left: auto; }
  /* The whole title and the pill's whole label do not fit on one line (measured by the card, see _fitPill): the title
     and the detail button keep the first line, the pill goes on a line of its own under the next action. */
  .mhd.below { flex-wrap: wrap; row-gap: 2px; }
  .mhd.below .title { flex: 1 1 0; }
  .mhd.below .zoom { order: 1; }
  .mhd.below .st { order: 2; flex: 1 0 100%; margin: 0; }
  .mhd.below::after { content: ""; order: 3; flex: 1 0 100%; }
  .mhd.below .chip.status { order: 4; max-width: 100%; }
  /* Narrow: the next action goes under the title and its pill. */
  @container (max-width: 260px) { .mhd { flex-wrap: wrap; row-gap: 2px; } .mhd .title { flex: 1 1 0; } .mhd .st { order: 3; flex: 1 0 100%; margin: 0; } }
  .title { flex: 0 1 auto; min-width: 5ch; font-size: 16px; font-weight: 500; line-height: 1.25; color: var(--primary-text-color);
           white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .st { flex: 0 1 auto; min-width: 0; font-size: 11px; font-weight: 500; color: var(--sc-accent); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .nx { display: flex; flex-direction: column; }
  .nr { display: grid; grid-template-columns: auto auto minmax(0, 1fr) auto; align-items: center; gap: 8px; padding: 4px 0; }
  .nr + .nr { border-top: 1px solid rgba(127,127,127,.14); }
  .nr .tm { font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; min-width: 2.9em; }
  .nr ha-icon { --mdc-icon-size: 15px; color: var(--b); display: flex; }
  .nr .nn { font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .nr .na2 { font-size: 12px; color: var(--secondary-text-color); white-space: nowrap; max-width: 40cqw; overflow: hidden; text-overflow: ellipsis; }
  .none { font-size: 13px; color: var(--secondary-text-color); }
  .zoom { all: unset; flex: none; cursor: pointer; width: 24px; height: 24px; margin: -4px -4px -4px 0; border-radius: 50%;
          display: grid; place-items: center; color: var(--secondary-text-color); }
  .zoom .icon { width: 16px; height: 16px; }
  .zoom:hover { background: color-mix(in srgb, var(--sc-na) 16%, transparent); color: var(--primary-text-color); }
  .zoom:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 1px; }
  @container (max-width: 220px) { .nr { grid-template-columns: auto auto minmax(0, 1fr); } .nr .na2 { display: none; } }
`;
// The zoomed mini card: the full card, with the detail button over its banner.
const ZOOM_STYLE = `
  .zoom { all: unset; position: absolute; z-index: 2; top: 5px; right: 5px; cursor: pointer; width: 24px; height: 24px; border-radius: 50%;
          display: grid; place-items: center; color: #33506b; background: rgba(255,255,255,.55); box-shadow: inset 0 0 0 1px rgba(255,255,255,.7);
          backdrop-filter: blur(4px); }
  .zoom:not(.plain):not(.on-night):hover { background: rgba(255,255,255,.75); }
  .zoom.on-night:hover { background: rgba(255,255,255,.22); }
  .zoom.on-night { color: #ffffff; background: rgba(255,255,255,.12); box-shadow: inset 0 0 0 1px rgba(255,255,255,.2); }
  .zoom.plain { color: var(--secondary-text-color); background: none; box-shadow: inset 0 0 0 1px var(--divider-color, rgba(127,127,127,.3)); top: 18px; right: 12px; }
  .zoom .icon { width: 16px; height: 16px; }
  .header { position: relative; padding-right: 48px; }
  /* The timeline steps aside for the detail button. */
  .banner { --scene-right: 36px; }
`;

// ---------------------------------------------------------------------------
// The full card
// ---------------------------------------------------------------------------

// The last full schedules read on each Home Assistant connection, shared by the cards: a card created again (another
// view, a dashboard opened) draws their conditions and dates from its first render instead of growing when its own
// answer comes, which moved the page under it. Its own answer still replaces them.
const ITEMS_CACHE = new WeakMap();
const itemsKey = (hass) => (hass?.connection && typeof hass.connection === "object" ? hass.connection : null);

class SchedulerCard extends HTMLElement {
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

// ---------------------------------------------------------------------------
// The mini card: the next actions; its detail button unfolds the full card
// ---------------------------------------------------------------------------

class SchedulerMiniCard extends SchedulerCard {
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

// ---------------------------------------------------------------------------
// Visual editors (ha-form)
// ---------------------------------------------------------------------------

// Options on by default (left out of the YAML while on).
const ON_BY_DEFAULT = ["illustration", "show_disabled", "editable", "show_badges", "zoom", "condition_status_animation"];
const LANGUAGES = [
  ["en", "English"], ["fr", "Français"], ["de", "Deutsch"], ["es", "Español"], ["sr", "Српски"], ["sr-Latn", "Srpski (latinica)"],
  ["it", "Italiano"], ["nl", "Nederlands"], ["pt", "Português (Portugal)"], ["pl", "Polski"], ["ro", "Română"], ["da", "Dansk"],
  ["sv", "Svenska"], ["bg", "Български"], ["ru", "Русский"], ["uk", "Українська"], ["hu", "Magyar"], ["sk", "Slovenčina"],
  ["cs", "Čeština"], ["sl", "Slovenščina"], ["lv", "Latviešu"], ["el", "Ελληνικά"],
];

// The editor shows `entities` only as a list of entity ids (objects in YAML stay YAML-only).
const editableEntities = (config = {}) => config.entities === undefined || (Array.isArray(config.entities) && config.entities.every((e) => typeof e === "string"));

// The tags carried by the schedules found, sorted, for the editor's tag lists.
const knownTags = (hass) => {
  if (!hass?.states) return [];
  const tags = new Set();
  for (const id of discover(hass)) for (const x of listOf(hass.states[id]?.attributes?.tags)) if (typeof x === "string" && x) tags.add(x);
  return [...tags].sort();
};

class SchedulerCardEditor extends HTMLElement {
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

class SchedulerMiniCardEditor extends SchedulerCardEditor {
  static get mini() {
    return true;
  }
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

const define = (name, cls) => {
  if (!customElements.get(name)) pickerDefine(name, cls);
};
define("scheduler-card", SchedulerCard);
define("scheduler-mini-card", SchedulerMiniCard);
define("scheduler-card-editor", SchedulerCardEditor);
define("scheduler-mini-card-editor", SchedulerMiniCardEditor);

window.customCards = window.customCards || [];
for (const card of [
  {
    type: "scheduler-card",
    name: "Scheduler Card",
    description: "Today's timeline and the weekly grid of the Scheduler component's schedules, under an illustrated header whose cursor follows the time of day.",
  },
  {
    type: "scheduler-mini-card",
    name: "Scheduler Mini Card",
    description: "The next actions of the Scheduler component's schedules, with a detail button to the full card.",
  },
]) {
  if (!window.customCards.some((c) => c.type === card.type))
    window.customCards.push({ ...card, preview: true, documentationURL: "https://github.com/juju35/ha-scheduler-card" });
}

console.info(
  `%c SCHEDULER-CARD %c v${VERSION} `,
  `color: white; background: ${ACCENT}; font-weight: 700;`,
  `color: ${ACCENT}; background: white; font-weight: 700;`,
);
