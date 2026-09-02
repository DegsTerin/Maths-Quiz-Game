import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const stylesheet = await readFile(new URL("../web/styles.css", import.meta.url), "utf8");
const page = await readFile(new URL("../web/index.html", import.meta.url), "utf8");
const application = await readFile(new URL("../web/js/app.js", import.meta.url), "utf8");

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
  assert.equal(getCustomProperty(darkTheme, "option-label-surface"), "#17232c");
  assert.equal(getCustomProperty(darkTheme, "option-label-text"), "#f3f8fb");
  assert.equal(getCustomProperty(lightTheme, "option-label-surface"), "#f3f1ea");
  assert.equal(getCustomProperty(lightTheme, "option-label-text"), "#282522");
  assert.notEqual(
    getCustomProperty(darkTheme, "option-label-radius"),
    getCustomProperty(lightTheme, "option-label-radius"),
  );
  assert.notEqual(
    getCustomProperty(darkTheme, "option-label-text-shadow"),
    getCustomProperty(lightTheme, "option-label-text-shadow"),
  );
});

test("the enclosure follows the physical front-panel proportions", () => {
  assert.match(getRule(".machine"), /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(getRule(".problem-panel"), /aspect-ratio:\s*2\.9\s*\/\s*1/);
  assert.match(getRule(".problem-panel"), /grid-template-columns:\s*repeat\(3,/);
  assert.match(getRule(".answer-card"), /aspect-ratio:\s*0\.8/);
  assert.match(getRule(".answer-card"), /align-content:\s*space-between/);
});

test("the enclosure has no protruding case tabs", () => {
  assert.doesNotMatch(page, /class="case-tab/);
  assert.doesNotMatch(stylesheet, /\.case-tab/);
  assert.doesNotMatch(stylesheet, /--case-tab/);
  assert.match(getRule(".machine"), /border:\s*2px solid var\(--machine-border\)/);
  assert.match(getRule(".machine::before"), /border:\s*2px solid var\(--machine-inner-border\)/);
  assert.match(getRule(".machine::after"), /var\(--screw-core\)/);
});

test("the display housing matches the SVG view box", () => {
  assert.match(getRule(".segment-display"), /aspect-ratio:\s*232\s*\/\s*96/);
  assert.match(getRule(".matrix-frame"), /width:\s*min\(100%,\s*220px\)/);
});

test("hardware labels and answer options reproduce the printed reference styling", () => {
  assert.match(getRule(".hardware-title"), /font-weight:\s*900/);
  assert.match(getRule(".hardware-title"), /text-shadow:\s*var\(--hardware-text-shadow\)/);
  assert.match(getRule(".answer-card h2"), /background:\s*var\(--option-label-surface\)/);
  assert.match(getRule(".answer-card h2"), /box-shadow:\s*var\(--option-label-shadow\)/);
  assert.match(getRule(".answer-card h2"), /border-radius:\s*var\(--option-label-radius\)/);
  assert.match(getRule(".answer-card h2"), /text-shadow:\s*var\(--option-label-text-shadow\)/);
});

test("hardware controls do not render keyboard shortcut badges", () => {
  const answerControls = page.match(/<section class="answers"[\s\S]*?<\/section>/)?.[0];
  const scoreboardControls = page.match(/<section class="control-panel[\s\S]*?<\/section>/)?.[0];

  assert.ok(answerControls);
  assert.ok(scoreboardControls);
  assert.equal(page.match(/class="answer-button-row"/g)?.length, 3);
  assert.equal(page.match(/class="control-button-row"/g)?.length, 2);
  assert.match(getRule(".answer-button-row,\n.control-button-row"), /display:\s*grid/);
  assert.match(getRule(".answer-button-row,\n.control-button-row"), /width:\s*fit-content/);
  assert.match(getRule(".answer-button-row,\n.control-button-row"), /justify-self:\s*center/);
  assert.doesNotMatch(answerControls, /<kbd/);
  assert.doesNotMatch(scoreboardControls, /<kbd/);
  assert.doesNotMatch(page, /class="key-hint"/);
  assert.doesNotMatch(page, /class="control-shortcut-row"/);
  assert.doesNotMatch(stylesheet, /\.key-hint|\.control-shortcut-row/);
  assert.doesNotMatch(stylesheet, /--hardware-key-/);
  assert.match(application, /\["1",\s*"2",\s*"3"\]\.includes\(event\.key\)/);
  assert.match(application, /event\.key\.toLowerCase\(\) === "r"/);
  assert.match(application, /event\.key\.toLowerCase\(\) === "m"/);
});

test("the mobile controls keep the standard single-row layout", () => {
  assert.match(stylesheet, /@media \(max-width:\s*720px\)[\s\S]*?\.lcd-module\s*{[^}]*width:\s*calc\(100% - 24px\);[^}]*justify-self:\s*center/);
  assert.match(getRule(".reset-control,\n.mode-control"), /align-self:\s*start/);
  assert.match(getRule(".reset-control .control-button-row"), /margin-top:\s*calc\(clamp\(28px,\s*4\.25vw,\s*44px\)\s*-\s*clamp\(21px,\s*3\.5vw,\s*33px\)\)/);
  assert.match(getRule(".lcd-module"), /align-self:\s*start/);
  assert.match(getRule(".lcd-module"), /margin-top:\s*calc\([\s\S]*clamp\(0\.82rem,\s*2\.45vw,\s*1\.6rem\)[\s\S]*clamp\(28px,\s*4\.25vw,\s*44px\)[\s\S]*clamp\(36px,\s*5vw,\s*54px\)/);
  assert.match(stylesheet, /@media \(max-width:\s*430px\)[\s\S]*?\.lcd-module\s*{[^}]*width:\s*min\(100%,\s*clamp\(100px,\s*38vw,\s*160px\)\);[^}]*margin-top:\s*calc\(clamp\(0\.7rem,\s*3\.25vw,\s*0\.92rem\) \+ 7px\);[^}]*padding:\s*3px/);
  assert.match(stylesheet, /@media \(max-width:\s*430px\)[\s\S]*?\.lcd-screen\s*{[^}]*font-size:\s*clamp\(0\.515625rem,\s*2\.8vw,\s*0\.78rem\);[^}]*letter-spacing:\s*0/);
  assert.match(stylesheet, /@media \(max-width:\s*430px\)[\s\S]*?\.control-panel\s*{[^}]*padding-inline:\s*clamp\(8px,\s*3vw,\s*12px\)/);
  assert.match(stylesheet, /@media \(max-width:\s*405px\)[\s\S]*?\.control-panel\s*{[^}]*grid-template-columns:\s*46px\s+minmax\(0,\s*1fr\)\s+64px/);
  assert.doesNotMatch(stylesheet, /grid-template-areas:\s*"lcd lcd"\s*"reset mode"/);
  assert.match(getRule("html"), /min-width:\s*280px/);
  assert.match(stylesheet, /@media \(max-width:\s*300px\)[\s\S]*?\.feedback-panel\s*{[^}]*grid-template-columns:\s*minmax\(68px,\s*1fr\)\s*minmax\(70px,\s*1fr\)\s*minmax\(68px,\s*1fr\)/);
});

test("correct and incorrect indicators use separate labelled plates", () => {
  assert.match(getRule(".feedback-lamp"), /display:\s*grid/);
  assert.match(getRule(".feedback-lamp"), /background:[\s\S]*var\(--feedback-plate\)/);
  assert.match(getRule(".feedback-lamp"), /box-shadow:[\s\S]*var\(--feedback-plate-shadow\)/);
});

test("the page requests the current tab-free stylesheet and iPhone feedback script", () => {
  assert.match(page, /rel="icon" href="\.\/favicon\.svg\?v=20260902"/);
  assert.match(page, /href="\.\/styles\.css\?v=20260902-larger-lcd-type"/);
  assert.match(page, /src="\.\/js\/app\.js\?v=20260902-lcd-project-credit"/);
  assert.match(application, /from "\.\/buzzer\.js\?v=20260902-iphone-feedback"/);
  assert.match(application, /from "\.\/game-engine\.js\?v=20260902-mode-shortcut"/);
  assert.match(application, /from "\.\/i18n\.js\?v=20260902-project-credit"/);
});
