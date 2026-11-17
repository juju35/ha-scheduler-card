// Bundles src/scheduler-card.js into the single Marketplace file dist/scheduler-card.js, stamping the version.
// Usage: node scripts/build.mjs  (dist/ is not committed: CI and the release workflow build it)
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { splitDist } from "./i18n-split.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const pkg = JSON.parse(readFileSync(`${root}package.json`, "utf8"));

const out = `/*! ha-scheduler-card v${pkg.version} — https://github.com/juju35/ha-scheduler-card */\n${readFileSync(`${root}src/scheduler-card.js`, "utf8").replace("__VERSION__", pkg.version)}`;

mkdirSync(`${root}dist`, { recursive: true });
writeFileSync(`${root}dist/scheduler-card.js`, out);
console.log(`Built dist/scheduler-card.js (${(out.length / 1024).toFixed(1)} KB)`);

// Translations: English stays in the bundle, each other language goes to dist/scheduler-card.i18n.<lang>.js,
// fetched when a card needs it (scripts/i18n-split.mjs).
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) splitDist(`${root}dist`, "scheduler-card.js", { version: pkg.version });
