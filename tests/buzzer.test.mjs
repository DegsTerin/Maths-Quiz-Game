import assert from "node:assert/strict";
import test from "node:test";

import { scheduleWrongAnswerBuzzer } from "../web/js/buzzer.js";

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

function createAudioContext() {
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
    currentTime: 12,
    destination,
    oscillator,
    gain,
    createOscillator: () => oscillator,
    createGain: () => gain,
  };
}

test("the incorrect-answer buzzer schedules two short square-wave pulses", () => {
  const context = createAudioContext();

  scheduleWrongAnswerBuzzer(context);

  assert.equal(context.oscillator.type, "square");
  assert.deepEqual(context.oscillator.frequency.events, [
    ["set", 170, 12],
    ["set", 135, 12.34],
  ]);
  assert.deepEqual(context.gain.gain.events, [
    ["set", 0.0001, 12],
    ["ramp", 0.055, 12.01],
    ["set", 0.055, 12.2],
    ["ramp", 0.0001, 12.24],
    ["set", 0.0001, 12.34],
    ["ramp", 0.055, 12.35],
    ["set", 0.055, 12.69],
    ["ramp", 0.0001, 12.75],
  ]);
  assert.deepEqual(context.oscillator.connections, [context.gain]);
  assert.deepEqual(context.gain.connections, [context.destination]);
  assert.deepEqual(context.oscillator.starts, [12]);
  assert.deepEqual(context.oscillator.stops, [12.78]);
});
