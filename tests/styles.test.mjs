import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const stylesheet = await readFile(new URL("../web/styles.css", import.meta.url), "utf8");

function getRule(selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = stylesheet.match(new RegExp(`^${escapedSelector}\\s*\\{([\\s\\S]*?)^\\}`, "m"));
  assert.ok(match, `Missing CSS rule: ${selector}`);
  return match[1];
}

function getCustomProperty(rule, property) {
  const match = rule.match(new RegExp(`--${property}:\\s*([^;]+);`));
  assert.ok(match, `Missing custom property: --${property}`);
  return match[1].trim();
}

test("dark and light themes provide distinct hardware surfaces", () => {
  const darkTheme = getRule(":root");
  const lightTheme = getRule('html[data-theme="light"]');

  for (const property of ["paper", "hardware-surface", "green", "blue", "orange"]) {
    assert.notEqual(
      getCustomProperty(darkTheme, property),
      getCustomProperty(lightTheme, property),
      `--${property} should change with the selected theme`,
    );
  }

  assert.equal(getCustomProperty(darkTheme, "hardware-label"), "#eef5f8");
  assert.equal(getCustomProperty(lightTheme, "hardware-label"), "#22282d");
});

test("the enclosure follows the physical front-panel proportions", () => {
  assert.match(getRule(".machine"), /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(getRule(".problem-panel"), /aspect-ratio:\s*2\.9\s*\/\s*1/);
  assert.match(getRule(".problem-panel"), /grid-template-columns:\s*repeat\(3,/);
  assert.match(getRule(".answer-card"), /aspect-ratio:\s*0\.8/);
  assert.match(getRule(".answer-card"), /align-content:\s*space-between/);
});

test("the display housing matches the SVG view box", () => {
  assert.match(getRule(".segment-display"), /aspect-ratio:\s*232\s*\/\s*96/);
  assert.match(getRule(".matrix-frame"), /width:\s*min\(100%,\s*220px\)/);
});
