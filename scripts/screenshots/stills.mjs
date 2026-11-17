// Renders the cards with the mock schedules (scripts/screenshots/mock.mjs) into screenshots/*.png, light and dark.
// Usage: npm install && npm run build && node scripts/screenshots/stills.mjs
import { cardClip, freeze, launch, mountCard, openPage, root, writeIfChanged } from "./harness.mjs";
import { FULL, SHOTS } from "./list.mjs";

const browser = await launch();
for (const s of SHOTS) {
  const width = s.width ?? FULL;
  const page = await openPage(browser, { theme: s.theme, width, label: s.file, now: s.now });
  await mountCard(page, { tag: s.tag, config: s.config, dark: s.theme === "dark", now: s.now, clicks: s.clicks });
  await page.waitForTimeout(400);
  await freeze(page, 0.5);
  const out = `screenshots/${s.file}.png`;
  const png = await page.screenshot({ clip: await cardClip(page, width, { min: s.min }), animations: "allow" });
  console.log(`${out}${(await writeIfChanged(page, `${root}${out}`, png)) ? "" : " (unchanged)"}`);
  await page.close();
}
await browser.close();
