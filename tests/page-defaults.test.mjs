import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../web/index.html", import.meta.url), "utf8");

function getPreferenceButton(attribute, value) {
  const match = page.match(
    new RegExp(`<button(?=[^>]*\\b${attribute}="${value}")[^>]*>`),
  );
  assert.ok(match, `Missing preference button: ${attribute}=${value}`);
  return match[0];
}

test("a first visit starts in dark mode and British English", () => {
  assert.match(page, /<html lang="en-GB" data-theme="dark">/);
  assert.match(page, /<meta name="theme-color" content="#121925" id="theme-colour">/);
  assert.match(page, /<title>Maths Quiz Game \| Browser edition<\/title>/);

  assert.match(getPreferenceButton("data-theme-choice", "dark"), /aria-pressed="true"/);
  assert.match(getPreferenceButton("data-theme-choice", "light"), /aria-pressed="false"/);
  assert.match(getPreferenceButton("data-locale-choice", "en-GB"), /aria-pressed="true"/);
  assert.match(getPreferenceButton("data-locale-choice", "pt-BR"), /aria-pressed="false"/);
});
