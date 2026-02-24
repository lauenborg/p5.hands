# p5.Hands

**Friendly hand tracking for p5.js** — a wrapper around [ml5.js HandPose](https://docs.ml5js.org/#/reference/handpose) that makes hand tracking dead simple for beginners.

3 lines to get hand tracking working. 35+ helper functions for points, gestures, and drawing.

## Quick Start

```html
<script src="https://cdn.jsdelivr.net/npm/p5@1/lib/p5.min.js"></script>
<script src="https://unpkg.com/ml5@1/dist/ml5.js"></script>
<script src="p5.hands.js"></script>
<script src="sketch.js"></script>
```

```js
function setup() {
  createCanvas(640, 480);
  initHands();
}

function draw() {
  drawVideo();
  drawHands();
  drawHandsStatus();
}
```

That's it. You now have color-coded hand tracking with skeleton lines, landmark dots, and a loading indicator.

## Keypoints

Each hand has 21 keypoints. The library lets you access them by friendly name instead of memorizing index numbers.

```
                    MIDDLE(12)
                      |
            INDEX(8)  |  RING(16)
              |       |    |    PINKY(20)
              |       |    |      |
              7      11   15     19
              |       |    |      |
              6      10   14     18
              |       |    |      |
         4    5       9   13     17
         |        \   |   |    /
         3          \ |  /   /
         |           \| /  /
         2            +--+
         |            |  |
         1            |  |
          \           |  |
            ----  0  ----
                WRIST
```

| Index | Name | Shortcut |
|-------|------|----------|
| 0 | `wrist` | `"wrist"` |
| 1–4 | `thumb_cmc` → `thumb_tip` | `"thumb"` |
| 5–8 | `index_finger_mcp` → `index_finger_tip` | `"index"` |
| 9–12 | `middle_finger_mcp` → `middle_finger_tip` | `"middle"` |
| 13–16 | `ring_finger_mcp` → `ring_finger_tip` | `"ring"` |
| 17–20 | `pinky_finger_mcp` → `pinky_finger_tip` | `"pinky"` |

Using a shortcut name (like `"index"`) returns the **fingertip** by default.

## API Reference

### Setup

#### `initHands(options?)`
The simplest way to start. Call in `setup()`. Handles everything: creates video, loads model, starts detection.

```js
function setup() {
  createCanvas(640, 480);
  initHands();
}
```

Options:

| Option | Default | Description |
|--------|---------|-------------|
| `maxHands` | `2` | Number of hands to detect |
| `flipped` | `false` | Mirror the detection |
| `smoothing` | `0.3` | 0–1, higher = smoother but laggier |
| `width` | `640` | Video width |
| `height` | `480` | Video height |
| `modelType` | `"full"` | `"full"` or `"lite"` (faster but less accurate) |

#### `loadHands(options?)` + `startHands(options?)`
Two-step alternative. Use `loadHands()` in `preload()` for faster startup, then `startHands()` in `setup()`.

```js
function preload() {
  loadHands();
}

function setup() {
  createCanvas(640, 480);
  startHands();
}
```

#### `stopHands()`
Stop hand detection.

#### `handsReady()`
Returns `true` when the model is loaded and detection is running.

---

### Getting Data

#### `handDetected(which?)`
Is a hand visible? Returns `true`/`false`.

```js
if (handDetected()) { /* ... */ }
if (handDetected("left")) { /* ... */ }
```

#### `handCount()`
How many hands are currently detected (0, 1, or 2).

#### `getHands()`
Get the raw array of all detected hand objects.

#### `getHand(which?)`
Get a specific hand object. Pass `"left"`, `"right"`, or `"any"`. Defaults to `"right"`.

> **Beginner-friendly:** If only one hand is detected, it's returned regardless of which side you ask for. No more "why isn't it working" moments.

---

### Point Access

All point functions accept an optional hand argument (`"left"` / `"right"`) that defaults to `"right"`. Each point is an object with `{ x, y, name }`.

#### `fingerTip(finger)` / `fingerTip(which, finger)`
Get a fingertip position.

```js
let tip = fingerTip("index");
if (tip) circle(tip.x, tip.y, 20);

let leftThumb = fingerTip("left", "thumb");
```

#### `getPoint(name)` / `getPoint(which, name)`
Get any keypoint by its full name.

```js
let pip = getPoint("index_finger_pip");
let mcp = getPoint("left", "thumb_mcp");
```

#### `wristPoint(which?)`
Get the wrist position.

#### `palmCenter(which?)`
Center of the palm (average of wrist + finger base joints).

#### `handCenter(which?)`
Center of all 21 keypoints (hand centroid).

#### `getFingerPoints(finger)` / `getFingerPoints(which, finger)`
Get all keypoints for a finger as an array.

```js
let pts = getFingerPoints("index"); // 4 points: mcp, pip, dip, tip
```

---

### Finger Detection

#### `isFingerUp(finger)` / `isFingerUp(which, finger)`
Is a specific finger extended?

```js
if (isFingerUp("index")) { /* index finger is up */ }
```

#### `fingersUp(which?)`
Returns an object showing which fingers are extended.

```js
let f = fingersUp();
// f = { thumb: true, index: true, middle: false, ring: false, pinky: false }
```

#### `countFingers(which?)`
How many fingers are extended (0–5).

```js
let n = countFingers();
text("Fingers: " + n, 10, 30);
```

---

### Gesture Detection

All gesture functions accept an optional `which` parameter (`"left"` / `"right"`, defaults to `"right"`).

#### `isPinching(which?, threshold?)`
Thumb and index fingertip close together. Default threshold: 40 pixels.

```js
if (isPinching()) { /* thumb + index are touching */ }
if (isPinching("left", 30)) { /* tighter threshold */ }
```

#### `pinchAmount(which?, min?, max?)`
Returns 0–1 indicating how pinched the hand is. 0 = open, 1 = fully pinched.

```js
let amt = pinchAmount();
let size = map(amt, 0, 1, 100, 10);
circle(width/2, height/2, size);
```

#### `pinchPoint(which?)`
The midpoint between thumb tip and index tip. Great for placing/dragging things.

```js
if (isPinching()) {
  let p = pinchPoint();
  circle(p.x, p.y, 20);
}
```

#### `isGrabbing(which?, threshold?)`
Is the hand making a fist? Default threshold: 90 pixels.

#### `isOpenHand(which?)`
All five fingers extended.

#### `isPointing(which?)`
Only index finger up (thumb can be up or down).

#### `isPeace(which?)`
Index + middle fingers up, ring + pinky down.

#### `isThumbsUp(which?)`
Only thumb extended.

#### `isRockOn(which?)`
Index + pinky up, middle + ring down.

#### `isShaka(which?)`
Thumb + pinky up, rest down (hang loose).

#### `isGun(which?)`
Thumb + index up, rest down (finger gun).

#### `isThree(which?)`
Index + middle + ring up, pinky down.

#### `isShowingNumber(num)` / `isShowingNumber(which, num)`
Is the hand holding up a specific number of fingers (0–5)?

```js
if (isShowingNumber(3)) { text("Three!", 10, 30); }
```

---

### Math & Utility

#### `handDist(which1, name1, which2, name2)`
Distance in pixels between two keypoints.

```js
let d = handDist("right", "thumb", "right", "index");
```

Also works with raw point objects:
```js
let d = handDist(fingerTip("index"), palmCenter());
```

#### `handSize(which?)`
Approximate hand size (wrist to middle fingertip distance). Useful for estimating distance from camera.

#### `handAngle(which?)`
Hand rotation in radians (direction from wrist to middle finger base).

#### `pointVelocity(name?)` / `pointVelocity(which, name)`
Velocity of a keypoint in pixels/frame. Returns `{ x, y, speed }`.

```js
let vel = pointVelocity("wrist");
if (vel && vel.speed > 10) { text("Moving fast!", 10, 30); }
```

#### `handSwipe(which?, minSpeed?)`
Detect swipe direction. Returns `"left"`, `"right"`, `"up"`, `"down"`, or `"none"`.

```js
let dir = handSwipe();
if (dir === "left") { /* swiped left */ }
```

#### `mapHandPoint(point)`
Map a point from video coordinates to canvas coordinates. Only needed when canvas and video sizes differ.

---

### Drawing

#### `drawVideo()`
Draw the webcam feed on the canvas.

#### `drawHands(options?)`
Draw all detected hands with landmarks and skeleton lines.

```js
drawHands();                              // defaults: colored by finger
drawHands({ colorByFinger: false });      // all white
drawHands({ skeleton: false });           // dots only
drawHands({ landmarks: false });          // lines only
drawHands({ labels: true });              // show keypoint names
drawHands({ size: 12, strokeWeight: 4 }); // bigger dots, thicker lines
```

Options:

| Option | Default | Description |
|--------|---------|-------------|
| `size` | `8` | Landmark dot diameter |
| `color` | `[255,255,255]` | Dot color (when `colorByFinger` is off) |
| `strokeColor` | `[255,255,255,150]` | Line color |
| `strokeWeight` | `2` | Line thickness |
| `colorByFinger` | `true` | Different color per finger |
| `skeleton` | `true` | Draw bone lines |
| `landmarks` | `true` | Draw keypoint dots |
| `labels` | `false` | Show keypoint names |

#### `drawOneHand(which, options?)`
Draw a single hand. Pass `"left"` or `"right"`.

#### `drawLandmarks(which?, options?)`
Draw only keypoint dots (no skeleton lines).

#### `drawSkeleton(which?, options?)`
Draw only skeleton lines (no dots).

#### `drawFinger(finger, options?)` / `drawFinger(which, finger, options?)`
Highlight a specific finger.

```js
drawFinger("index");                                // orange index finger
drawFinger("left", "pinky", { color: [255, 0, 0] }); // red left pinky
```

#### `drawHandsStatus()`
Shows a loading message while the model loads, and a "show your hand" hint when no hand is detected. Great for beginners.

---

### Advanced: `p5.Hands` Namespace

For advanced users, constants are exposed on `p5.Hands`:

```js
p5.Hands.KEYPOINTS       // { wrist: 0, thumb_cmc: 1, ... }
p5.Hands.FINGER_NAMES    // ["thumb", "index", "middle", "ring", "pinky"]
p5.Hands.TIP_NAMES       // { thumb: "thumb_tip", ... }
p5.Hands.FINGER_COLORS   // { thumb: [255,100,100], ... }
p5.Hands.FINGER_CONNECTIONS // { thumb: [0,1,2,3,4], ... }
p5.Hands.dist(p1, p2)    // distance between two {x,y} points
```

---

## Examples

### Basics (10 lines)
```js
function setup() {
  createCanvas(640, 480);
  initHands();
}
function draw() {
  drawVideo();
  drawHands();
  drawHandsStatus();
}
```

### Follow the finger
```js
function setup() {
  createCanvas(640, 480);
  initHands();
}
function draw() {
  drawVideo();
  let tip = fingerTip("index");
  if (tip) {
    fill(255, 0, 0);
    circle(tip.x, tip.y, 40);
  }
}
```

### Pinch to drag
```js
let ballX = 320, ballY = 240;

function setup() {
  createCanvas(640, 480);
  initHands();
}
function draw() {
  drawVideo();
  drawHands();
  if (isPinching()) {
    let p = pinchPoint();
    if (p) { ballX = p.x; ballY = p.y; }
  }
  fill(255, 100, 100);
  circle(ballX, ballY, 50);
}
```

### Finger counter
```js
function setup() {
  createCanvas(640, 480);
  initHands();
}
function draw() {
  drawVideo();
  drawHands();
  if (handDetected()) {
    fill(255);
    textSize(120);
    textAlign(CENTER, CENTER);
    text(countFingers(), width / 2, height / 2);
  }
}
```

See the `examples/` folder for more:
- **`basics.js`** — absolute minimum setup
- **`painting.js`** — finger painting (point to draw, pinch for new color, open hand to clear)
- **`particles.js`** — each fingertip shoots colored particles
- **`puppet.js`** — hand-controlled puppet character
- **`theremin.js`** — air instrument (right hand = pitch, left hand = volume)

## Requirements

- [p5.js](https://p5js.org/) v1.0+
- [ml5.js](https://ml5js.org/) v1.0+
- A webcam
- A modern browser (Chrome, Firefox, Edge, Safari)

## How It Works

p5.Hands wraps the [ml5.js HandPose](https://docs.ml5js.org/#/reference/handpose) model (which itself uses TensorFlow.js under the hood). It handles all the setup boilerplate and provides:

1. **Simple initialization** — one function call instead of managing video capture, model loading, and detection callbacks manually
2. **Smoothing** — built-in lerp between frames to reduce jitter
3. **Friendly point access** — `fingerTip("index")` instead of `hands[0].keypoints[8]`
4. **Gesture detection** — ready-made functions for pinch, grab, peace sign, pointing, etc.
5. **Drawing helpers** — color-coded skeleton + landmarks with one function call
6. **Beginner guardrails** — loading indicators, null-safe returns, single-hand fallback

## License

MIT
