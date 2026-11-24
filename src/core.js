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

export const VERSION = "__VERSION__";

// mdi icon paths drawn by the card itself (the schedules' own icons come from their entities, through <ha-icon>).
export const ICONS = {
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
