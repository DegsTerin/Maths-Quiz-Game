import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  translate,
} from "../web/js/i18n.js";

test("the interface exposes Brazilian Portuguese and British English", () => {
  assert.equal(DEFAULT_LOCALE, "pt-BR");
  assert.deepEqual(SUPPORTED_LOCALES, ["pt-BR", "en-GB"]);
  assert.equal(translate("pt-BR", "heading"), "Jogo de Matemática");
  assert.equal(translate("en-GB", "heading"), "Maths Quiz Game");
  assert.equal(translate("pt-BR", "themeLight"), "Claro");
  assert.equal(translate("en-GB", "themeLight"), "Light");
});

test("translations interpolate accessible values and fall back to Portuguese", () => {
  assert.equal(
    translate("en-GB", "chooseOptionValue", { number: 2, value: "7.50" }),
    "Choose option 2: 7.50",
  );
  assert.equal(
    translate("pt-BR", "chooseOptionValue", { number: 2, value: "7,50" }),
    "Escolher opção 2: 7,50",
  );
  assert.equal(translate("unsupported", "heading"), "Jogo de Matemática");
});
