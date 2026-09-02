# Maths Quiz Game

[![Play online](https://img.shields.io/badge/play-online-2ea44f?logo=githubpages&logoColor=white)](https://degsterin.github.io/Maths-Quiz-Game/)
[![Test and deploy](https://github.com/DegsTerin/Maths-Quiz-Game/actions/workflows/deploy-pages.yml/badge.svg?branch=main)](https://github.com/DegsTerin/Maths-Quiz-Game/actions/workflows/deploy-pages.yml)
[![Latest release](https://img.shields.io/github/v/release/DegsTerin/Maths-Quiz-Game)](https://github.com/DegsTerin/Maths-Quiz-Game/releases/latest)
[![Licence: MIT](https://img.shields.io/github/license/DegsTerin/Maths-Quiz-Game)](LICENSE)

An interactive maths quiz available as both a browser game and an Arduino Uno build. The project recreates the physical control panel with four arithmetic operations, three selectable difficulty levels, multiple-choice answers and score tracking.

**[Play the browser edition](https://degsterin.github.io/Maths-Quiz-Game/)**

![Finished Maths Quiz Game enclosure](assets/media/maths-quiz-game-cover.png)

## Overview

| Edition | Implementation | Entry point |
| --- | --- | --- |
| Browser | Dependency-free JavaScript ES modules, CSS and semantic HTML | [Live GitHub Pages game](https://degsterin.github.io/Maths-Quiz-Game/) |
| Arduino | Arduino C++ firmware for the physical control panel | [arduino/](arduino/) |
| Wokwi | Local reference diagram and library configuration | [simulation/](simulation/) |

The browser engine reproduces the PT-BR decimal Arduino variant. The interface itself can be switched independently between British English and Brazilian Portuguese.

## Features

### Browser edition

- Addition, subtraction, multiplication and division
- Easy, medium and hard difficulty levels
- Faithful LED matrix, TM1637-style displays, LCD scoreboard and arcade controls
- Responsive layout for desktop, tablet and mobile screens
- Dark and light colour schemes
- British English and Brazilian Portuguese interfaces
- Persistent theme and language preferences
- Keyboard controls and accessible labels, status announcements and live regions
- Arduino-style two-pulse buzzer after an incorrect answer, with iPhone audio-session recovery and vibration on supported devices
- No runtime dependencies and no build step

### Arduino edition

- Five physical TM1637 displays for operands and answer options
- 8x8 LED matrix operation animation
- 16x2 I2C LCD for difficulty and score feedback
- Three answer buttons, a reset button and potentiometer-based difficulty selection
- Dedicated correct and incorrect feedback LEDs
- Decimal and integer-only firmware variants in both supported interface languages
- Optional active buzzer or driver-equipped vibration module for incorrect-answer feedback

## Play in the browser

The published game opens in dark mode and British English on a first visit. Theme and language controls are available at the top of the page, and valid saved choices continue to take precedence on later visits.

| Control | Action |
| --- | --- |
| Answer buttons or <kbd>1</kbd>, <kbd>2</kbd>, <kbd>3</kbd> | Select an answer |
| Red reset button or <kbd>R</kbd> | Reset the score and start a new round |
| Mode slider, <kbd>M</kbd> or left/right arrow keys | Select the difficulty for the next round |
| Theme controls | Switch between dark and light modes |
| Language controls | Switch between en-GB and pt-BR |

An incorrect answer keeps the same problem available for another attempt, sounds the browser buzzer and requests a short vibration pattern. Safari on iPhone plays the buzzer but does not currently expose the Vibration API, so haptic feedback is available only on compatible browsers and devices. A correct answer advances to a new round after the display feedback animation.

### Run locally

From the repository root, serve the <code>web/</code> directory with any local HTTP server. For example, with Python 3:

~~~bash
python -m http.server 4173 --directory web
~~~

Then open [http://localhost:4173/](http://localhost:4173/). Opening <code>web/index.html</code> directly is not recommended because the game uses JavaScript modules.

### Test

The automated suite uses the Node.js built-in test runner. CI currently runs on Node.js 24:

~~~bash
node --test tests/*.test.mjs
~~~

Every relevant push to <code>main</code> runs the tests before the static site is deployed through the [GitHub Pages workflow](https://github.com/DegsTerin/Maths-Quiz-Game/actions/workflows/deploy-pages.yml).

### Browser architecture

| Path | Responsibility |
| --- | --- |
| <code>web/index.html</code> | Semantic structure and first-paint defaults |
| <code>web/styles.css</code> | Responsive enclosure, hardware components and themes |
| <code>web/js/app.js</code> | UI state, interaction, animation, audio and accessibility |
| <code>web/js/buzzer.js</code> | Incorrect-answer Web Audio signal |
| <code>web/js/game-engine.js</code> | Round generation, scoring and Arduino-compatible game rules |
| <code>web/js/i18n.js</code> | en-GB and pt-BR interface messages |
| <code>web/js/preferences.js</code> | Safe persistent preference handling |
| <code>web/js/segment-display.js</code> | Four-digit display parsing and rendering support |

## Arduino firmware

Choose the sketch that matches the required language and number format:

| Language | Number format | Sketch |
| --- | --- | --- |
| British English | Decimal rounds | [maths-quiz-game-en-gb.ino](arduino/maths-quiz-game-en-gb/maths-quiz-game-en-gb.ino) |
| British English | Integers only | [maths-quiz-game-en-gb-integers.ino](arduino/maths-quiz-game-en-gb-integers/maths-quiz-game-en-gb-integers.ino) |
| Brazilian Portuguese | Decimal rounds | [maths-quiz-game-pt-br.ino](arduino/maths-quiz-game-pt-br/maths-quiz-game-pt-br.ino) |
| Brazilian Portuguese | Integers only | [maths-quiz-game-pt-br-integers.ino](arduino/maths-quiz-game-pt-br-integers/maths-quiz-game-pt-br-integers.ino) |

### Game flow

1. Select the difficulty with the potentiometer.
2. Watch the selected operation animate on the LED matrix.
3. Solve the operands shown on the first two displays.
4. Press the button below the correct answer display.
5. Read the correct or incorrect feedback and updated score on the LCD.
6. Use the reset button whenever the score should be cleared.

Decimal firmware may generate decimal rounds in 10% of easy, 20% of medium and 30% of hard rounds. Integer-only firmware keeps all operands and results as integers, including division.

### Hardware

- 1 Arduino Uno-compatible board
- 1 I2C 16x2 LCD; the firmware scans common addresses and uses <code>0x27</code> as its fallback
- 1 8x8 LED matrix with a <code>LedControl</code>-compatible driver
- 5 four-digit TM1637 displays
- 3 answer buttons and 1 reset button
- 1 potentiometer
- 2 feedback LEDs
- 1 protoboard or protoshield module for wiring integration

Answer and reset inputs use <code>INPUT_PULLUP</code>: each button is connected between its input and <code>GND</code>, the pressed state is <code>LOW</code>, and external pull-down resistors are not required.

### Pin mapping

| Component | Arduino pin |
| --- | --- |
| LED matrix <code>DIN</code> | <code>7</code> |
| LED matrix <code>CLK</code> | <code>9</code> |
| LED matrix <code>CS</code> | <code>8</code> |
| Shared TM1637 <code>DIO</code> | <code>10</code> |
| TM1637 clocks 1–5 | <code>2</code>, <code>3</code>, <code>4</code>, <code>5</code>, <code>6</code> |
| Answer buttons 1–3 | <code>A1</code>, <code>A2</code>, <code>A3</code> |
| Reset button | <code>11</code> |
| Correct feedback LED | <code>12</code> |
| Incorrect feedback LED | <code>13</code> |
| Difficulty potentiometer | <code>A0</code> |

An optional active buzzer or driver-equipped vibration module can use the incorrect-feedback control signal on pin <code>13</code> when connected with the appropriate module input and <code>GND</code>.

### Required libraries

- [TM1637Display](arduino/libraries/TM1637/)
- [LiquidCrystal_I2C](arduino/libraries/LiquidCrystal_I2C/)
- [LedControl](arduino/libraries/LedControl/)

The compatible library sources used by this project are included under [arduino/libraries/](arduino/libraries/).

## Wokwi simulation

The repository contains local Wokwi assets rather than a hosted public simulation:

- [simulation/diagram.json](simulation/diagram.json) — hardware layout
- [simulation/libraries.txt](simulation/libraries.txt) — required libraries
- [simulation/wokwi-project.txt](simulation/wokwi-project.txt) — template and source note

The saved diagram reflects an earlier pull-down/5 V button circuit, while the current firmware uses <code>INPUT_PULLUP</code>. Before using it with the current sketches, connect each answer and reset button between its input and <code>GND</code> and remove the external pull-down resistors. Then create an [Arduino Uno template](https://wokwi.com/projects/new/arduino-uno), copy one firmware sketch into <code>sketch.ino</code>, and use the adjusted diagram together with <code>simulation/libraries.txt</code>.

![Wokwi simulation layout](simulation/wokwi.png)

## Repository structure

~~~text
.
├── .github/workflows/    # Test and GitHub Pages deployment
├── arduino/              # Firmware variants and bundled libraries
├── assets/media/         # Build photographs and demonstrations
├── design/vector/        # Editable enclosure artwork
├── docs/                 # Tutorial and release documentation
├── hardware/electronics/ # Electronics and construction files
├── simulation/           # Local Wokwi project assets
├── tests/                # Browser-engine and UI regression tests
├── tutorial/             # Preserved original v0 project
└── web/                  # Published browser edition
~~~

## Gallery

<details>
<summary>Prototype, acrylic enclosure and wiring photographs</summary>

### Prototype during assembly

![Front view of the prototype during assembly](assets/media/assembly-front.jpg)

![Top view of the prototype during assembly](assets/media/assembly-top.jpg)

### Acrylic enclosure

![Acrylic enclosure front view](assets/media/acrylic-front.png)

![Rear wiring overview with protoshield](assets/media/acrylic-rear-wiring.png)

![Protoshield close view](assets/media/protoshield-close.png)

![Arduino and protoshield module](assets/media/arduino-protoshield.png)

</details>

### Demonstration

![Animated demonstration of Maths Quiz Game](assets/media/demonstration.gif)

[Open the full demonstration video](assets/media/demonstration.mp4)

## Project history

The [tutorial/](tutorial/) directory preserves the original project as version zero (<code>v0</code>), organised into Arduino, electronics, vector and document subdirectories. The current repository builds on that material with maintained firmware variants, documented Wokwi reference assets, automated browser tests and a deployed web edition.

## Releases

Versioned hardware, documentation and project milestones are available on the [releases page](https://github.com/DegsTerin/Maths-Quiz-Game/releases/latest).

## Licence

This project is available under the [MIT Licence](LICENSE).

## Support

If this project is useful to you, you can support its continued development through [GitHub Sponsors](https://github.com/sponsors/DegsTerin).
