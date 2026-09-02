import assert from "node:assert/strict";
import test from "node:test";

import {
  Difficulty,
  getNextDifficulty,
  MathsQuizEngine,
  Operation,
  Status,
} from "../web/js/game-engine.js";
import { parseDisplayCharacters } from "../web/js/segment-display.js";

function createSeededRandom(seed = 0x5f3759df) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function createSequenceRandom(...values) {
  let index = 0;
  return () => {
    const value = values[Math.min(index, values.length - 1)];
    index += 1;
    return value;
  };
}

function assertDisplayable(engine, value, decimalPlaces = -1) {
  const formatted = engine.formatDisplayValue(value, decimalPlaces);
  assert.notEqual(formatted, "");
  assert.ok(formatted.replace(".", "").length <= 4, `${formatted} exceeds four digits`);
}

test("the mode shortcut cycles easy, medium, hard, then easy", () => {
  assert.equal(getNextDifficulty(Difficulty.EASY), Difficulty.MEDIUM);
  assert.equal(getNextDifficulty(Difficulty.MEDIUM), Difficulty.HARD);
  assert.equal(getNextDifficulty(Difficulty.HARD), Difficulty.EASY);
  assert.equal(getNextDifficulty("invalid"), Difficulty.EASY);
});

test("operation selection uses the Arduino thresholds for each level", () => {
  const cases = [
    [Difficulty.EASY, 0.39, Operation.ADD],
    [Difficulty.EASY, 0.4, Operation.SUBTRACT],
    [Difficulty.EASY, 0.75, Operation.MULTIPLY],
    [Difficulty.EASY, 0.92, Operation.DIVIDE],
    [Difficulty.MEDIUM, 0.29, Operation.ADD],
    [Difficulty.MEDIUM, 0.3, Operation.SUBTRACT],
    [Difficulty.MEDIUM, 0.55, Operation.MULTIPLY],
    [Difficulty.MEDIUM, 0.78, Operation.DIVIDE],
    [Difficulty.HARD, 0.19, Operation.ADD],
    [Difficulty.HARD, 0.2, Operation.SUBTRACT],
    [Difficulty.HARD, 0.4, Operation.MULTIPLY],
    [Difficulty.HARD, 0.7, Operation.DIVIDE],
  ];

  for (const [difficulty, randomValue, expected] of cases) {
    const engine = new MathsQuizEngine({ random: createSequenceRandom(randomValue) });
    engine.difficulty = difficulty;
    assert.equal(engine.drawOperationForLevel(), expected);
  }
});

test("generated rounds stay within four-digit hardware display limits", () => {
  const engine = new MathsQuizEngine({ random: createSeededRandom() });

  for (const difficulty of [Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD]) {
    engine.setDifficulty(difficulty);

    for (let iteration = 0; iteration < 750; iteration += 1) {
      const { animationSteps } = engine.startNewRound();
      assert.ok(animationSteps >= 10 && animationSteps <= 14);
      engine.chooseAnimatedOperation();
      const round = engine.finishNewRound();

      assert.equal(engine.status, Status.WAITING_FOR_ANSWER);
      assert.ok(round.result >= 0 && round.result < 10000);
      assert.ok(round.decimalPlaces >= 0 && round.decimalPlaces <= 3);
      assertDisplayable(engine, round.operand1);
      assertDisplayable(engine, round.operand2);
      round.options.forEach((option) => assertDisplayable(engine, option, round.decimalPlaces));

      assert.equal(round.options.length, 3);
      assert.ok(Math.abs(round.options[round.correctIndex] - round.result) < 0.0005);

      if (round.operation === Operation.SUBTRACT) {
        assert.ok(round.operand1 - round.operand2 >= 0);
      }
      if (round.operation === Operation.DIVIDE) {
        assert.notEqual(round.operand2, 0);
      }
    }
  }
});

test("operand limits and decimal chances match every Arduino difficulty", () => {
  const limits = [
    [Difficulty.EASY, 10, 5, 25, 0.1],
    [Difficulty.MEDIUM, 50, 12, 144, 0.2],
    [Difficulty.HARD, 100, 20, 400, 0.3],
  ];

  for (const [difficulty, numberLimit, factorLimit, dividendLimit, decimalChance] of limits) {
    const maximumDraw = 0.999999;
    const engine = new MathsQuizEngine({ random: createSequenceRandom(maximumDraw) });
    engine.difficulty = difficulty;

    engine.currentOperation = Operation.ADD;
    assert.deepEqual(engine.drawOperands(), [numberLimit, numberLimit]);
    engine.currentOperation = Operation.SUBTRACT;
    assert.deepEqual(engine.drawOperands(), [numberLimit, numberLimit]);
    engine.currentOperation = Operation.MULTIPLY;
    assert.deepEqual(engine.drawOperands(), [factorLimit, factorLimit]);
    engine.currentOperation = Operation.DIVIDE;
    assert.deepEqual(engine.drawOperands(), [dividendLimit, factorLimit]);

    engine.random = createSequenceRandom(decimalChance - 0.000001, decimalChance);
    assert.equal(engine.shouldUseDecimalRound(), true);
    assert.equal(engine.shouldUseDecimalRound(), false);
  }
});

test("division precision accepts only terminating results with at most three places", () => {
  const engine = new MathsQuizEngine();
  assert.equal(engine.getRequiredDecimalPlacesForExactDivision(1, 2), 1);
  assert.equal(engine.getRequiredDecimalPlacesForExactDivision(3, 4), 2);
  assert.equal(engine.getRequiredDecimalPlacesForExactDivision(1, 8), 3);
  assert.equal(engine.getRequiredDecimalPlacesForExactDivision(1, 3), -1);
});

test("answer collisions retain the Arduino result after ten redraws", () => {
  const engine = new MathsQuizEngine({ random: () => 0.5 });
  engine.difficulty = Difficulty.EASY;
  const round = engine.buildAnswerOptions(0, 0);

  assert.deepEqual(round, { options: [5, 0, 5], correctIndex: 1 });
});

test("wrong-answer bounds use the Arduino Uno float32 arithmetic", () => {
  const engine = new MathsQuizEngine({ random: createSequenceRandom(0, 0.999999) });
  engine.difficulty = Difficulty.EASY;

  const minimumOffsetAnswer = engine.drawNearbyWrongAnswer(8.9, 1, 1);
  const arduinoResult = engine.performOperation(7.6, 4.2, Operation.ADD);
  const maximumOffsetAnswer = engine.drawNearbyWrongAnswer(arduinoResult, 2, 1);

  assert.equal(engine.formatDisplayValue(minimumOffsetAnswer, 1), "9.2");
  assert.equal(engine.formatDisplayValue(maximumOffsetAnswer, 2), "24.51");
});

test("an incorrect answer increments errors and keeps the same question", () => {
  const engine = new MathsQuizEngine({ random: createSeededRandom(123) });
  engine.startNewRound();
  engine.currentOperation = Operation.ADD;
  const round = engine.finishNewRound();
  const wrongIndex = (round.correctIndex + 1) % 3;

  const outcome = engine.submitAnswer(wrongIndex);

  assert.deepEqual(outcome, { accepted: true, correct: false });
  assert.equal(engine.incorrectAnswers, 1);
  assert.equal(engine.correctAnswers, 0);
  assert.equal(engine.status, Status.SHOWING_INCORRECT_ANSWER);
  assert.equal(engine.round, round);

  engine.finishIncorrectFeedback();
  assert.equal(engine.status, Status.WAITING_FOR_ANSWER);
  assert.equal(engine.round, round);
});

test("a correct answer preserves the score and starts a fresh selection", () => {
  const engine = new MathsQuizEngine({ random: createSeededRandom(456) });
  engine.startNewRound();
  engine.currentOperation = Operation.MULTIPLY;
  const round = engine.finishNewRound();

  const outcome = engine.submitAnswer(round.correctIndex);
  assert.deepEqual(outcome, { accepted: true, correct: true });
  assert.equal(engine.correctAnswers, 1);
  assert.equal(engine.status, Status.SHOWING_CORRECT_ANSWER);

  const selection = engine.finishCorrectFeedback();
  assert.ok(selection.animationSteps >= 10 && selection.animationSteps <= 14);
  assert.equal(engine.correctAnswers, 1);
  assert.equal(engine.status, Status.SELECTING_OPERATION);
  assert.equal(engine.round, null);
});

test("reset clears both counters and honours the selected next difficulty", () => {
  const engine = new MathsQuizEngine({ random: createSeededRandom(789) });
  engine.correctAnswers = 7;
  engine.incorrectAnswers = 4;
  engine.setDifficulty(Difficulty.HARD);

  engine.resetGame();

  assert.equal(engine.correctAnswers, 0);
  assert.equal(engine.incorrectAnswers, 0);
  assert.equal(engine.difficulty, Difficulty.HARD);
  assert.equal(engine.status, Status.SELECTING_OPERATION);
});

test("difficulty changes take effect only when the next round begins", () => {
  const engine = new MathsQuizEngine({ random: createSeededRandom(42) });
  engine.startNewRound();
  assert.equal(engine.difficulty, Difficulty.EASY);

  engine.setDifficulty(Difficulty.MEDIUM);
  assert.equal(engine.difficulty, Difficulty.EASY);
  assert.equal(engine.pendingDifficulty, Difficulty.MEDIUM);

  engine.startNewRound();
  assert.equal(engine.difficulty, Difficulty.MEDIUM);
});

test("LCD text mirrors the literal 16x2 Portuguese sketch messages", () => {
  const engine = new MathsQuizEngine({ random: createSeededRandom(99) });
  engine.startNewRound();
  assert.deepEqual(engine.getLcdLines(), ["Modo: Facil     ", "Sorteando ...   "]);

  engine.currentOperation = Operation.DIVIDE;
  engine.finishNewRound();
  assert.deepEqual(engine.getLcdLines(), ["Facil Div       ", "Certo:0 Erro:0  "]);

  const wrongIndex = (engine.round.correctIndex + 1) % 3;
  engine.submitAnswer(wrongIndex);
  assert.deepEqual(engine.getLcdLines(), ["Resposta Errada ", "Certo:0 Erro:1  "]);
});

test("display formatting preserves trailing decimal places selected for a round", () => {
  const engine = new MathsQuizEngine();
  assert.equal(engine.formatDisplayValue(7), "7");
  assert.equal(engine.formatDisplayValue(7.5, 2), "7.50");
  assert.equal(engine.formatDisplayValue(0.5, 1), ".5");
  assert.equal(engine.formatDisplayValue(0.5, 2), ".50");
  assert.equal(engine.formatDisplayValue(0.05, 2), ". 5");
  assert.equal(engine.formatDisplayValue(0.125, 3), "0.125");
  assert.equal(engine.formatDisplayValue(123.4, 1), "123.4");
  assert.equal(engine.formatDisplayValue(10000), "");
});

test("segment slots match the TM1637 suppression of fractional leading zeroes", () => {
  assert.deepEqual(parseDisplayCharacters(". 5"), [
    { character: " ", decimal: false },
    { character: " ", decimal: true },
    { character: " ", decimal: false },
    { character: "5", decimal: false },
  ]);
  assert.deepEqual(parseDisplayCharacters(".50"), [
    { character: " ", decimal: false },
    { character: " ", decimal: true },
    { character: "5", decimal: false },
    { character: "0", decimal: false },
  ]);
});
