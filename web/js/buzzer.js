export function scheduleWrongAnswerBuzzer(audioContext) {
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const now = audioContext.currentTime;

  oscillator.type = "square";
  oscillator.frequency.setValueAtTime(170, now);
  oscillator.frequency.setValueAtTime(135, now + 0.34);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.055, now + 0.01);
  gain.gain.setValueAtTime(0.055, now + 0.2);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
  gain.gain.setValueAtTime(0.0001, now + 0.34);
  gain.gain.exponentialRampToValueAtTime(0.055, now + 0.35);
  gain.gain.setValueAtTime(0.055, now + 0.69);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.75);

  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.78);
}
