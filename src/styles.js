// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
import { ACCENT } from "./actions.js";

export const STYLE = `
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
export const MINI_STYLE = `
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
export const ZOOM_STYLE = `
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
