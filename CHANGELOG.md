# Changelog

## 1.4.0 - 2026-11-20

### Features
- `show_header_toggle: true`: one switch under the header to enable or disable every schedule of the card's `tags`, `exclude_tags` and `entities` at once, on the full card and the mini card's expanded view. On while they are all enabled, off otherwise, its label saying what a click does; from a mixed state a click enables them all. Disabled schedules stay in reach, even hidden with `show_disabled: false` or left out by the `enabled` tag. Only their enabled state changes; a schedule that cannot be switched is reported, the others are done. Off by default (#12).

### Fixes
- `editable: false` now also locks the schedules' switches, greyed but still showing their state; they used to stay usable on a read-only card.

## 1.3.0 - 2026-11-20

### Features
- Conditions with their own entity filters: `condition_include` and `condition_exclude` (entity ids, domains or `*` wildcards such as `binary_sensor.bedroom_*`), independent of the entities a schedule acts on, on the full card and the mini card's expanded view. Without them every entity is offered, as before; a condition already set on an entity outside them stays shown and editable, and nothing stored is rewritten.
- Guided condition values: a list of the entity's states shown in words while the real state is saved (on / off, the options of a select or an enum sensor, home / away and the zones, HVAC modes, lock, cover, alarm, media player, vacuum and mower states…); a number field with the entity's unit, minimum, maximum and step for numeric entities and for below / above; a free value for the entities whose states cannot be told, or with **Other value…**. A stored value missing from the list stays selected.
- `condition_states`: your own values for a condition, by entity id, `*` wildcard or domain — a list of states (`value` and `name`) or a number range (`min`, `max`, `step`, `unit`).
- `include` and `exclude` also take `*` wildcards.

## 1.2.0 - 2026-11-19

### Features
- Times relative to the sun: a slot's start and end can be an offset before or after sunrise or sunset, set in the slot editor and the new schedule popup, with today's time shown beside it.
- Day presets: Every day, Workdays and Weekend (the Workday sensor's, holidays skipped), or chosen days; a day clicked in a preset turns it into chosen days.
- Options of a schedule, in a tab of the slot editor and from the weekly grid's Options button: name, tags, conditions on other entities (is, is not, below, above; all or any; re-checked as soon as they change), a period between two dates, and after the last slot repeat, stop or delete; Duplicate makes a copy with `scheduler.copy`.
- New schedules of a single time (one action at a set time) or of time slots, on one entity or several of the same kind, with their options.
- Weekly grid: drag a slot's edges to move its start or end, by `time_step` (15 min by default); Split and Merge with next in the slot editor.
- Badges under each tile: time relative to the sun, workdays or weekend, the first condition, the dates and what happens after the last slot; « Starts … » for a schedule beginning later, and no upcoming action outside its dates (`show_badges: false` hides them).
- Tiles in the look shared by the ha-* cards: the icon always tinted in the schedule's colour (grey when disabled), the name in bold, a status dot on every tile in the schedule's colour while a slot runs.
- New options: `tags` also takes `none`, `enabled` and `disabled`; `exclude_tags`; `sort_by` (`name`, `next`, `state`); `include` and `exclude` for the entities a new schedule can act on; `customize` for your own actions; `time_step`; `show_badges`. `sort_by`, `time_step` and `show_badges` are in the visual editors.
- The full schedules are read again whenever the Scheduler component reports a change (its `scheduler_updated` subscription).

## 1.1.1 - 2026-11-18

### Fixes
- Illustrated header: `auto` now follows the Home Assistant theme alone — a light theme keeps the day picture after sunset, a dark theme still shows the night one.

## 1.1.0 - 2026-11-17

### Features
- New illustrated header, 90 px on the full card and the mini card: the title on the sky at the left, and at the right today's timeline of up to three schedules (those running now first) with their icons, their slots as coloured blocks over 0–24 h, the slot running now pulsing and a red "now" cursor following the clock; a ruler strip of the day runs along the bottom. It replaces the sun on its arc.
- Day, evening (the two hours before sunset) and night skies: night after sunset (`sun.sun`) or with Home Assistant's dark mode, even while the sun is up; `illustration_theme: day | night` forces it, `illustration: false` keeps the classic header.
- The header icon (mdi:calendar-clock) shows the status by its colour: teal while a schedule is running, grey when idle, amber when no schedule matches the filters, on both cards, day and night.
- The mini card gets the illustrated banner too, with the next action on its sky and its detail button at the top right, above its list of next actions.
- The "now" hint reads « Red line = now », in every language.
- A status pill right after the title, in the header icon's colour: *Running*, *Idle* or *No schedule* (beside the title only while the whole title and the pill's whole label fit on that row, measured in the real fonts so in every language; otherwise on its own line under the statistics, kept to one line, or under the next action of the classic mini card; only its dot when even that would not fit above the timeline strip and below 200 px), on the full and mini cards, with or without the illustration. The mini card's detail button is the small frosted round button in the banner's top right corner.

## 1.0.0 - 2026-11-16

### Features
- **Scheduler Card** (`custom:scheduler-card`) for the [Scheduler component](https://github.com/nielsfaber/scheduler-component) by nielsfaber: its `switch.schedule_*` entities are found by themselves (entity registry, or their entity ids), and read from their attributes (`weekdays`, `timeslots`, `actions`, `entities`, `current_slot`, `tags`).
- Illustrated header: a teal sky whose sun moves along its arc with the real time of day, between sunrise and sunset (`sun.sun`); after sunset, the moon follows the same arc under a night sky with twinkling stars (`illustration_theme: auto | day | night`, `illustration: false` for a classic header). The bottom strip shows today's slots of the enabled schedules, with a white "now" marker. `prefers-reduced-motion` is honoured.
- **Today's timeline**: enabled / disabled chips, then one tile per schedule with the icon of the entity it acts on (coloured while a slot is running), its name, a state line (« 20 °C now · 17 °C at 22:30 », « Off · on at 18:00 », « Done today · next 02:00 », « Disabled »), Home Assistant's own switch to enable or disable it, and a 0–24 h bar of today's slots with a "now" marker. A tinted **New schedule** button creates a schedule (`scheduler.add`).
- **Weekly grid** of a schedule, opened by a click on its row: text tabs to switch schedule, rows Monday to Sunday with the slots drawn as blocks labelled with their value, today highlighted with a "now" marker, the value covering the rest of the day as the background, a legend and the weekly total. Back to the timeline with the arrow, Escape, a click elsewhere, or when the card leaves the page.
- **Slot editor** in a popup at the top of the card: start, end, action (the schedule's own actions and those of its entity: on/off, open/close, a temperature or a position to enter, presets, options) and days; saved with `scheduler.edit` from the full schedule of the `scheduler` / `scheduler/item` websocket commands, conditions and dates kept, overlaps refused. A slot is added by clicking an empty spot of the grid or **Add slot**; deleting the last slot removes the schedule (`scheduler.remove`), after a confirmation.
- **Scheduler Mini Card** (`custom:scheduler-mini-card`): badge, title, the next action on the right, a detail button that unfolds the full card (folded back by a click elsewhere), and the next actions as compact rows (time, coloured icon, name, action; `next_actions`).
- Options: `title`, `tags` and `entities` filters, `names`, `show_disabled`, `editable`; visual editors for both cards, the mini card's with the full card's options; 22 languages, only English in the bundle and each other language loaded on demand.
