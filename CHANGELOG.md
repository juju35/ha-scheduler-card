# Changelog

## 1.8.0 - 2026-11-22

### Features
- **Entities of a schedule in the slot editor** (#23): a line above the times shows the entities the schedule acts on (name and icon); its **Change** button turns it into a picker of entities of the same kind (by `include` / `exclude`, at least one kept). Other entities replace the old ones in every slot, saved with `scheduler.edit`: a kept entity keeps its own action, an added one takes the action of the slot's first entity, and the schedule, its conditions, tags and dates stay the same.
- **Actions entity by entity** (#23): when the actions of a slot do not all share the same service and data, the **Action** field lists them entity by entity, each one editable.
- `show_entities: true` (also in the visual editor): the names of the entities each schedule acts on, under its tile's state line. Off by default.

### Fixes
- Saving a slot no longer rewrites its actions with the first entity's data: an action left untouched is sent back exactly as it was read, so a slot driving a light group at full brightness and another light dimmed keeps both values when only its times or days change.

### Maintenance
- New captures: the entities in the slot editor, the actions entity by entity, and the entities on the tiles; the screenshot mock takes the actions of a schedule (the garden lights on two lights).

## 1.7.3 - 2026-11-22

### Performance
- Card picker: the previews are back (`preview: true`), and light. Each card's preview is drawn only once it scrolls into view of Home Assistant's card picker, which otherwise builds the preview of every card at once: until then it holds Home Assistant's state (no render, no history request, no animation). On a dashboard or in the card editor the card is drawn as before.

## 1.7.2 - 2026-11-22

### Performance
- Card picker: the cards no longer ask Home Assistant for a live preview (`preview: false` in `window.customCards`). The picker drew every card at once (history requests, animations), which made the list slow to open; it now shows each card's description instead.

## 1.7.1 - 2026-11-21

### Fixes
- **Condition status** (#19): a condition stored with `attribute: "state"` — as the Scheduler component stores every condition on an entity's state — was read as an attribute named `state`, which does not exist, so every condition counted as not met (never a green dot, all conditions listed in the tooltip). `attribute: "state"` now means the entity's state, as in the component.

## 1.7.0 - 2026-11-21

### Features
- **Condition status** (#17): with `show_condition_status: true` (also in the visual editor), the dot of each tile's icon tells whether the conditions of the slot running now (or else the next one) hold — green when they do, an amber hourglass when they don't but are tracked (the slot waits and starts as soon as they hold), a red bar when they don't and the slot is skipped. Evaluated as the Scheduler component does (is / is not / below / above, all or any of them; an unavailable entity does not meet its condition), again whenever one of their entities changes. The tooltip lists the conditions not met. The green dot pulses; `condition_status_animation: false` keeps it still. Off by default: the tiles look as before.

### Maintenance
- New captures: the condition status (still and GIF of the pulse); the screenshot mock takes entity values and conditions per schedule.

## 1.6.0 - 2026-11-20

### Features
- Visual editor: the `entities`, `tags` and `exclude_tags` filters can be set there — a multiple entity picker, and tag lists offering the special values (`none`, `enabled`, `disabled`) and the tags of your schedules, or a new one typed in. Entities written as objects in YAML stay YAML-only (the field is then not shown, so nothing is lost).

### Fixes
- The status pill is placed from the card's first frame: it was measured before Home Assistant's `<ha-card>` had laid out its content (0 px wide), so for a frame it showed on the wrong line (under the title, or beside it when it belongs under it), sometimes changing the card's height, before jumping to its place. It is now fitted once the card is drawn.
- A card created again (another view, a dashboard opened) draws the schedules' conditions and dates from its first render, from the last ones read on the same connection, instead of growing by about 50 px when its own answer comes, which moved the page under it.

### Performance
- The schedules are found from the entity registry once per registry change, instead of walking every entity and every state on each state change of Home Assistant; the `switch.schedule_*` fallback is only read when the registry has no schedule.
- The visual editor no longer redraws its form on every state change while it is open.
- Without the Scheduler component's `scheduler_updated` subscription, the full schedules are read again only when a schedule entity changes, no longer on every minute tick or target change.

## 1.5.0 - 2026-11-20

### Features
- Custom actions with variables: an action of `customize` can take `variables`, each a number (`min`, `max`, `step`, `unit`, `scale_factor`) or a list of `options` (`value`, `name`, `icon`), with its `name` and `optional`. Their fields appear under the action in the slot editor and the new schedule popup, on the full card and the mini card's expanded view; the chosen values are merged into the action's fixed `service_data` and stored as ordinary action data. One « Heat to… » action with a temperature field replaces a fixed action per temperature (#13).
- Editing a slot whose stored action matches such an action selects it with its stored values; data the action does not set is kept, and the other slots, actions, conditions, dates and tags are left unchanged. A missing required value or a number out of range is refused. Fixed custom actions work as before.

## 1.4.0 - 2026-11-20

### Features
- `show_header_toggle: true`: one switch under the header to enable or disable every schedule of the card's `tags`, `exclude_tags` and `entities` at once, on the full card and the mini card's expanded view. On while any of them is enabled, its label saying what a click does; from a mixed state a click disables them all, as Home Assistant's header toggles. Disabled schedules stay in reach, even hidden with `show_disabled: false` or left out by the `enabled` tag. Only their enabled state changes; a schedule that cannot be switched is reported, the others are done. Off by default (#12).

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
