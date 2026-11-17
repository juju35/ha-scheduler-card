/*
 * Scheduler Card for Home Assistant
 * https://github.com/juju35/ha-scheduler-card
 *
 * Today's timeline and the weekly grid of the schedules of the Scheduler component
 * (https://github.com/nielsfaber/scheduler-component): its `switch.schedule_*` entities, read from their
 * attributes (`weekdays`, `timeslots`, `actions`, `entities`, `current_slot`, `next_slot`, `next_trigger`, `tags`),
 * enabled and disabled with `switch.turn_on` / `switch.turn_off`, edited with the `scheduler.add`, `scheduler.edit`
 * and `scheduler.remove` services from the full schedule returned by the `scheduler` and `scheduler/item` websocket
 * commands. Everything is drawn under an illustrated banner showing today's timeline and a "now" cursor.
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
    sun_kept: "Sunrise and sunset times are kept unless you change them.",
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
    title: "Title",
    illustration: "Illustration",
    illustration_theme: "Illustration theme",
    theme_auto: "Automatic",
    theme_day: "Day",
    theme_night: "Night",
    show_disabled: "Disabled schedules",
    editable: "Slot editing",
    next_actions: "Upcoming actions",
    zoom: "Detail button",
    language: "Language",
    lang_auto: "Automatic",
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
    sun_kept: "Les heures liées au lever et au coucher du soleil sont conservées tant que vous ne les changez pas.",
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
    title: "Titre",
    illustration: "Illustration",
    illustration_theme: "Thème de l'illustration",
    theme_auto: "Automatique",
    theme_day: "Jour",
    theme_night: "Nuit",
    show_disabled: "Plannings désactivés",
    editable: "Modification des plages",
    next_actions: "Actions à venir",
    zoom: "Bouton détail",
    language: "Langue",
    lang_auto: "Automatique",
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
    sun_kept: "Zeiten nach Sonnenauf- und -untergang bleiben erhalten, solange du sie nicht änderst.",
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
    title: "Titel",
    illustration: "Illustration",
    illustration_theme: "Thema der Illustration",
    theme_auto: "Automatisch",
    theme_day: "Tag",
    theme_night: "Nacht",
    show_disabled: "Deaktivierte Zeitpläne",
    editable: "Zeitfenster bearbeiten",
    next_actions: "Anstehende Aktionen",
    zoom: "Detail-Schaltfläche",
    language: "Sprache",
    lang_auto: "Automatisch",
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
    sun_kept: "Las horas relativas al amanecer y al atardecer se conservan mientras no las cambies.",
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
    title: "Título",
    illustration: "Ilustración",
    illustration_theme: "Tema de la ilustración",
    theme_auto: "Automático",
    theme_day: "Día",
    theme_night: "Noche",
    show_disabled: "Programaciones desactivadas",
    editable: "Edición de franjas",
    next_actions: "Próximas acciones",
    zoom: "Botón de detalle",
    language: "Idioma",
    lang_auto: "Automático",
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
    sun_kept: "Времена везана за излазак и залазак сунца остају док их не промените.",
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
    title: "Наслов",
    illustration: "Илустрација",
    illustration_theme: "Тема илустрације",
    theme_auto: "Аутоматски",
    theme_day: "Дан",
    theme_night: "Ноћ",
    show_disabled: "Искључени распореди",
    editable: "Измена термина",
    next_actions: "Предстојеће радње",
    zoom: "Дугме за детаље",
    language: "Језик",
    lang_auto: "Аутоматски",
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
    sun_kept: "Vremena vezana za izlazak i zalazak sunca ostaju dok ih ne promenite.",
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
    title: "Naslov",
    illustration: "Ilustracija",
    illustration_theme: "Tema ilustracije",
    theme_auto: "Automatski",
    theme_day: "Dan",
    theme_night: "Noć",
    show_disabled: "Isključeni rasporedi",
    editable: "Izmena termina",
    next_actions: "Predstojeće radnje",
    zoom: "Dugme za detalje",
    language: "Jezik",
    lang_auto: "Automatski",
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
    sun_kept: "Gli orari legati ad alba e tramonto restano invariati finché non li modifichi.",
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
    title: "Titolo",
    illustration: "Illustrazione",
    illustration_theme: "Tema dell'illustrazione",
    theme_auto: "Automatico",
    theme_day: "Giorno",
    theme_night: "Notte",
    show_disabled: "Programmazioni disattivate",
    editable: "Modifica delle fasce",
    next_actions: "Prossime azioni",
    zoom: "Pulsante dettagli",
    language: "Lingua",
    lang_auto: "Automatica",
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
    sun_kept: "Tijden ten opzichte van zonsopkomst en zonsondergang blijven behouden zolang je ze niet wijzigt.",
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
    title: "Titel",
    illustration: "Illustratie",
    illustration_theme: "Thema van de illustratie",
    theme_auto: "Automatisch",
    theme_day: "Dag",
    theme_night: "Nacht",
    show_disabled: "Uitgeschakelde schema's",
    editable: "Tijdvakken bewerken",
    next_actions: "Komende acties",
    zoom: "Detailknop",
    language: "Taal",
    lang_auto: "Automatisch",
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
    sun_kept: "As horas relativas ao nascer e ao pôr do sol mantêm-se enquanto não as alterar.",
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
    title: "Título",
    illustration: "Ilustração",
    illustration_theme: "Tema da ilustração",
    theme_auto: "Automático",
    theme_day: "Dia",
    theme_night: "Noite",
    show_disabled: "Agendamentos desativados",
    editable: "Edição de intervalos",
    next_actions: "Próximas ações",
    zoom: "Botão de detalhe",
    language: "Idioma",
    lang_auto: "Automático",
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
    sun_kept: "Godziny względem wschodu i zachodu słońca pozostają bez zmian, dopóki ich nie zmienisz.",
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
    title: "Tytuł",
    illustration: "Ilustracja",
    illustration_theme: "Motyw ilustracji",
    theme_auto: "Automatycznie",
    theme_day: "Dzień",
    theme_night: "Noc",
    show_disabled: "Wyłączone harmonogramy",
    editable: "Edycja przedziałów",
    next_actions: "Nadchodzące akcje",
    zoom: "Przycisk szczegółów",
    language: "Język",
    lang_auto: "Automatycznie",
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
    sun_kept: "Orele raportate la răsărit și apus se păstrează cât timp nu le modificați.",
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
    title: "Titlu",
    illustration: "Ilustrație",
    illustration_theme: "Tema ilustrației",
    theme_auto: "Automat",
    theme_day: "Zi",
    theme_night: "Noapte",
    show_disabled: "Programări dezactivate",
    editable: "Editarea intervalelor",
    next_actions: "Acțiuni următoare",
    zoom: "Buton de detalii",
    language: "Limbă",
    lang_auto: "Automat",
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
    sun_kept: "Tider i forhold til solopgang og solnedgang bevares, så længe du ikke ændrer dem.",
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
    title: "Titel",
    illustration: "Illustration",
    illustration_theme: "Illustrationens tema",
    theme_auto: "Automatisk",
    theme_day: "Dag",
    theme_night: "Nat",
    show_disabled: "Deaktiverede tidsplaner",
    editable: "Redigering af tidsrum",
    next_actions: "Kommende handlinger",
    zoom: "Detaljeknap",
    language: "Sprog",
    lang_auto: "Automatisk",
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
    sun_kept: "Tider i förhållande till soluppgång och solnedgång behålls så länge du inte ändrar dem.",
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
    title: "Titel",
    illustration: "Illustration",
    illustration_theme: "Illustrationens tema",
    theme_auto: "Automatiskt",
    theme_day: "Dag",
    theme_night: "Natt",
    show_disabled: "Inaktiverade scheman",
    editable: "Redigering av intervall",
    next_actions: "Kommande åtgärder",
    zoom: "Detaljknapp",
    language: "Språk",
    lang_auto: "Automatiskt",
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
    sun_kept: "Часовете спрямо изгрева и залеза се запазват, докато не ги промените.",
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
    title: "Заглавие",
    illustration: "Илюстрация",
    illustration_theme: "Тема на илюстрацията",
    theme_auto: "Автоматично",
    theme_day: "Ден",
    theme_night: "Нощ",
    show_disabled: "Изключени графици",
    editable: "Редактиране на интервали",
    next_actions: "Предстоящи действия",
    zoom: "Бутон за детайли",
    language: "Език",
    lang_auto: "Автоматично",
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
    sun_kept: "Время относительно восхода и заката сохраняется, пока вы его не измените.",
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
    title: "Заголовок",
    illustration: "Иллюстрация",
    illustration_theme: "Тема иллюстрации",
    theme_auto: "Автоматически",
    theme_day: "День",
    theme_night: "Ночь",
    show_disabled: "Отключённые расписания",
    editable: "Изменение интервалов",
    next_actions: "Ближайшие действия",
    zoom: "Кнопка подробностей",
    language: "Язык",
    lang_auto: "Автоматически",
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
    sun_kept: "Час відносно сходу й заходу сонця зберігається, доки ви його не зміните.",
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
    title: "Заголовок",
    illustration: "Ілюстрація",
    illustration_theme: "Тема ілюстрації",
    theme_auto: "Автоматично",
    theme_day: "День",
    theme_night: "Ніч",
    show_disabled: "Вимкнені розклади",
    editable: "Зміна інтервалів",
    next_actions: "Найближчі дії",
    zoom: "Кнопка деталей",
    language: "Мова",
    lang_auto: "Автоматично",
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
    sun_kept: "A napkeltéhez és napnyugtához kötött időpontok megmaradnak, amíg nem módosítja őket.",
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
    title: "Cím",
    illustration: "Illusztráció",
    illustration_theme: "Az illusztráció témája",
    theme_auto: "Automatikus",
    theme_day: "Nappal",
    theme_night: "Éjszaka",
    show_disabled: "Letiltott ütemezések",
    editable: "Idősávok szerkesztése",
    next_actions: "Közelgő műveletek",
    zoom: "Részletek gomb",
    language: "Nyelv",
    lang_auto: "Automatikus",
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
    sun_kept: "Časy vzhľadom na východ a západ slnka zostanú zachované, kým ich nezmeníte.",
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
    title: "Názov",
    illustration: "Ilustrácia",
    illustration_theme: "Téma ilustrácie",
    theme_auto: "Automaticky",
    theme_day: "Deň",
    theme_night: "Noc",
    show_disabled: "Vypnuté plány",
    editable: "Úprava intervalov",
    next_actions: "Nadchádzajúce akcie",
    zoom: "Tlačidlo podrobností",
    language: "Jazyk",
    lang_auto: "Automaticky",
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
    sun_kept: "Časy vztažené k východu a západu slunce zůstanou zachovány, dokud je nezměníte.",
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
    title: "Název",
    illustration: "Ilustrace",
    illustration_theme: "Motiv ilustrace",
    theme_auto: "Automaticky",
    theme_day: "Den",
    theme_night: "Noc",
    show_disabled: "Vypnuté plány",
    editable: "Úprava intervalů",
    next_actions: "Nadcházející akce",
    zoom: "Tlačítko podrobností",
    language: "Jazyk",
    lang_auto: "Automaticky",
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
    sun_kept: "Časi glede na sončni vzhod in zahod se ohranijo, dokler jih ne spremenite.",
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
    title: "Naslov",
    illustration: "Ilustracija",
    illustration_theme: "Tema ilustracije",
    theme_auto: "Samodejno",
    theme_day: "Dan",
    theme_night: "Noč",
    show_disabled: "Izklopljeni urniki",
    editable: "Urejanje intervalov",
    next_actions: "Prihajajoča dejanja",
    zoom: "Gumb za podrobnosti",
    language: "Jezik",
    lang_auto: "Samodejno",
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
    sun_kept: "Laiki attiecībā pret saullēktu un saulrietu tiek saglabāti, kamēr tos nemaināt.",
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
    title: "Virsraksts",
    illustration: "Ilustrācija",
    illustration_theme: "Ilustrācijas tēma",
    theme_auto: "Automātiski",
    theme_day: "Diena",
    theme_night: "Nakts",
    show_disabled: "Izslēgtie grafiki",
    editable: "Intervālu rediģēšana",
    next_actions: "Gaidāmās darbības",
    zoom: "Detaļu poga",
    language: "Valoda",
    lang_auto: "Automātiski",
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
    sun_kept: "Οι ώρες σε σχέση με την ανατολή και τη δύση του ηλίου διατηρούνται όσο δεν τις αλλάζετε.",
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
    title: "Τίτλος",
    illustration: "Εικονογράφηση",
    illustration_theme: "Θέμα εικονογράφησης",
    theme_auto: "Αυτόματο",
    theme_day: "Ημέρα",
    theme_night: "Νύχτα",
    show_disabled: "Απενεργοποιημένα προγράμματα",
    editable: "Επεξεργασία διαστημάτων",
    next_actions: "Επερχόμενες ενέργειες",
    zoom: "Κουμπί λεπτομερειών",
    language: "Γλώσσα",
    lang_auto: "Αυτόματα",
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

// The schedule entities: the scheduler platform's registry entries, and any switch.schedule_* entity carrying the
// component's attributes (no registry in some setups).
const discover = (hass) => {
  const states = hass?.states || {};
  const ids = new Set();
  for (const e of Object.values(hass?.entities || {})) if (e?.platform === PLATFORM && domainOf(e.entity_id) === "switch" && states[e.entity_id]) ids.add(e.entity_id);
  for (const [id, s] of Object.entries(states)) if (id.startsWith("switch.schedule_") && Array.isArray(s?.attributes?.timeslots)) ids.add(id);
  return [...ids];
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

// The card's view of a schedule entity.
const scheduleModel = (hass, config, id, tr, loc) => {
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
  };
};

// The schedules shown: those of the card's `tags` (any of them) and `entities` (schedule entities or the entities
// they act on), disabled ones last unless `show_disabled: false`, by name.
const pickSchedules = (models, config = {}) => {
  const tags = Array.isArray(config.tags) ? config.tags.map(String) : config.tags ? [String(config.tags)] : [];
  const ents = Array.isArray(config.entities) ? config.entities.map((e) => (typeof e === "string" ? e : e?.entity)).filter(Boolean) : [];
  return models
    .filter((m) => !tags.length || m.tags.some((x) => tags.includes(x)))
    .filter((m) => !ents.length || ents.includes(m.id) || m.entities.some((e) => ents.includes(e)))
    .filter((m) => config.show_disabled !== false || m.state !== "off")
    .sort((x, y) => (x.state === "off") - (y.state === "off") || x.name.localeCompare(y.name));
};

// The next starts of a schedule's slots, from `now` ({ wd, min }) over the next `days` days.
const occurrences = (m, now, hass, days = 8) => {
  const out = [];
  for (let d = 0; d < days; d++) {
    const wd = (now.wd + d) % 7;
    if (!runsOn(m.weekdays, wd, hass, d === 0)) continue;
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

// Day or night: day from sunrise to sunset, night from sunset to the next sunrise (`f`: the share of it gone).
const skyAt = (min, sun) => {
  if (min >= sun.rise && min < sun.set) return { night: false, f: (min - sun.rise) / (sun.set - sun.rise) };
  const len = DAY - (sun.set - sun.rise);
  return { night: true, f: (((min - sun.set) % DAY) + DAY) % DAY / len };
};

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
  .titles { flex: 1 1 0; min-width: 0; overflow: hidden; }
  .name { font-size: 16px; font-weight: 500; line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
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

  /* ── Today's timeline: one tile per schedule ── */
  .rows { display: flex; flex-direction: column; gap: 8px; padding: 10px 12px 12px; }
  .row { box-sizing: border-box; display: flex; flex-direction: column; gap: 6px; padding: 8px 10px 10px 8px; border-radius: 12px;
         background: var(--secondary-background-color, #f1f1f1); transition: background .2s; }
  .row:hover { background: color-mix(in srgb, var(--c) 8%, var(--secondary-background-color, #f1f1f1)); }
  .row .line { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .ic { position: relative; flex: none; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center;
        color: var(--primary-text-color); background: color-mix(in srgb, var(--sc-na) 14%, transparent); }
  .ic ha-icon { --mdc-icon-size: 24px; }
  .row.active .ic { color: var(--c); background: color-mix(in srgb, var(--c) 16%, transparent); }
  .ic .on { position: absolute; right: -1px; bottom: -1px; width: 10px; height: 10px; border-radius: 50%; background: var(--sc-na);
            box-shadow: 0 0 0 2px var(--secondary-background-color, #f1f1f1); }
  .row.enabled .ic .on { background: var(--sc-ok); }
  .row .txt { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .row .nm { font-size: 14px; font-weight: 500; line-height: 1.25; color: var(--primary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .row .stl { font-size: 12px; line-height: 1.25; color: var(--secondary-text-color); overflow-wrap: break-word; }
  .row.active .stl { color: color-mix(in srgb, var(--c) 60%, var(--primary-text-color, #212121)); }
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
  .pair input { flex: 1 1 0; }
  .pair .u { flex: none; color: var(--secondary-text-color); }
  .note { font-size: 12px; color: var(--secondary-text-color); }
  .err { font-size: 12px; color: color-mix(in srgb, var(--sc-danger) 60%, var(--primary-text-color, #212121)); }
  .dayset { display: flex; flex-wrap: wrap; gap: 4px; }
  .dt { all: unset; cursor: pointer; box-sizing: border-box; min-width: 34px; padding: 3px 7px; border-radius: 999px; text-align: center; font-size: 12px;
        font-weight: 500; color: var(--secondary-text-color); box-shadow: inset 0 0 0 1px var(--divider-color, rgba(127,127,127,.3)); }
  .dt[aria-pressed="true"] { color: color-mix(in srgb, var(--sc-accent) 70%, var(--primary-text-color, #212121));
                             background: color-mix(in srgb, var(--sc-accent) 16%, transparent); box-shadow: none; }
  .mfoot { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .mfoot .grow { flex: 1 1 auto; }
`;

// The mini card: the same 90 px banner (title and next action on the sky, today's timeline, the detail button at
// the top right), then the next actions; without the illustration, badge, title, next action and detail button.
const MINI_STYLE = `
  ha-card.mini-card { padding: 12px; }
  ha-card.mini-card.illustrated { padding: 0; }
  .illustrated .banner { --scene-right: 36px; }
  .illustrated .nx { padding: 4px 12px 8px; }
  .banner .zoom { position: absolute; z-index: 2; top: 5px; right: 5px; margin: 0; color: #2f6061; background: rgba(255,255,255,.55);
                  box-shadow: inset 0 0 0 1px rgba(255,255,255,.7); }
  .banner .zoom:hover { background: rgba(255,255,255,.8); }
  .banner.night .zoom { color: #ffffff; background: rgba(255,255,255,.12); box-shadow: inset 0 0 0 1px rgba(255,255,255,.2); }
  .mini { display: flex; align-items: flex-start; gap: 10px; }
  .mini .badge { background: color-mix(in srgb, var(--st) 16%, transparent); box-shadow: none; }
  .body { flex: 1; min-width: 0; min-height: 40px; display: flex; flex-direction: column; justify-content: center; gap: 4px; }
  .mhd { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .title { flex: 1 1 0; min-width: 5ch; font-size: 16px; font-weight: 500; line-height: 1.25; color: var(--primary-text-color);
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
          display: grid; place-items: center; color: #2f6061; background: rgba(255,255,255,.55); box-shadow: inset 0 0 0 1px rgba(255,255,255,.7); }
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

class SchedulerCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._html = "";
    this._view = null;
    this._edit = null;
    this._run = 0;
    this.shadowRoot.addEventListener("click", (ev) => this._click(ev));
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
    const sig = this._signature();
    if (this._sig && sig.length === this._sig.length && sig.every((v, i) => v === this._sig[i])) return;
    this._update(sig);
  }

  get hass() {
    return this._hass;
  }

  connectedCallback() {
    (this._outsideWatch ??= watchOutside(this, (ev) => this._onOutside(ev))).on();
    window.addEventListener("keydown", this._onKey);
    // The sun, the "now" markers and the state lines follow the clock: checked every 30 s.
    clearInterval(this._timer);
    this._timer = setInterval(() => this._hass && this._config && (this.hass = this._hass), 30000);
    this._update();
  }

  disconnectedCallback() {
    this._outsideWatch?.off();
    window.removeEventListener("keydown", this._onKey);
    clearInterval(this._timer);
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
      Math.floor(this._nowMs() / 60000),
    ];
  }

  _update(sig) {
    if (!this._hass || !this._config) return;
    this._sig = sig ?? this._signature();
    const html = this._render();
    if (html !== this._html) {
      this._html = html;
      morph(this.shadowRoot, html);
    }
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
    const all = discover(this._hass).map((id) => scheduleModel(this._hass, this._config, id, tr, loc));
    this._all = all;
    this._list = pickSchedules(all, this._config);
    return this._list;
  }

  // Night illustration: forced by illustration_theme, else Home Assistant's dark mode or the sun below the horizon
  // (sun.sun), else the hour when sun.sun is missing. Evening: the last two hours before sunset, in automatic mode.
  _sky(now) {
    const sun = sunTimes(this._hass);
    const sky = skyAt(now.min, sun);
    const mode = this._config.illustration_theme;
    const state = this._hass?.states?.["sun.sun"]?.state;
    let night = sky.night;
    if (mode === "night") night = true;
    else if (mode === "day") night = false;
    else if (this._hass?.themes?.darkMode || state === "below_horizon") night = true;
    else if (state === "above_horizon") night = false;
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

  _titleBlock(title, stats, status = "idle") {
    return `<div class="badge st-${status}">${svgIcon(ICONS.calendarClock)}</div>
      <div class="titles">
        <div class="name">${esc(title)}</div>
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

  _row(m, now) {
    const active = m.enabled && m.current !== null;
    const label = `${m.name}: ${this._stateLine(m, now)}`;
    return `<div class="row${active ? " active" : ""}${m.enabled ? " enabled" : ""}" role="button" tabindex="0" data-key="${esc(m.id)}" data-open="${esc(m.id)}"
        style="--c:${m.base}" aria-label="${esc(label)}">
      <div class="line">
        <span class="ic"><ha-icon icon="${esc(m.icon)}"></ha-icon><span class="on"></span></span>
        <span class="txt"><span class="nm">${esc(m.name)}</span><span class="stl">${esc(this._stateLine(m, now))}</span></span>
        <ha-switch data-toggle="${esc(m.id)}"${m.enabled ? " checked" : ""} aria-label="${esc(m.name)}"></ha-switch>
      </div>
      <div class="bar">${this._todayBits(m, now)}<span class="now" style="left:${((now.min / DAY) * 100).toFixed(2)}%"></span></div>
    </div>`;
  }

  _timeline(models, now) {
    const on = models.filter((m) => m.enabled).length;
    const off = models.length - on;
    const chips = `<div class="chips">
        <span class="chip ok"><span class="dot"></span><span class="txt">${esc(plural(this._hass, this._config, "enabled", on))}</span></span>
        ${off ? `<span class="chip na"><span class="dot"></span><span class="txt">${esc(plural(this._hass, this._config, "disabled", off))}</span></span>` : ""}
        ${this._config.illustration === false ? "" : `<span class="aside">${esc(this._t("now_hint"))}</span>`}
      </div>`;
    const rows = models.length ? models.map((m) => this._row(m, now)).join("") : `<div class="empty">${esc(this._t("no_match"))}</div>`;
    const add =
      this._config.editable === false
        ? ""
        : `<div class="foot"><button class="btn" data-action="new">${svgIcon(ICONS.plus)}${esc(this._t("new_schedule"))}</button></div>`;
    return `<div class="view" data-key="timeline">${chips}<div class="rows">${rows}${add}</div></div>`;
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
                    `<span class="blk" style="left:${pct(sp.a)}%;width:${pct(sp.b - sp.a)}%;--b:${color(sp.slot)}" title="${esc(blockLabel(sp.slot))}"${attrs(sp.slot)}><span class="bl">${esc(m.infos.get(sp.slot.i).short)}</span></span>`,
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
    const add = editable ? `<button class="btn small" data-action="add-slot">${svgIcon(ICONS.plus)}${esc(this._t("add_slot"))}</button>` : "";
    return `<div class="view" data-key="week-${esc(m.id)}">${chips}
      <div class="week" style="--dl:${dl}px">
        <div class="axis">${[0, 6, 12, 18, 24].map((h) => `<span style="left:${(h / 24) * 100}%">${esc(this._hoursLabel(h))}</span>`).join("")}</div>
        ${days}
        <div class="legend">${legend}${add}</div>
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

  _dayToggles(days) {
    return `<div class="dayset">${[0, 1, 2, 3, 4, 5, 6]
      .map((wd) => `<button class="dt" data-dayt="${wd}" aria-pressed="${days.has(wd)}">${esc(this._weekday(wd))}</button>`)
      .join("")}</div>`;
  }

  _actionSelect(options, selected) {
    return `<select data-field="action">${options
      .map((o) => `<option value="${esc(o.key)}"${o.key === selected ? " selected" : ""}>${esc(o.label)}</option>`)
      .join("")}</select>`;
  }

  _valueInput(opt, value) {
    if (!opt?.input) return "";
    const i = opt.input;
    return `<label for="sc-val">${esc(this._t(i.field === "temperature" ? "act_temperature" : i.field === "position" ? "act_position" : "act_value"))}</label>
      <div class="pair"><input id="sc-val" type="number" data-field="value" min="${i.min}" max="${i.max}" step="${i.step}" value="${esc(value ?? "")}">${i.unit ? `<span class="u">${esc(i.unit)}</span>` : ""}</div>`;
  }

  _editHtml() {
    const e = this._edit;
    if (!e) return "";
    if (e.mode === "new") return this._newHtml();
    const m = this._all?.find((x) => x.id === e.id);
    if (!m) return "";
    const title = this._t(e.index === null ? "add_slot" : "edit_slot");
    if (e.loading || !e.draft)
      return this._modal(title, m.name, m.icon, `<div class="${e.error ? "err" : "note"}">${esc(e.error || this._t("loading"))}</div>`, m.base);
    const d = e.draft;
    const opt = e.options.find((o) => o.key === d.action);
    const single = e.item.timeslots.length <= 1;
    const del =
      e.index === null
        ? ""
        : `<button class="btn small danger" data-action="delete" style="--c:var(--sc-danger)">${esc(e.confirm ? this._t("confirm_delete") : this._t(single ? "delete_schedule" : "delete_slot"))}</button>`;
    const body = `<div class="form">
        <label for="sc-start">${esc(this._t("start"))}</label><input id="sc-start" type="time" data-field="start" value="${esc(d.start)}">
        <label for="sc-stop">${esc(this._t("end"))}</label><input id="sc-stop" type="time" data-field="stop" value="${esc(d.stop)}" title="${esc(this._t("end_hint"))}">
        <label for="sc-act">${esc(this._t("action"))}</label>${this._actionSelect(e.options, d.action).replace("<select", '<select id="sc-act"')}
        ${this._valueInput(opt, d.value)}
        <label>${esc(this._t("days"))}</label>${this._dayToggles(d.days)}
        <div class="note full">${esc(this._t("days_note"))}${e.sun ? ` ${esc(this._t("sun_kept"))}` : ""}</div>
      </div>
      ${e.error ? `<div class="err">${esc(e.error)}</div>` : ""}
      <div class="mfoot">${del}<span class="grow"></span>
        <button class="btn plain small" data-action="close">${esc(this._t("cancel"))}</button>
        <button class="btn small" data-action="save"${e.saving ? " disabled" : ""}>${esc(this._t("save"))}</button>
      </div>`;
    return this._modal(title, m.name, m.icon, body, m.base);
  }

  _newHtml() {
    const e = this._edit;
    const d = e.draft;
    const options = this._newOptions(d.entity);
    const opt = options.find((o) => o.key === d.action);
    const ents = Object.keys(this._hass.states)
      .filter((id) => ACTION_DOMAINS.includes(domainOf(id)))
      .sort();
    const body = `<div class="form">
        <label for="sc-name">${esc(this._t("name"))}</label><input id="sc-name" type="text" data-field="name" value="${esc(d.name)}">
        <label for="sc-ent">${esc(this._t("entity"))}</label><input id="sc-ent" type="text" list="sc-entities" data-field="entity" value="${esc(d.entity)}" autocomplete="off">
        <datalist id="sc-entities">${ents.map((id) => `<option value="${esc(id)}">${esc(this._hass.states[id].attributes?.friendly_name || id)}</option>`).join("")}</datalist>
        ${options.length ? `<label for="sc-act">${esc(this._t("action"))}</label>${this._actionSelect(options, d.action).replace("<select", '<select id="sc-act"')}` : ""}
        ${this._valueInput(opt, d.value)}
        <label for="sc-start">${esc(this._t("start"))}</label><input id="sc-start" type="time" data-field="start" value="${esc(d.start)}">
        <label for="sc-stop">${esc(this._t("end"))}</label><input id="sc-stop" type="time" data-field="stop" value="${esc(d.stop)}" title="${esc(this._t("end_hint"))}">
        <label>${esc(this._t("days"))}</label>${this._dayToggles(d.days)}
      </div>
      ${e.error ? `<div class="err">${esc(e.error)}</div>` : ""}
      <div class="mfoot"><span class="grow"></span>
        <button class="btn plain small" data-action="close">${esc(this._t("cancel"))}</button>
        <button class="btn small" data-action="save"${e.saving ? " disabled" : ""}>${esc(this._t("save"))}</button>
      </div>`;
    return this._modal(this._t("new_schedule"), "", ICONS.calendarClock, body);
  }

  // The actions offered for an entity, labelled.
  _labelled(list, entityId) {
    const tr = (k, v) => this._t(k, v);
    return list.map((a) => ({
      ...a,
      key: a.input ? `${a.service}#${a.input.field}` : actionKey(a.service, a.data),
      label: a.input
        ? `${this._t(a.input.field === "temperature" ? "act_temperature" : a.input.field === "position" ? "act_position" : "act_value")}…`
        : actionInfo(this._hass, tr, this._loc(), a, entityId).label,
    }));
  }

  _newOptions(entityId) {
    return this._hass.states[entityId] ? this._labelled(domainActions(this._hass, entityId), entityId) : [];
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
    this._run++;
    this._update(this._sig);
  }

  _showTimeline() {
    this._view = null;
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

  async _openSlot(id, index, atMin = null) {
    const m = this._all.find((x) => x.id === id);
    if (!m || this._config.editable === false) return;
    this._edit = { mode: "slot", id, index, loading: true };
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
    const targets = (slot || item.timeslots?.[0])?.actions?.map((a) => a.entity_id).filter(Boolean) || m.entities;
    const target = targets[0] || m.target;
    // The schedule's own actions first, then those of its entity.
    const own = [];
    for (const ts of item.timeslots || []) {
      const a = ts.actions?.[0];
      if (a && !own.some((o) => actionKey(o.service, o.data) === actionKey(a.service, a.service_data))) own.push({ service: a.service, data: a.service_data || {} });
    }
    const options = this._labelled([...own, ...domainActions(this._hass, target)], target).filter((o, k, all) => all.findIndex((x) => x.key === o.key) === k);
    const days = new Set([0, 1, 2, 3, 4, 5, 6].filter((wd) => runsOn(item.weekdays, wd, this._hass)));
    let draft;
    if (slot) {
      const a = slot.actions?.[0] || {};
      const start = parseTime(slot.start, sun);
      const stop = slot.stop ? parseTime(slot.stop, sun) : null;
      draft = { start: start ? hm(start.min) : "", stop: stop ? hm(stop.min) : "", action: actionKey(a.service, a.service_data), value: "", days };
      if (!options.some((o) => o.key === draft.action)) draft.action = options[0]?.key || "";
    } else {
      const start = atMin ?? 12 * 60;
      draft = { start: hm(start), stop: hm(Math.min(DAY - 1, start + 60)), action: options[0]?.key || "", value: "", days };
    }
    const opt = options.find((o) => o.key === draft.action);
    if (opt?.input) draft.value = String(opt.input.min);
    this._edit = { ...e, loading: false, item, options, targets, draft, initial: { ...draft, days: new Set(days) }, sun: !!slot && /sun/.test(`${slot.start}${slot.stop || ""}`) };
    this._update(this._sig);
  }

  _openNew() {
    const now = this._now();
    const start = Math.min(DAY - 60, Math.ceil((now.min + 1) / 30) * 30);
    this._edit = { mode: "new", draft: { name: "", entity: "", action: "", value: "", start: hm(start), stop: "", days: new Set([0, 1, 2, 3, 4, 5, 6]) } };
    this._update(this._sig);
  }

  // The data of the chosen action: an entered value goes into its field.
  _actionData(opt, value) {
    if (!opt) return null;
    if (!opt.input) return { service: opt.service, data: opt.data || {} };
    const v = num(value);
    if (v === null) return null;
    return { service: opt.service, data: { ...(opt.data || {}), [opt.input.field]: v } };
  }

  // The slots of the schedule once the draft is in (sorted by start), or an error.
  _slotsAfterEdit(e) {
    const d = e.draft;
    const sun = sunTimes(this._hass);
    const start = parseTime(d.start, sun);
    if (!start) return { error: this._t("err_time") };
    const stop = d.stop ? parseTime(d.stop, sun) : null;
    if (stop && stop.min === start.min) return { error: this._t("err_same") };
    const act = this._actionData(
      e.options.find((o) => o.key === d.action),
      d.value,
    );
    if (!act) return { error: this._t("err_action") };
    const slots = (e.item.timeslots || []).map(cleanSlot);
    const old = e.index !== null ? slots[e.index] : null;
    const base = old || slots[0] || {};
    const keep = (field) => d[field] === e.initial?.[field] && old?.[field];
    const slot = {};
    slot.start = keep("start") ? old.start : `${d.start}:00`;
    if (d.stop) slot.stop = keep("stop") ? old.stop : `${d.stop}:00`;
    for (const k of ["conditions", "condition_type", "track_conditions"]) if (base[k] !== undefined) slot[k] = base[k];
    const targets = e.targets?.length ? e.targets : [];
    slot.actions = targets.length
      ? targets.map((id) => ({ service: act.service, entity_id: id, ...(Object.keys(act.data).length ? { service_data: act.data } : {}) }))
      : [{ service: act.service, ...(Object.keys(act.data).length ? { service_data: act.data } : {}) }];
    const others = slots.filter((_s, k) => k !== e.index);
    const range = (s) => {
      const a = parseTime(s.start, sun)?.min ?? 0;
      const b = s.stop ? (parseTime(s.stop, sun)?.min ?? a) : null;
      return [a, b === null ? null : b === 0 && a > 0 ? DAY : b];
    };
    const [a1, b1] = range(slot);
    const covers = (a, b, x) => (b > a ? x >= a && x < b : x >= a || x < b);
    for (const o of others) {
      const [a2, b2] = range(o);
      const clash =
        a1 === a2 ||
        (b1 !== null && b2 !== null && (covers(a1, b1, a2) || covers(a2, b2, a1))) ||
        (b1 !== null && b2 === null && covers(a1, b1, a2)) ||
        (b1 === null && b2 !== null && covers(a2, b2, a1));
      if (clash) return { error: this._t("err_overlap") };
    }
    const all = [...others, slot].sort((x, y) => range(x)[0] - range(y)[0]);
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

  async _save() {
    const e = this._edit;
    if (!e || e.saving) return;
    let service;
    let payload;
    if (e.mode === "new") {
      const d = e.draft;
      if (!this._hass.states[d.entity]) return this._fail(this._t("err_entity"));
      const opt = this._newOptions(d.entity).find((o) => o.key === d.action) || this._newOptions(d.entity)[0];
      const act = this._actionData(opt, d.value);
      if (!act) return this._fail(this._t("err_action"));
      const sun = sunTimes(this._hass);
      const start = parseTime(d.start, sun);
      if (!start) return this._fail(this._t("err_time"));
      const stop = d.stop ? parseTime(d.stop, sun) : null;
      if (stop && stop.min === start.min) return this._fail(this._t("err_same"));
      if (!d.days.size) return this._fail(this._t("err_days"));
      const slot = { start: `${d.start}:00`, actions: [{ service: act.service, entity_id: d.entity, ...(Object.keys(act.data).length ? { service_data: act.data } : {}) }] };
      if (d.stop) slot.stop = `${d.stop}:00`;
      service = "add";
      payload = { weekdays: weekdaysPayload(d.days, null, this._hass), timeslots: [slot], repeat_type: "repeat" };
      if (d.name.trim()) payload.name = d.name.trim();
      const tags = Array.isArray(this._config.tags) ? this._config.tags : this._config.tags ? [this._config.tags] : [];
      if (tags.length) payload.tags = tags.map(String);
    } else {
      if (!e.draft) return;
      if (!e.draft.days.size) return this._fail(this._t("err_days"));
      const r = this._slotsAfterEdit(e);
      if (r.error) return this._fail(r.error);
      service = "edit";
      payload = { entity_id: e.id, timeslots: r.slots, weekdays: this._weekdaysOf(e) };
      // scheduler.edit resets the dates it is not given: they are sent back as they are.
      if (e.item.start_date) payload.start_date = e.item.start_date;
      if (e.item.end_date) payload.end_date = e.item.end_date;
    }
    e.saving = true;
    e.error = null;
    this._update(this._sig);
    const error = await this._call("scheduler", service, payload);
    if (this._edit !== e) return;
    if (error) return this._fail(error);
    this._closeEdit();
  }

  // The weekdays to send: unchanged days keep the schedule's own (workday, weekend, daily).
  _weekdaysOf(e) {
    const same = e.initial && e.draft.days.size === e.initial.days.size && [...e.draft.days].every((d) => e.initial.days.has(d));
    return same && Array.isArray(e.item.weekdays) && e.item.weekdays.length ? e.item.weekdays : weekdaysPayload(e.draft.days, e.item.weekdays, this._hass);
  }

  _fail(message) {
    if (!this._edit) return;
    this._edit.saving = false;
    this._edit.error = message;
    this._update(this._sig);
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
        : await this._call("scheduler", "edit", {
            entity_id: e.id,
            timeslots: slots.filter((_s, k) => k !== e.index),
            ...(e.item.start_date ? { start_date: e.item.start_date } : {}),
            ...(e.item.end_date ? { end_date: e.item.end_date } : {}),
          });
    if (this._edit !== e) return;
    if (error) return this._fail(error);
    if (slots.length <= 1) this._view = null;
    this._closeEdit();
  }

  _toggle(id, on) {
    this._hass.callService("switch", on ? "turn_on" : "turn_off", { entity_id: id });
  }

  _change(ev) {
    const path = ev.composedPath();
    const sw = path.find((n) => n.dataset?.toggle);
    if (sw) {
      ev.stopPropagation();
      this._toggle(sw.dataset.toggle, !!sw.checked);
      return;
    }
    this._input(ev, true);
  }

  // A field of the popup: kept in the draft; a new action or entity redraws the popup (its value field).
  _input(ev, change = false) {
    const el = ev.composedPath()[0];
    const field = el?.dataset?.field;
    if (!field || !this._edit?.draft) return;
    const d = this._edit.draft;
    d[field] = el.value;
    if (field === "action" || (field === "entity" && change)) {
      const options = this._edit.mode === "new" ? this._newOptions(d.entity) : this._edit.options;
      if (field === "entity") d.action = options[0]?.key || "";
      const opt = options.find((o) => o.key === d.action);
      d.value = opt?.input ? String(num(d.value) ?? opt.input.min) : "";
      this._update(this._sig);
    } else if (field === "entity" && this._hass.states[d.entity]) {
      d.action = this._newOptions(d.entity)[0]?.key || "";
      this._update(this._sig);
    }
  }

  _click(ev) {
    const path = ev.composedPath();
    const action = path.find((n) => n.dataset?.action)?.dataset.action;
    if (this._edit) {
      // While the popup is open, its buttons and the backdrop act; a click elsewhere in it does nothing else.
      const day = path.find((n) => n.dataset?.dayt !== undefined);
      if (day && this._edit.draft) {
        const wd = Number(day.dataset.dayt);
        const days = this._edit.draft.days;
        if (days.has(wd)) days.delete(wd);
        else days.add(wd);
        this._update(this._sig);
        return;
      }
      if (action === "close" || (action === "backdrop" && path[0] === path.find((n) => n.dataset?.action === "backdrop"))) this._closeEdit();
      else if (action === "save") this._save();
      else if (action === "delete") this._delete();
      return;
    }
    if (path.some((n) => n.localName === "ha-switch")) return;
    if (action === "new") return this._openNew();
    if (action === "back") return this._showTimeline();
    if (action === "add-slot" && this._view) return this._openSlot(this._view, null);
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
            <div class="mhd"><span class="title">${esc(this._config.title || this._t("schedules"))}</span>${head ? `<span class="st">${esc(head)}</span>` : ""}${this._zoomButton()}</div>
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
const ON_BY_DEFAULT = ["illustration", "show_disabled", "editable", "zoom"];
const LANGUAGES = [
  ["en", "English"], ["fr", "Français"], ["de", "Deutsch"], ["es", "Español"], ["sr", "Српски"], ["sr-Latn", "Srpski (latinica)"],
  ["it", "Italiano"], ["nl", "Nederlands"], ["pt", "Português (Portugal)"], ["pl", "Polski"], ["ro", "Română"], ["da", "Dansk"],
  ["sv", "Svenska"], ["bg", "Български"], ["ru", "Русский"], ["uk", "Українська"], ["hu", "Magyar"], ["sk", "Slovenčina"],
  ["cs", "Čeština"], ["sl", "Slovenščina"], ["lv", "Latviešu"], ["el", "Ελληνικά"],
];

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
    const toggles = ["illustration", "show_disabled", "editable"];
    if (this.constructor.mini) toggles.push("zoom");
    const grid = [
      {
        name: "illustration_theme",
        selector: { select: { mode: "dropdown", options: ["auto", "day", "night"].map((v) => ({ value: v, label: tr(`theme_${v}`) })) } },
      },
    ];
    if (this.constructor.mini) grid.push({ name: "next_actions", selector: { number: { min: 1, max: 10, step: 1, mode: "box" } } });
    return [
      { name: "title", selector: { text: {} } },
      { type: "grid", name: "", schema: grid },
      { type: "grid", name: "", schema: toggles.map((name) => ({ name, selector: { boolean: {} } })) },
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
            v === undefined ||
            v === null ||
            (ON_BY_DEFAULT.includes(k) && v === true) ||
            (k === "illustration_theme" && v === "auto") ||
            (k === "next_actions" && v === 3)
          )
            delete config[k];
        }
        this._config = config;
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
      });
      this.appendChild(this._form);
    }
    const data = { illustration_theme: "auto", ...(this.constructor.mini ? { next_actions: 3 } : {}), ...this._config };
    for (const k of ON_BY_DEFAULT) if (data[k] === undefined) data[k] = true;
    this._form.hass = this._hass;
    this._form.data = data;
    this._form.schema = this._schema();
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
  if (!customElements.get(name)) customElements.define(name, cls);
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
