// ============================================================
//  Finger Painting — Draw with your index finger!
//  Right hand: point to draw, pinch to change color.
//  Left hand: pinch to clear the canvas.
// ============================================================

let trail = [];
let currentColor;
let wasPinchingRight = false;
let wasPinchingLeft = false;

// Color palette to cycle through
let palette = [];
let colorIndex = 0;

function setup() {
  createCanvas(640, 480);
  initHands({ maxHands: 2, flipped: true });

  palette = [
    color(255, 100, 200), // pink
    color(100, 200, 255), // sky blue
    color(255, 220, 50),  // yellow
    color(100, 255, 150), // mint
    color(255, 130, 50),  // orange
    color(180, 100, 255), // purple
    color(255, 80, 80),   // red
    color(255, 255, 255), // white
  ];
  currentColor = palette[0];
}

function draw() {
  // Don't clear — we want to keep the painting!
  // But redraw video faintly as a guide
  push();
  tint(255, 40);
  drawVideo();
  pop();

  drawHands({ size: 4, colorByFinger: false, color: [255, 255, 255], strokeWeight: 1 });
  drawHandsStatus();

  // --- Right hand: draw + color ---
  if (handDetected("right")) {
    // Pointing = draw mode (only index finger up)
    if (isPointing("right")) {
      let tip = fingerTip("right", "index");
      if (tip) {
        trail.push({ x: tip.x, y: tip.y, c: currentColor });
      }
    } else {
      // Gap in the trail when not pointing
      if (trail.length > 0 && trail[trail.length - 1] !== null) {
        trail.push(null);
      }
    }

    // Pinch right = cycle to next color (triggers once per pinch)
    let pinchR = isPinching("right");
    if (pinchR && !wasPinchingRight) {
      colorIndex = (colorIndex + 1) % palette.length;
      currentColor = palette[colorIndex];
    }
    wasPinchingRight = pinchR;
  }

  // --- Left hand: pinch to clear ---
  if (handDetected("left")) {
    let pinchL = isPinching("left");
    if (pinchL && !wasPinchingLeft) {
      trail = [];
    }
    wasPinchingLeft = pinchL;
  }

  // Draw the trail as line segments (supports per-segment color)
  strokeWeight(4);
  for (let i = 0; i < trail.length - 1; i++) {
    if (trail[i] !== null && trail[i + 1] !== null) {
      stroke(trail[i].c);
      line(trail[i].x, trail[i].y, trail[i + 1].x, trail[i + 1].y);
    }
  }

  // Show palette with highlight on current color
  push();
  let swatchSize = 24;
  let padding = 4;
  let startX = width - (swatchSize + padding) * palette.length - 6;
  for (let i = 0; i < palette.length; i++) {
    let x = startX + i * (swatchSize + padding);
    if (i === colorIndex) {
      stroke(255); strokeWeight(3);
    } else {
      stroke(100); strokeWeight(1);
    }
    fill(palette[i]);
    rect(x, 10, swatchSize, swatchSize, 4);
  }
  pop();

  // Instructions
  push();
  fill(255, 200); noStroke(); textSize(12); textAlign(LEFT, BOTTOM);
  text("Right: point to draw, pinch = color | Left: pinch = clear", 10, height - 8);
  pop();
}
