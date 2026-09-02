import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  translate,
} from "../web/js/i18n.js";

test("the interface defaults to British English and also exposes Brazilian Portuguese", () => {
  assert.equal(DEFAULT_LOCALE, "en-GB");
  assert.deepEqual(SUPPORTED_LOCALES, ["pt-BR", "en-GB"]);
  assert.equal(translate("pt-BR", "heading"), "Jogo de Matemática");
  assert.equal(translate("en-GB", "heading"), "Maths Quiz Game");
  assert.equal(translate("pt-BR", "themeLight"), "Claro");
  assert.equal(translate("en-GB", "themeLight"), "Light");
  assert.equal(translate("pt-BR", "instructionModeShortcutPrefix"), "Pressione");
  assert.equal(translate("en-GB", "instructionModeShortcutSuffix"), "to cycle the difficulty.");
});

test("translations interpolate accessible values and fall back to British English", () => {
  assert.equal(
    translate("en-GB", "chooseOptionValue", { number: 2, value: "7.50" }),
    "Choose option 2: 7.50",
  );
  assert.equal(
    translate("pt-BR", "chooseOptionValue", { number: 2, value: "7,50" }),
    "Escolher opção 2: 7,50",
  );
  assert.equal(translate("unsupported", "heading"), "Maths Quiz Game");
});
