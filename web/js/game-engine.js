export const Difficulty = Object.freeze({
  EASY: 1,
  MEDIUM: 2,
  HARD: 3,
});

export const Operation = Object.freeze({
  NONE: "none",
  ADD: "add",
  SUBTRACT: "subtract",
  MULTIPLY: "multiply",
  DIVIDE: "divide",
});

export const Status = Object.freeze({
  SELECTING_OPERATION: "selecting-operation",
  WAITING_FOR_ANSWER: "waiting-for-answer",
  SHOWING_CORRECT_ANSWER: "showing-correct-answer",
  SHOWING_INCORRECT_ANSWER: "showing-incorrect-answer",
});

const NUMBER_LIMITS = Object.freeze({
  [Difficulty.EASY]: 10,
  [Difficulty.MEDIUM]: 50,
  [Difficulty.HARD]: 100,
});

const MULTIPLICATION_LIMITS = Object.freeze({
  [Difficulty.EASY]: 5,
  [Difficulty.MEDIUM]: 12,
  [Difficulty.HARD]: 20,
});

const DIVISOR_LIMITS = Object.freeze({
  [Difficulty.EASY]: 5,
  [Difficulty.MEDIUM]: 12,
  [Difficulty.HARD]: 20,
});

const DIVIDEND_LIMITS = Object.freeze({
  [Difficulty.EASY]: 25,
  [Difficulty.MEDIUM]: 144,
  [Difficulty.HARD]: 400,
});

const DECIMAL_CHANCES = Object.freeze({
  [Difficulty.EASY]: 10,
  [Difficulty.MEDIUM]: 20,
  [Difficulty.HARD]: 30,
});

const OPERATION_WEIGHTS = Object.freeze({
  [Difficulty.EASY]: [40, 75, 92],
  [Difficulty.MEDIUM]: [30, 55, 78],
  [Difficulty.HARD]: [20, 40, 70],
});

const LEVEL_NAMES = Object.freeze({
  [Difficulty.EASY]: "Facil",
  [Difficulty.MEDIUM]: "Medio",
  [Difficulty.HARD]: "Dificil",
});

const OPERATION_NAMES = Object.freeze({
  [Operation.NONE]: "----",
  [Operation.ADD]: "Soma",
  [Operation.SUBTRACT]: "Sub",
  [Operation.MULTIPLY]: "Mult",
  [Operation.DIVIDE]: "Div",
});

const OPERATIONS = [
  Operation.ADD,
  Operation.SUBTRACT,
  Operation.MULTIPLY,
  Operation.DIVIDE,
];

const MAX_WRONG_ANSWER_OFFSET = 10;

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function nearlyEqual(first, second) {
  return Math.abs(first - second) < 0.0005;
}

function toArduinoFloat(value) {
  // Arduino Uno stores both float and double as 32-bit IEEE-754 values.
  return Math.fround(value);
}

function roundArduinoFloatToDecimalPlaces(value, decimalPlaces) {
  let factor = toArduinoFloat(1);
  for (let index = 0; index < decimalPlaces; index += 1) {
    factor = toArduinoFloat(factor * 10);
  }

  const scaledValue = toArduinoFloat(toArduinoFloat(value) * factor);
  const roundedInteger = scaledValue < 0
    ? -Math.round(-scaledValue)
    : Math.round(scaledValue);
  return toArduinoFloat(roundedInteger / factor);
}

export class MathsQuizEngine {
  constructor({ random = Math.random } = {}) {
    this.random = random;
    this.pendingDifficulty = Difficulty.EASY;
    this.difficulty = Difficulty.EASY;
    this.correctAnswers = 0;
    this.incorrectAnswers = 0;
    this.status = Status.SELECTING_OPERATION;
    this.currentOperation = Operation.NONE;
    this.round = null;
  }

  randomInt(minimum, maximumExclusive) {
    if (maximumExclusive <= minimum) {
      return minimum;
    }

    return minimum + Math.floor(this.random() * (maximumExclusive - minimum));
  }

  setDifficulty(difficulty) {
    const value = Number(difficulty);
    if (![Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD].includes(value)) {
      throw new RangeError("Difficulty must be 1, 2, or 3.");
    }

    this.pendingDifficulty = value;
  }

  startNewRound() {
    this.difficulty = this.pendingDifficulty;
    this.status = Status.SELECTING_OPERATION;
    this.currentOperation = Operation.NONE;
    this.round = null;

    return {
      animationSteps: this.randomInt(10, 15),
    };
  }

  chooseAnimatedOperation() {
    this.currentOperation = this.drawOperationForLevel();
    return this.currentOperation;
  }

  finishNewRound() {
    if (this.currentOperation === Operation.NONE) {
      this.currentOperation = this.drawOperationForLevel();
    }

    this.round = this.generateRound();
    this.status = Status.WAITING_FOR_ANSWER;
    return this.round;
  }

  submitAnswer(answerIndex) {
    if (this.status !== Status.WAITING_FOR_ANSWER || !this.round) {
      return { accepted: false };
    }

    if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex > 2) {
      throw new RangeError("Answer index must be 0, 1, or 2.");
    }

    const correct = answerIndex === this.round.correctIndex;
    if (correct) {
      this.correctAnswers += 1;
      this.status = Status.SHOWING_CORRECT_ANSWER;
    } else {
      this.incorrectAnswers += 1;
      this.status = Status.SHOWING_INCORRECT_ANSWER;
    }

    return { accepted: true, correct };
  }

  finishIncorrectFeedback() {
    if (this.status === Status.SHOWING_INCORRECT_ANSWER) {
      this.status = Status.WAITING_FOR_ANSWER;
    }
  }

  finishCorrectFeedback() {
    if (this.status === Status.SHOWING_CORRECT_ANSWER) {
      return this.startNewRound();
    }

    return null;
  }

  resetGame() {
    this.correctAnswers = 0;
    this.incorrectAnswers = 0;
    return this.startNewRound();
  }

  getLcdLines() {
    if (this.status === Status.SELECTING_OPERATION) {
      return this.normaliseLcdLines(`Modo: ${LEVEL_NAMES[this.difficulty]}`, "Sorteando ...");
    }

    if (this.status === Status.SHOWING_CORRECT_ANSWER) {
      return this.normaliseLcdLines(
        "Resposta Certa",
        `Certo:${this.correctAnswers} Erro:${this.incorrectAnswers}`,
      );
    }

    if (this.status === Status.SHOWING_INCORRECT_ANSWER) {
      return this.normaliseLcdLines(
        "Resposta Errada",
        `Certo:${this.correctAnswers} Erro:${this.incorrectAnswers}`,
      );
    }

    return this.normaliseLcdLines(
      `${LEVEL_NAMES[this.difficulty]} ${OPERATION_NAMES[this.currentOperation]}`,
      `Certo:${this.correctAnswers} Erro:${this.incorrectAnswers}`,
    );
  }

  normaliseLcdLines(firstLine, secondLine) {
    return [firstLine, secondLine].map((line) => line.slice(0, 16).padEnd(16, " "));
  }

  drawOperationForLevel() {
    const weight = this.randomInt(0, 100);
    const thresholds = OPERATION_WEIGHTS[this.difficulty];

    if (weight < thresholds[0]) return Operation.ADD;
    if (weight < thresholds[1]) return Operation.SUBTRACT;
    if (weight < thresholds[2]) return Operation.MULTIPLY;
    return Operation.DIVIDE;
  }

  generateRound() {
    let generated = null;

    while (!generated) {
      const [firstDraw, secondDraw] = this.drawOperands();
      let operand1 = firstDraw;
      let operand2 = secondDraw;
      let decimalRound = this.shouldUseDecimalRound();

      if (decimalRound) {
        if ([Operation.ADD, Operation.SUBTRACT].includes(this.currentOperation)) {
          operand1 = this.buildDecimalOperandFromInt(firstDraw);
          operand2 = this.buildDecimalOperandFromInt(secondDraw);
        } else if (this.currentOperation === Operation.MULTIPLY) {
          if (this.randomInt(0, 2) === 0) {
            operand1 = this.buildDecimalOperandFromInt(firstDraw);
          } else {
            operand2 = this.buildDecimalOperandFromInt(secondDraw);
          }
        } else if (this.currentOperation === Operation.DIVIDE) {
          const scale = this.randomInt(0, 2) === 0 ? 10 : 100;
          let foundDecimalDivision = false;

          for (let divisionAttempt = 0; divisionAttempt < 12; divisionAttempt += 1) {
            const scaledDividend = firstDraw * scale + this.randomInt(1, scale);
            const requiredPlaces = this.getRequiredDecimalPlacesForExactDivision(
              scaledDividend,
              secondDraw * scale,
            );

            if (requiredPlaces > 0 && requiredPlaces <= 3) {
              operand1 = scaledDividend / scale;
              foundDecimalDivision = true;
              break;
            }
          }

          if (!foundDecimalDivision) {
            decimalRound = false;
          }
        }
      }

      const result = this.performOperation(operand1, operand2, this.currentOperation);
      if (result >= 0 && result < 10000) {
        generated = { operand1, operand2, result, decimalRound };
      }
    }

    const decimalPlaces = this.getResultDecimalPlaces(generated);
    const answers = this.buildAnswerOptions(generated.result, decimalPlaces);

    return {
      operand1: generated.operand1,
      operand2: generated.operand2,
      result: generated.result,
      operation: this.currentOperation,
      decimalPlaces,
      options: answers.options,
      correctIndex: answers.correctIndex,
    };
  }

  drawOperands() {
    const numberLimit = NUMBER_LIMITS[this.difficulty];

    if (this.currentOperation === Operation.ADD) {
      return [this.randomInt(1, numberLimit + 1), this.randomInt(1, numberLimit + 1)];
    }

    if (this.currentOperation === Operation.SUBTRACT) {
      const first = this.randomInt(1, numberLimit + 1);
      return [first, this.randomInt(1, first + 1)];
    }

    if (this.currentOperation === Operation.MULTIPLY) {
      const limit = MULTIPLICATION_LIMITS[this.difficulty];
      return [this.randomInt(1, limit + 1), this.randomInt(1, limit + 1)];
    }

    const divisor = this.randomInt(2, DIVISOR_LIMITS[this.difficulty] + 1);
    const maximumQuotient = Math.max(1, Math.floor(DIVIDEND_LIMITS[this.difficulty] / divisor));
    const quotient = this.randomInt(1, maximumQuotient + 1);
    return [divisor * quotient, divisor];
  }

  shouldUseDecimalRound() {
    return this.randomInt(0, 100) < DECIMAL_CHANCES[this.difficulty];
  }

  buildDecimalOperandFromInt(baseValue) {
    const decimalPlaces = this.randomInt(1, 3);
    const scale = decimalPlaces === 1 ? 10 : 100;
    return baseValue + this.randomInt(1, scale) / scale;
  }

  performOperation(first, second, operation) {
    const arduinoFirst = toArduinoFloat(first);
    const arduinoSecond = toArduinoFloat(second);

    if (operation === Operation.ADD) return toArduinoFloat(arduinoFirst + arduinoSecond);
    if (operation === Operation.SUBTRACT) return toArduinoFloat(arduinoFirst - arduinoSecond);
    if (operation === Operation.MULTIPLY) return toArduinoFloat(arduinoFirst * arduinoSecond);
    if (operation === Operation.DIVIDE) {
      return arduinoSecond === 0 ? 0 : toArduinoFloat(arduinoFirst / arduinoSecond);
    }
    return 0;
  }

  getResultDecimalPlaces({ operand1, operand2, result, decimalRound }) {
    if (decimalRound) {
      const minimumPlaces = this.getMinimumDisplayDecimalPlaces(result);
      const maximumPlaces = this.getMaxDisplayDecimalPlaces(result);
      if (minimumPlaces > 0 && maximumPlaces >= minimumPlaces) {
        return this.randomInt(minimumPlaces, maximumPlaces + 1);
      }
      return 0;
    }

    if (this.currentOperation === Operation.DIVIDE) {
      const requiredPlaces = this.getRequiredDecimalPlacesForExactDivision(
        Math.round(operand1),
        Math.round(operand2),
      );
      const maximumPlaces = this.getMaxDisplayDecimalPlaces(result);
      if (requiredPlaces > 0 && maximumPlaces >= requiredPlaces) {
        return this.randomInt(requiredPlaces, maximumPlaces + 1);
      }
    }

    return 0;
  }

  buildAnswerOptions(correctAnswer, decimalPlaces) {
    const correctIndex = this.randomInt(0, 3);
    let lowerAnswer = this.drawNearbyWrongAnswer(correctAnswer, decimalPlaces, -1);
    let upperAnswer = this.drawNearbyWrongAnswer(correctAnswer, decimalPlaces, 1);

    for (
      let attempt = 0;
      attempt < 10 &&
      (lowerAnswer === correctAnswer ||
        upperAnswer === correctAnswer ||
        lowerAnswer === upperAnswer);
      attempt += 1
    ) {
      lowerAnswer = this.drawNearbyWrongAnswer(correctAnswer, decimalPlaces, 0);
      upperAnswer = this.drawNearbyWrongAnswer(correctAnswer, decimalPlaces, 0);
    }

    const options = [lowerAnswer, upperAnswer];
    options.splice(correctIndex, 0, correctAnswer);
    return { options, correctIndex };
  }

  drawNearbyWrongAnswer(correctAnswer, decimalPlaces, preferredDirection) {
    const scale = 10 ** decimalPlaces;
    const arduinoCorrectAnswer = toArduinoFloat(correctAnswer);
    const step = toArduinoFloat(1 / scale);
    const maximumValue = toArduinoFloat(9999 / scale);
    let minimumDistance = decimalPlaces === 0 ? 1 : toArduinoFloat(step * 2);

    if (this.difficulty === Difficulty.EASY) {
      minimumDistance = decimalPlaces === 0 ? 2 : toArduinoFloat(step * 3);
    }

    let distanceCap = toArduinoFloat(40);
    if (this.difficulty === Difficulty.EASY) distanceCap = 120;
    else if (this.difficulty === Difficulty.MEDIUM) distanceCap = 70;
    if (decimalPlaces > 0) {
      distanceCap = toArduinoFloat(distanceCap * toArduinoFloat(0.6));
    }

    const adaptiveDistance = toArduinoFloat(
      toArduinoFloat(Math.abs(arduinoCorrectAnswer) * toArduinoFloat(0.4)) +
        (this.difficulty === Difficulty.EASY ? 8 : 4),
    );
    const maximumDistance = Math.min(
      distanceCap,
      Math.max(toArduinoFloat(minimumDistance * 2), adaptiveDistance),
    );

    const minimumSteps = Math.max(
      1,
      Math.ceil(toArduinoFloat(minimumDistance * scale)),
    );
    const maximumSteps = Math.max(
      minimumSteps + 1,
      Math.floor(toArduinoFloat(maximumDistance * scale)),
    );
    const offsetSteps = this.randomInt(minimumSteps, maximumSteps + 1);
    const direction = preferredDirection || (this.randomInt(0, 2) === 0 ? -1 : 1);

    const directedOffset = toArduinoFloat(direction * offsetSteps * step);
    let candidate = toArduinoFloat(arduinoCorrectAnswer + directedOffset);
    if (candidate < 0 || candidate > maximumValue) {
      candidate = toArduinoFloat(arduinoCorrectAnswer - directedOffset);
    }

    candidate = clamp(
      roundArduinoFloatToDecimalPlaces(candidate, decimalPlaces),
      0,
      maximumValue,
    );
    if (candidate === arduinoCorrectAnswer) {
      const fallbackOffset = toArduinoFloat(
        (direction > 0 ? -1 : 1) * minimumSteps * step,
      );
      candidate = roundArduinoFloatToDecimalPlaces(
        toArduinoFloat(arduinoCorrectAnswer + fallbackOffset),
        decimalPlaces,
      );
      if (candidate < 0) {
        candidate = roundArduinoFloatToDecimalPlaces(
          toArduinoFloat(arduinoCorrectAnswer + toArduinoFloat(minimumSteps * step)),
          decimalPlaces,
        );
      }
    }

    return candidate;
  }

  getRequiredDecimalPlacesForExactDivision(dividend, divisor) {
    if (divisor === 0) return -1;

    const greatestCommonDivisor = this.getGreatestCommonDivisor(dividend, divisor);
    let reducedDivisor = Math.abs(divisor) / greatestCommonDivisor;
    let powerOfTwo = 0;
    let powerOfFive = 0;

    while (reducedDivisor % 2 === 0) {
      reducedDivisor /= 2;
      powerOfTwo += 1;
    }

    while (reducedDivisor % 5 === 0) {
      reducedDivisor /= 5;
      powerOfFive += 1;
    }

    if (reducedDivisor !== 1) return -1;
    return Math.max(powerOfTwo, powerOfFive);
  }

  getGreatestCommonDivisor(first, second) {
    let left = Math.abs(Math.trunc(first));
    let right = Math.abs(Math.trunc(second));

    while (right !== 0) {
      const remainder = left % right;
      left = right;
      right = remainder;
    }

    return left || 1;
  }

  getMaxDisplayDecimalPlaces(value) {
    const integerDigits = Math.max(1, Math.abs(Math.trunc(value)).toString().length);
    return Math.max(0, 4 - integerDigits);
  }

  getMinimumDisplayDecimalPlaces(value) {
    for (let decimalPlaces = 0; decimalPlaces <= 3; decimalPlaces += 1) {
      if (nearlyEqual(value, this.roundToDecimalPlaces(value, decimalPlaces))) {
        return decimalPlaces;
      }
    }
    return 3;
  }

  roundToDecimalPlaces(value, decimalPlaces) {
    const factor = 10 ** decimalPlaces;
    return Math.round((value + Number.EPSILON) * factor) / factor;
  }

  formatDisplayValue(value, forcedDecimalPlaces = -1) {
    if (!Number.isFinite(value) || value < 0 || value >= 10000) {
      return "";
    }

    let decimalPlaces = forcedDecimalPlaces;
    if (decimalPlaces < 0) {
      decimalPlaces = this.getMinimumDisplayDecimalPlaces(value);
    }

    decimalPlaces = clamp(decimalPlaces, 0, this.getMaxDisplayDecimalPlaces(value));
    let roundedValue = this.roundToDecimalPlaces(value, decimalPlaces);
    if (decimalPlaces > 0 && nearlyEqual(roundedValue, Math.round(roundedValue))) {
      decimalPlaces = 0;
      roundedValue = Math.round(roundedValue);
    }

    if (decimalPlaces === 0) {
      return String(Math.round(roundedValue));
    }

    const formatted = roundedValue.toFixed(decimalPlaces);
    if (roundedValue > 0 && roundedValue < 1 && decimalPlaces < 3) {
      const displayNumber = String(Math.round(roundedValue * 10 ** decimalPlaces));
      return `.${displayNumber.padStart(decimalPlaces, " ")}`;
    }

    return formatted;
  }
}
