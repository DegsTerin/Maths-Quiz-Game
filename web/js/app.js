import { createWrongAnswerFeedback } from "./buzzer.js?v=20260902-iphone-feedback";
import {
  Difficulty,
  getNextDifficulty,
  MathsQuizEngine,
  Operation,
  Status,
} from "./game-engine.js?v=20260902-mode-shortcut";
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  translate,
} from "./i18n.js?v=20260902-project-credit";
import {
  readStoredPreference,
  storePreference,
} from "./preferences.js?v=20260902-mode-shortcut";
import { parseDisplayCharacters } from "./segment-display.js?v=20260902-mode-shortcut";

const engine = new MathsQuizEngine();

const elements = {
  operandOne: document.querySelector("#operand-one"),
  operandTwo: document.querySelector("#operand-two"),
  answerDisplays: [
    document.querySelector("#answer-one"),
    document.querySelector("#answer-two"),
    document.querySelector("#answer-three"),
  ],
  answerButtons: [...document.querySelectorAll("[data-answer]")],
  answerCards: [...document.querySelectorAll("[data-answer-card]")],
  matrix: document.querySelector(".led-matrix"),
  matrixFrame: document.querySelector("#operation-matrix"),
  lcdLineOne: document.querySelector("#lcd-line-one"),
  lcdLineTwo: document.querySelector("#lcd-line-two"),
  correctLamp: document.querySelector("#correct-lamp"),
  incorrectLamp: document.querySelector("#incorrect-lamp"),
  resetButton: document.querySelector("#reset-button"),
  difficulty: document.querySelector("#difficulty-control"),
  rotaryPointer: document.querySelector(".rotary-control__pointer"),
  roundStatus: document.querySelector("#round-status"),
  liveRegion: document.querySelector("#live-region"),
  pageDescription: document.querySelector("#page-description"),
  themeColour: document.querySelector("#theme-colour"),
  themeButtons: [...document.querySelectorAll("[data-theme-choice]")],
  localeButtons: [...document.querySelectorAll("[data-locale-choice]")],
};

const OPERATION_MESSAGE_KEYS = Object.freeze({
  [Operation.NONE]: "operationOff",
  [Operation.ADD]: "operationAdd",
  [Operation.SUBTRACT]: "operationSubtract",
  [Operation.MULTIPLY]: "operationMultiply",
  [Operation.DIVIDE]: "operationDivide",
});

const DIFFICULTY_MESSAGE_KEYS = Object.freeze({
  [Difficulty.EASY]: "difficultyEasy",
  [Difficulty.MEDIUM]: "difficultyMedium",
  [Difficulty.HARD]: "difficultyHard",
});

const LCD_DIFFICULTY_MESSAGE_KEYS = Object.freeze({
  [Difficulty.EASY]: "lcdDifficultyEasy",
  [Difficulty.MEDIUM]: "lcdDifficultyMedium",
  [Difficulty.HARD]: "lcdDifficultyHard",
});

const LCD_OPERATION_MESSAGE_KEYS = Object.freeze({
  [Operation.ADD]: "lcdOperationAdd",
  [Operation.SUBTRACT]: "lcdOperationSubtract",
  [Operation.MULTIPLY]: "lcdOperationMultiply",
  [Operation.DIVIDE]: "lcdOperationDivide",
});

const STORAGE_KEYS = Object.freeze({
  locale: "mathsQuiz.locale",
  theme: "mathsQuiz.theme",
});

const THEMES = Object.freeze(["light", "dark"]);

const RAW_MATRIX_PATTERNS = Object.freeze({
  [Operation.NONE]: [
    "00000000",
    "00000000",
    "00000000",
    "00000000",
    "00000000",
    "00000000",
    "00000000",
    "00000000",
  ],
  [Operation.ADD]: [
    "00000000",
    "00011000",
    "00011000",
    "01111110",
    "01111110",
    "00011000",
    "00011000",
    "00000000",
  ],
  [Operation.SUBTRACT]: [
    "00000000",
    "00011000",
    "00011000",
    "00011000",
    "00011000",
    "00011000",
    "00011000",
    "00000000",
  ],
  [Operation.MULTIPLY]: [
    "00000000",
    "01000010",
    "00100100",
    "00011000",
    "00011000",
    "00100100",
    "01000010",
    "00000000",
  ],
  [Operation.DIVIDE]: [
    "00000000",
    "00011000",
    "00011000",
    "01011010",
    "01011010",
    "00011000",
    "00011000",
    "00000000",
  ],
});

const DIGIT_SEGMENTS = Object.freeze({
  "0": ["a", "b", "c", "d", "e", "f"],
  "1": ["b", "c"],
  "2": ["a", "b", "d", "e", "g"],
  "3": ["a", "b", "c", "d", "g"],
  "4": ["b", "c", "f", "g"],
  "5": ["a", "c", "d", "f", "g"],
  "6": ["a", "c", "d", "e", "f", "g"],
  "7": ["a", "b", "c"],
  "8": ["a", "b", "c", "d", "e", "f", "g"],
  "9": ["a", "b", "c", "d", "f", "g"],
  "-": ["g"],
  " ": [],
});

const SEGMENT_POINTS = Object.freeze({
  a: "9,3 38,3 43,8 38,13 9,13 4,8",
  b: "40,10 45,15 45,34 40,39 35,34 35,15",
  c: "40,43 45,48 45,67 40,72 35,67 35,48",
  d: "9,69 38,69 43,74 38,79 9,79 4,74",
  e: "7,43 12,48 12,67 7,72 2,67 2,48",
  f: "7,10 12,15 12,34 7,39 2,34 2,15",
  g: "9,36 38,36 43,41 38,46 9,46 4,41",
});

let activityToken = 0;
let currentLocale = DEFAULT_LOCALE;
let displayedMatrixOperation = Operation.NONE;
const reducedMotionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
const wrongAnswerFeedback = createWrongAnswerFeedback({
  globalObject: window,
  navigatorObject: navigator,
});

function t(key, variables = {}) {
  return translate(currentLocale, key, variables);
}

const getLocalStorage = () => window.localStorage;

function localiseDisplayValue(value) {
  return currentLocale === "pt-BR" ? value.replace(".", ",") : value;
}

function applyStaticTranslations() {
  document.documentElement.lang = currentLocale;
  document.title = t("pageTitle");
  elements.pageDescription.setAttribute("content", t("metaDescription"));

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
  });

  elements.localeButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.localeChoice === currentLocale));
  });
}

function applyTheme(theme, { persist = false, announceChange = false } = {}) {
  const selectedTheme = THEMES.includes(theme) ? theme : "dark";
  document.documentElement.dataset.theme = selectedTheme;
  elements.themeColour.setAttribute(
    "content",
    selectedTheme === "light" ? "#eef4f7" : "#121925",
  );
  elements.themeButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.themeChoice === selectedTheme));
  });

  if (persist) storePreference(getLocalStorage, STORAGE_KEYS.theme, selectedTheme);
  if (announceChange) {
    announce(t("themeChanged", { theme: t(`theme${selectedTheme === "light" ? "Light" : "Dark"}`).toLocaleLowerCase(currentLocale) }));
  }
}

function applyLocale(locale, { persist = false, announceChange = false } = {}) {
  currentLocale = SUPPORTED_LOCALES.includes(locale) ? locale : DEFAULT_LOCALE;
  applyStaticTranslations();
  renderRoundDisplays();
  renderState();
  updateDifficultyVisual();
  drawMatrix(displayedMatrixOperation);

  if (persist) storePreference(getLocalStorage, STORAGE_KEYS.locale, currentLocale);
  if (announceChange) announce(t("languageChanged"));
}

function transposePattern(pattern) {
  return Array.from({ length: 8 }, (_, column) =>
    Array.from({ length: 8 }, (_, row) => pattern[row][column]).join(""),
  );
}

const MATRIX_PATTERNS = Object.fromEntries(
  Object.entries(RAW_MATRIX_PATTERNS).map(([operation, pattern]) => [
    operation,
    transposePattern(pattern),
  ]),
);

function initialiseMatrix() {
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < 64; index += 1) {
    const led = document.createElement("span");
    led.className = "matrix-led";
    fragment.append(led);
  }
  elements.matrix.append(fragment);
}

function drawMatrix(operation) {
  displayedMatrixOperation = operation;
  const pattern = MATRIX_PATTERNS[operation] ?? MATRIX_PATTERNS[Operation.NONE];
  const leds = elements.matrix.children;

  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      leds[row * 8 + column].classList.toggle("is-on", pattern[row][column] === "1");
    }
  }

  elements.matrixFrame.setAttribute(
    "aria-label",
    operation === Operation.NONE
      ? t("matrixOff")
      : t("matrixOperation", { operation: t(OPERATION_MESSAGE_KEYS[operation]) }),
  );
}

function createSvgElement(name, attributes = {}) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, value);
  }
  return element;
}

function renderSegmentDisplay(element, value, label) {
  const characters = parseDisplayCharacters(value);
  const svg = createSvgElement("svg", {
    viewBox: "0 0 232 96",
    "aria-hidden": "true",
    focusable: "false",
  });

  characters.forEach(({ character, decimal }, digitIndex) => {
    const group = createSvgElement("g", {
      transform: `translate(${8 + digitIndex * 53} 6)`,
    });
    const activeSegments = new Set(DIGIT_SEGMENTS[character] ?? []);

    for (const [segmentName, points] of Object.entries(SEGMENT_POINTS)) {
      const segment = createSvgElement("polygon", {
        points,
        class: `segment${activeSegments.has(segmentName) ? " is-on" : ""}`,
      });
      group.append(segment);
    }

    const decimalPoint = createSvgElement("circle", {
      cx: "49",
      cy: "74",
      r: "4.2",
      class: `segment${decimal ? " is-on" : ""}`,
    });
    group.append(decimalPoint);
    svg.append(group);
  });

  element.replaceChildren(svg);
  element.dataset.value = value;
  element.setAttribute(
    "aria-label",
    `${label}: ${value ? localiseDisplayValue(value) : t("displayOff")}`,
  );
}

function renderRoundDisplays() {
  const round = engine.round;
  if (!round) {
    renderSegmentDisplay(elements.operandOne, "", t("firstNumberLabel"));
    renderSegmentDisplay(elements.operandTwo, "", t("secondNumberLabel"));
    elements.answerDisplays.forEach((display, index) => {
      renderSegmentDisplay(display, "", t("optionLabel", { number: index + 1 }));
      elements.answerButtons[index].setAttribute(
        "aria-label",
        t("chooseOption", { number: index + 1 }),
      );
    });
    return;
  }

  renderSegmentDisplay(
    elements.operandOne,
    engine.formatDisplayValue(round.operand1),
    t("firstNumberLabel"),
  );
  renderSegmentDisplay(
    elements.operandTwo,
    engine.formatDisplayValue(round.operand2),
    t("secondNumberLabel"),
  );
  round.options.forEach((answer, index) => {
    const formattedAnswer = engine.formatDisplayValue(answer, round.decimalPlaces);
    renderSegmentDisplay(
      elements.answerDisplays[index],
      formattedAnswer,
      t("optionLabel", { number: index + 1 }),
    );
    elements.answerButtons[index].setAttribute(
      "aria-label",
      t("chooseOptionValue", {
        number: index + 1,
        value: localiseDisplayValue(formattedAnswer),
      }),
    );
  });
}

function normaliseLcdLines(firstLine, secondLine) {
  return [firstLine, secondLine].map((line) => line.slice(0, 16).padEnd(16, " "));
}

function getEnglishLcdLines() {
  const difficulty = t(LCD_DIFFICULTY_MESSAGE_KEYS[engine.difficulty]);
  const score = t("lcdScore", {
    correct: engine.correctAnswers,
    incorrect: engine.incorrectAnswers,
  });

  if (engine.status === Status.SELECTING_OPERATION) {
    return normaliseLcdLines(
      t("lcdMode", { difficulty }),
      t("lcdSelecting"),
    );
  }

  if (engine.status === Status.SHOWING_CORRECT_ANSWER) {
    return normaliseLcdLines(t("lcdCorrect"), score);
  }

  if (engine.status === Status.SHOWING_INCORRECT_ANSWER) {
    return normaliseLcdLines(t("lcdIncorrect"), score);
  }

  return normaliseLcdLines(
    t("lcdGame", {
      difficulty,
      operation: t(LCD_OPERATION_MESSAGE_KEYS[engine.currentOperation]),
    }),
    score,
  );
}

function renderLcd() {
  const [firstLine, secondLine] = currentLocale === "pt-BR"
    ? engine.getLcdLines()
    : getEnglishLcdLines();
  elements.lcdLineOne.textContent = firstLine;
  elements.lcdLineTwo.textContent = secondLine;
}

function renderLamps() {
  elements.correctLamp.classList.toggle(
    "is-lit",
    engine.status === Status.SHOWING_CORRECT_ANSWER,
  );
  elements.incorrectLamp.classList.toggle(
    "is-lit",
    engine.status === Status.SHOWING_INCORRECT_ANSWER,
  );
}

function setAnswerButtonsEnabled(enabled) {
  elements.answerButtons.forEach((button) => {
    button.disabled = !enabled;
  });
}

function clearAnswerFeedback() {
  elements.answerCards.forEach((card) => {
    card.classList.remove("is-correct", "is-wrong");
  });
  elements.answerDisplays.forEach((display) => display.classList.remove("is-hidden"));
}

function renderStatusText() {
  if (engine.status === Status.SELECTING_OPERATION) {
    elements.roundStatus.textContent = t("statusSelecting");
  } else if (engine.status === Status.WAITING_FOR_ANSWER) {
    elements.roundStatus.textContent = t("statusWaiting");
  } else if (engine.status === Status.SHOWING_CORRECT_ANSWER) {
    elements.roundStatus.textContent = t("statusCorrect");
  } else {
    elements.roundStatus.textContent = t("statusIncorrect");
  }
}

function renderState() {
  renderLcd();
  renderLamps();
  renderStatusText();
  setAnswerButtonsEnabled(engine.status === Status.WAITING_FOR_ANSWER);
}

function announce(message) {
  elements.liveRegion.textContent = "";
  window.setTimeout(() => {
    elements.liveRegion.textContent = message;
  }, 20);
}

function wait(milliseconds, token) {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(token === activityToken), milliseconds);
  });
}

async function animateOperationSelection(animationSteps, token) {
  drawMatrix(Operation.NONE);

  if (reducedMotionMedia.matches) {
    drawMatrix(engine.chooseAnimatedOperation());
    engine.finishNewRound();
    renderRoundDisplays();
    renderState();
    announce(
      t("roundReady", {
        operation: t(OPERATION_MESSAGE_KEYS[engine.currentOperation]),
      }),
    );
    return;
  }

  for (let step = 0; step < animationSteps; step += 1) {
    if (!(await wait(100 + step * 10, token))) return;
    drawMatrix(engine.chooseAnimatedOperation());
  }

  const selectedOperation = engine.currentOperation;
  drawMatrix(Operation.NONE);

  if (!(await wait(500, token))) return;
  drawMatrix(selectedOperation);
  if (!(await wait(250, token))) return;
  drawMatrix(Operation.NONE);
  if (!(await wait(500, token))) return;
  drawMatrix(selectedOperation);
  if (!(await wait(250, token))) return;

  engine.finishNewRound();
  renderRoundDisplays();
  renderState();
  announce(
    t("roundReady", {
      operation: t(OPERATION_MESSAGE_KEYS[engine.currentOperation]),
    }),
  );
}

function prepareSelection(animationSteps, token) {
  clearAnswerFeedback();
  renderRoundDisplays();
  renderState();
  drawMatrix(Operation.NONE);
  void animateOperationSelection(animationSteps, token);
}

function startFreshRound({ resetScores = false } = {}) {
  activityToken += 1;
  const token = activityToken;
  const { animationSteps } = resetScores ? engine.resetGame() : engine.startNewRound();
  prepareSelection(animationSteps, token);
}

async function showIncorrectFeedback(answerIndex, token) {
  elements.answerCards[answerIndex].classList.add("is-wrong");
  void wrongAnswerFeedback.play();
  announce(t("answerWrongAnnouncement"));

  if (!(await wait(1000, token))) return;
  engine.finishIncorrectFeedback();
  elements.answerCards[answerIndex].classList.remove("is-wrong");
  renderState();
}

async function showCorrectFeedback(token) {
  const correctIndex = engine.round.correctIndex;
  const display = elements.answerDisplays[correctIndex];
  elements.answerCards[correctIndex].classList.add("is-correct");
  announce(t("answerCorrectAnnouncement"));

  if (reducedMotionMedia.matches) {
    if (!(await wait(5000, token))) return;
  } else {
    for (let toggle = 0; toggle < 10; toggle += 1) {
      if (!(await wait(500, token))) return;
      display.classList.toggle("is-hidden", toggle % 2 === 1);
    }
  }

  const nextRound = engine.finishCorrectFeedback();
  if (!nextRound || token !== activityToken) return;
  prepareSelection(nextRound.animationSteps, token);
}

function pressButtonMomentarily(button) {
  button.classList.add("is-pressed");
  window.setTimeout(() => button.classList.remove("is-pressed"), 140);
}

function handleAnswer(answerIndex) {
  const button = elements.answerButtons[answerIndex];
  pressButtonMomentarily(button);

  const outcome = engine.submitAnswer(answerIndex);
  if (!outcome.accepted) return;

  void wrongAnswerFeedback.unlock();
  const token = activityToken;
  renderState();
  if (outcome.correct) {
    void showCorrectFeedback(token);
  } else {
    void showIncorrectFeedback(answerIndex, token);
  }
}

function updateDifficultyVisual() {
  const difficulty = Number(elements.difficulty.value);
  const angle = { 1: -42, 2: 0, 3: 42 }[difficulty];
  elements.rotaryPointer.style.transform = `rotate(${angle}deg)`;
  elements.difficulty.setAttribute("aria-valuetext", t(DIFFICULTY_MESSAGE_KEYS[difficulty]));
}

function changeDifficulty(value) {
  const difficulty = Math.max(1, Math.min(3, Number(value)));
  elements.difficulty.value = String(difficulty);
  engine.setDifficulty(difficulty);
  updateDifficultyVisual();
  announce(t("difficultyQueued", { difficulty: t(DIFFICULTY_MESSAGE_KEYS[difficulty]) }));
}

elements.answerButtons.forEach((button, index) => {
  button.addEventListener("click", () => handleAnswer(index));
});

elements.resetButton.addEventListener("click", () => {
  startFreshRound({ resetScores: true });
  announce(t("scoreResetAnnouncement"));
});

elements.difficulty.addEventListener("input", (event) => {
  changeDifficulty(event.currentTarget.value);
});

elements.themeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    applyTheme(button.dataset.themeChoice, { persist: true, announceChange: true });
  });
});

elements.localeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    applyLocale(button.dataset.localeChoice, { persist: true, announceChange: true });
  });
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) wrongAnswerFeedback.release();
});

window.addEventListener("pagehide", () => wrongAnswerFeedback.release());

document.addEventListener("keydown", (event) => {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;

  const targetIsControl = event.target instanceof HTMLElement &&
    event.target.matches(
      'input, button, select, textarea, a[href], [contenteditable]:not([contenteditable="false"])',
    );

  if (!targetIsControl && ["1", "2", "3"].includes(event.key)) {
    event.preventDefault();
    handleAnswer(Number(event.key) - 1);
    return;
  }

  if (!targetIsControl && event.key.toLowerCase() === "r") {
    event.preventDefault();
    elements.resetButton.click();
    return;
  }

  if (!targetIsControl && event.key.toLowerCase() === "m") {
    event.preventDefault();
    changeDifficulty(getNextDifficulty(engine.pendingDifficulty));
    return;
  }

  if (!targetIsControl && ["ArrowLeft", "ArrowRight"].includes(event.key)) {
    event.preventDefault();
    const offset = event.key === "ArrowLeft" ? -1 : 1;
    changeDifficulty(Number(elements.difficulty.value) + offset);
  }
});

initialiseMatrix();
applyTheme(readStoredPreference(getLocalStorage, STORAGE_KEYS.theme, THEMES, "dark"));
applyLocale(
  readStoredPreference(
    getLocalStorage,
    STORAGE_KEYS.locale,
    SUPPORTED_LOCALES,
    DEFAULT_LOCALE,
  ),
);
startFreshRound();
