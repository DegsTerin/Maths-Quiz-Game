import assert from "node:assert/strict";
import test from "node:test";

import {
  readStoredPreference,
  storePreference,
} from "../web/js/preferences.js";

function createStorage(initialValues = {}) {
  const values = new Map(Object.entries(initialValues));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    values,
  };
}

test("valid saved choices take precedence over the new defaults", () => {
  const storage = createStorage({
    "mathsQuiz.theme": "light",
    "mathsQuiz.locale": "pt-BR",
  });
  const provideStorage = () => storage;

  assert.equal(
    readStoredPreference(provideStorage, "mathsQuiz.theme", ["light", "dark"], "dark"),
    "light",
  );
  assert.equal(
    readStoredPreference(
      provideStorage,
      "mathsQuiz.locale",
      ["pt-BR", "en-GB"],
      "en-GB",
    ),
    "pt-BR",
  );
});

test("missing, invalid or unavailable storage falls back safely", () => {
  const storage = createStorage({ "mathsQuiz.theme": "sepia" });

  assert.equal(
    readStoredPreference(() => storage, "mathsQuiz.theme", ["light", "dark"], "dark"),
    "dark",
  );
  assert.equal(
    readStoredPreference(() => storage, "mathsQuiz.locale", ["pt-BR", "en-GB"], "en-GB"),
    "en-GB",
  );
  assert.equal(
    readStoredPreference(() => { throw new Error("blocked"); }, "key", ["value"], "fallback"),
    "fallback",
  );
});

test("preference writes are persisted when storage is available and fail safely otherwise", () => {
  const storage = createStorage();

  storePreference(() => storage, "mathsQuiz.locale", "pt-BR");
  assert.equal(storage.values.get("mathsQuiz.locale"), "pt-BR");
  assert.doesNotThrow(() => {
    storePreference(() => { throw new Error("blocked"); }, "key", "value");
  });
});
