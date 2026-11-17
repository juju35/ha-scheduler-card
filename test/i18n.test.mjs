// Every language has every text of the English source, the same {placeholders}, and the plural forms it needs.
import assert from "node:assert/strict";
import { test } from "node:test";
import { load } from "./load.mjs";

const { STRINGS } = load(["STRINGS"]);
const LANGS = ["en", "fr", "de", "es", "sr", "sr-Latn", "it", "nl", "pt", "pl", "ro", "da", "sv", "bg", "ru", "uk", "hu", "sk", "cs", "sl", "lv", "el"];
const PLURAL = /_(zero|one|two|few|many|other)$/;
const vars = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");

test("the 22 languages, no more", () => {
  assert.deepEqual(Object.keys(STRINGS).sort(), [...LANGS].sort());
});

test("every language has every English text, with the same placeholders", () => {
  const keys = Object.keys(STRINGS.en).filter((k) => !PLURAL.test(k));
  for (const lang of LANGS) {
    for (const k of keys) {
      assert.ok(typeof STRINGS[lang][k] === "string" && STRINGS[lang][k].length, `${lang}.${k}`);
      assert.equal(vars(STRINGS[lang][k]), vars(STRINGS.en[k]), `${lang}.${k} placeholders`);
    }
    for (const k of Object.keys(STRINGS[lang])) assert.ok(k in STRINGS.en || PLURAL.test(k), `${lang}.${k} is not an English key`);
  }
});

test("plural texts: an `_other` form and every form the language's plural rules use", () => {
  for (const lang of LANGS) {
    const cats = new Intl.PluralRules(lang === "pt" ? "pt-PT" : lang).resolvedOptions().pluralCategories;
    for (const base of ["enabled", "disabled"]) {
      assert.ok(STRINGS[lang][`${base}_other`], `${lang}.${base}_other`);
      // French and Portuguese "many" (a million) reads like "other".
      for (const c of cats) if (!(c === "many" && ["fr", "pt", "it", "es"].includes(lang))) assert.ok(STRINGS[lang][`${base}_${c}`], `${lang}.${base}_${c}`);
    }
  }
});
