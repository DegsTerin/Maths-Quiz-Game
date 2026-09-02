import assert from "node:assert/strict";
import test from "node:test";

import {
  configurePlaybackAudioSession,
  createWrongAnswerFeedback,
  getAudioContextConstructor,
  scheduleWrongAnswerBuzzer,
  triggerWrongAnswerVibration,
  WRONG_ANSWER_VIBRATION_PATTERN,
} from "../web/js/buzzer.js";

function createAudioParameter() {
  const events = [];
  return {
    events,
    setValueAtTime(value, time) {
      events.push(["set", value, time]);
    },
    exponentialRampToValueAtTime(value, time) {
      events.push(["ramp", value, time]);
    },
  };
}

function createAudioContext(state = "running") {
  const destination = {};
  const oscillator = {
    type: "sine",
    frequency: createAudioParameter(),
    connections: [],
    starts: [],
    stops: [],
    connect(target) {
      this.connections.push(target);
    },
    start(time) {
      this.starts.push(time);
    },
    stop(time) {
      this.stops.push(time);
    },
  };
  const gain = {
    gain: createAudioParameter(),
    connections: [],
    connect(target) {
      this.connections.push(target);
    },
  };

  return {
    state,
    currentTime: 12,
    destination,
    oscillator,
    gain,
    resumeCalls: 0,
    closeCalls: 0,
    createOscillator: () => oscillator,
    createGain: () => gain,
    resume() {
      this.resumeCalls += 1;
      this.state = "running";
      return Promise.resolve();
    },
    close() {
      this.closeCalls += 1;
      this.state = "closed";
      return Promise.resolve();
    },
  };
}

test("the incorrect-answer buzzer schedules two short square-wave pulses", () => {
  const context = createAudioContext();

  scheduleWrongAnswerBuzzer(context);

  assert.equal(context.oscillator.type, "square");
  assert.deepEqual(context.oscillator.frequency.events, [
    ["set", 1100, 12],
    ["set", 820, 12.34],
  ]);
  assert.deepEqual(context.gain.gain.events, [
    ["set", 0.0001, 12],
    ["ramp", 0.08, 12.01],
    ["set", 0.08, 12.2],
    ["ramp", 0.0001, 12.24],
    ["set", 0.0001, 12.34],
    ["ramp", 0.08, 12.35],
    ["set", 0.08, 12.69],
    ["ramp", 0.0001, 12.75],
  ]);
  assert.deepEqual(context.oscillator.connections, [context.gain]);
  assert.deepEqual(context.gain.connections, [context.destination]);
  assert.deepEqual(context.oscillator.starts, [12]);
  assert.deepEqual(context.oscillator.stops, [12.78]);
});

test("audio feedback prefers AudioContext and falls back to webkitAudioContext", () => {
  class StandardAudioContext {}
  class WebKitAudioContext {}

  assert.equal(
    getAudioContextConstructor({
      AudioContext: StandardAudioContext,
      webkitAudioContext: WebKitAudioContext,
    }),
    StandardAudioContext,
  );
  assert.equal(
    getAudioContextConstructor({ webkitAudioContext: WebKitAudioContext }),
    WebKitAudioContext,
  );
  assert.equal(getAudioContextConstructor({}), null);
});

test("blocked Web Audio getters fail closed without interrupting the game", () => {
  const globalObject = {};
  Object.defineProperty(globalObject, "AudioContext", {
    get() {
      throw new Error("blocked");
    },
  });

  assert.equal(getAudioContextConstructor(globalObject), null);
});

test("iPhone audio sessions use playback mode when the browser exposes it", () => {
  const navigatorObject = { audioSession: { type: "ambient" } };

  assert.equal(configurePlaybackAudioSession(navigatorObject), true);
  assert.equal(navigatorObject.audioSession.type, "playback");
  assert.equal(configurePlaybackAudioSession({}), false);
});

test("blocked audio-session getters are treated as unavailable", () => {
  const navigatorObject = {};
  Object.defineProperty(navigatorObject, "audioSession", {
    get() {
      throw new Error("blocked");
    },
  });

  assert.equal(configurePlaybackAudioSession(navigatorObject), false);
});

test("wrong answers request the Arduino-style vibration pattern when supported", () => {
  const patterns = [];
  const navigatorObject = {
    vibrate(pattern) {
      patterns.push(pattern);
      return true;
    },
  };

  assert.equal(triggerWrongAnswerVibration(navigatorObject), true);
  assert.deepEqual(patterns, [[...WRONG_ANSWER_VIBRATION_PATTERN]]);
  assert.equal(triggerWrongAnswerVibration({}), false);
});

test("blocked vibration getters are treated as unavailable", () => {
  const navigatorObject = {};
  Object.defineProperty(navigatorObject, "vibrate", {
    get() {
      throw new Error("blocked");
    },
  });

  assert.equal(triggerWrongAnswerVibration(navigatorObject), false);
});

test("a user gesture unlocks, reuses and releases one running audio context", async () => {
  const instances = [];
  const schedules = [];
  const vibrations = [];
  class FakeAudioContext {
    constructor() {
      Object.assign(this, createAudioContext("running"));
      instances.push(this);
    }
  }
  const feedback = createWrongAnswerFeedback({
    globalObject: { AudioContext: FakeAudioContext },
    navigatorObject: {
      vibrate(pattern) {
        vibrations.push(pattern);
        return true;
      },
    },
    scheduleBuzzer: (context) => schedules.push(context),
  });

  await feedback.unlock();
  assert.equal(schedules.length, 0);
  assert.equal(await feedback.play(), true);
  assert.equal(await feedback.play(), true);
  assert.equal(instances.length, 1);
  assert.deepEqual(schedules, [instances[0], instances[0]]);
  assert.deepEqual(vibrations, [
    [...WRONG_ANSWER_VIBRATION_PATTERN],
    [...WRONG_ANSWER_VIBRATION_PATTERN],
  ]);

  feedback.release();
  assert.equal(instances[0].closeCalls, 1);
});

test("a suspended prefixed context resumes from the gesture before scheduling", async () => {
  const instances = [];
  const schedules = [];
  class WebKitAudioContext {
    constructor() {
      Object.assign(this, createAudioContext("suspended"));
      instances.push(this);
    }
  }
  const feedback = createWrongAnswerFeedback({
    globalObject: { webkitAudioContext: WebKitAudioContext },
    navigatorObject: {},
    scheduleBuzzer: (context) => schedules.push(context),
  });

  const playResult = feedback.play();
  assert.equal(instances[0].resumeCalls, 1);
  assert.equal(await playResult, true);
  assert.deepEqual(schedules, [instances[0]]);
});

test("an interrupted iPhone context is replaced on the next gesture", async () => {
  const instances = [];
  const schedules = [];
  class FakeAudioContext {
    constructor() {
      Object.assign(this, createAudioContext("running"));
      instances.push(this);
    }
  }
  const feedback = createWrongAnswerFeedback({
    globalObject: { AudioContext: FakeAudioContext },
    navigatorObject: {},
    scheduleBuzzer: (context) => schedules.push(context),
  });

  await feedback.unlock();
  instances[0].state = "interrupted";
  assert.equal(await feedback.play(), true);
  assert.equal(instances.length, 2);
  assert.equal(instances[0].closeCalls, 1);
  assert.deepEqual(schedules, [instances[1]]);
});

test("vibration remains available when Web Audio is unavailable", async () => {
  const vibrations = [];
  const feedback = createWrongAnswerFeedback({
    globalObject: {},
    navigatorObject: {
      vibrate(pattern) {
        vibrations.push(pattern);
        return true;
      },
    },
  });

  assert.equal(await feedback.play(), false);
  assert.deepEqual(vibrations, [[...WRONG_ANSWER_VIBRATION_PATTERN]]);
});
