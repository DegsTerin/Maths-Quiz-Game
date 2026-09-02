export const WRONG_ANSWER_VIBRATION_PATTERN = Object.freeze([90, 60, 160]);

export function getAudioContextConstructor(globalObject = globalThis) {
  try {
    return globalObject?.AudioContext ?? globalObject?.webkitAudioContext ?? null;
  } catch {
    return null;
  }
}

export function configurePlaybackAudioSession(navigatorObject = globalThis.navigator) {
  try {
    const audioSession = navigatorObject?.audioSession;
    if (!audioSession) return false;

    audioSession.type = "playback";
    return audioSession.type === "playback";
  } catch {
    return false;
  }
}

export function triggerWrongAnswerVibration(navigatorObject = globalThis.navigator) {
  try {
    const vibrate = navigatorObject?.vibrate;
    if (typeof vibrate !== "function") return false;

    return vibrate.call(navigatorObject, [...WRONG_ANSWER_VIBRATION_PATTERN]);
  } catch {
    return false;
  }
}

export function scheduleWrongAnswerBuzzer(audioContext) {
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const now = audioContext.currentTime;

  oscillator.type = "square";
  oscillator.frequency.setValueAtTime(1100, now);
  oscillator.frequency.setValueAtTime(820, now + 0.34);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
  gain.gain.setValueAtTime(0.08, now + 0.2);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
  gain.gain.setValueAtTime(0.0001, now + 0.34);
  gain.gain.exponentialRampToValueAtTime(0.08, now + 0.35);
  gain.gain.setValueAtTime(0.08, now + 0.69);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.75);

  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.78);
}

function closeContextQuietly(audioContext) {
  if (!audioContext || audioContext.state === "closed" || typeof audioContext.close !== "function") return;

  try {
    const closeResult = audioContext.close();
    if (typeof closeResult?.catch === "function") void closeResult.catch(() => {});
  } catch {
    // A failed close must not block a fresh context on the next user gesture.
  }
}

export function createWrongAnswerFeedback({
  globalObject = globalThis,
  navigatorObject = globalThis.navigator,
  scheduleBuzzer = scheduleWrongAnswerBuzzer,
} = {}) {
  let audioContext = null;
  let resumeContext = null;
  let resumePromise = null;

  function discardContext(context) {
    if (audioContext === context) audioContext = null;
    if (resumeContext === context) {
      resumeContext = null;
      resumePromise = null;
    }
    closeContextQuietly(context);
  }

  function getOrCreateContext() {
    if (["closed", "interrupted"].includes(audioContext?.state)) discardContext(audioContext);
    if (audioContext) return audioContext;

    const AudioContextConstructor = getAudioContextConstructor(globalObject);
    if (!AudioContextConstructor) return null;

    configurePlaybackAudioSession(navigatorObject);
    try {
      audioContext = new AudioContextConstructor();
      return audioContext;
    } catch {
      audioContext = null;
      return null;
    }
  }

  function unlock() {
    const context = getOrCreateContext();
    if (!context) return Promise.resolve(null);
    if (context.state === "running") return Promise.resolve(context);
    if (typeof context.resume !== "function") {
      discardContext(context);
      return Promise.resolve(null);
    }
    if (resumePromise && resumeContext === context) return resumePromise;

    let resumeResult;
    try {
      resumeResult = context.resume();
    } catch {
      discardContext(context);
      return Promise.resolve(null);
    }

    resumeContext = context;
    let pendingResume;
    pendingResume = Promise.resolve(resumeResult)
      .then(() => {
        if (audioContext !== context || context.state !== "running") {
          discardContext(context);
          return null;
        }
        return context;
      })
      .catch(() => {
        discardContext(context);
        return null;
      })
      .finally(() => {
        if (resumePromise === pendingResume) {
          resumeContext = null;
          resumePromise = null;
        }
      });
    resumePromise = pendingResume;
    return pendingResume;
  }

  function schedule(context) {
    try {
      scheduleBuzzer(context);
      return true;
    } catch {
      discardContext(context);
      return false;
    }
  }

  function play() {
    triggerWrongAnswerVibration(navigatorObject);
    const context = getOrCreateContext();
    if (!context) return Promise.resolve(false);
    if (context.state === "running") return Promise.resolve(schedule(context));
    return unlock().then((runningContext) => runningContext ? schedule(runningContext) : false);
  }

  function release() {
    if (audioContext) discardContext(audioContext);
  }

  return { play, release, unlock };
}
