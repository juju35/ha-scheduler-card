// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------
import { pickerDefine } from "./card-picker.js";
import { VERSION } from "./core.js";
import { ACCENT } from "./actions.js";
import { SchedulerCard } from "./full-card.js";
import { SchedulerMiniCard } from "./mini-card.js";
import { SchedulerCardEditor, SchedulerMiniCardEditor } from "./visual-editors.js";

export const define = (name, cls) => {
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
