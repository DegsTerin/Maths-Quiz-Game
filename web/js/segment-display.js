export function parseDisplayCharacters(value) {
  const digits = [];
  for (const character of value) {
    if (character === ".") {
      if (digits.length === 0) {
        digits.push({ character: " ", decimal: true });
      } else {
        digits[digits.length - 1].decimal = true;
      }
      continue;
    }
    digits.push({ character, decimal: false });
  }

  return [...Array(Math.max(0, 4 - digits.length)).fill(null), ...digits]
    .slice(-4)
    .map((digit) => digit ?? { character: " ", decimal: false });
}
