// ============================================================
//  p5.Hands — Demo Sketch
//  Shows off all the major features of the library.
// ============================================================

function setup() {
  createCanvas(640, 480);
  initHands(); // mirrored by default
  textFont("monospace");
}

function draw() {
  // --- Webcam background ---
  drawVideo();

  // --- Status message while loading / no hand visible ---
  drawHandsStatus();

  // --- Draw all detected hands (skeleton + dots) ---
  drawHands();

  // --- Only continue if a hand is visible ---
  if (!handDetected()) return;

  // --- Finger count (big number top-center) ---
  let n = countFingers();
  push();
  fill(255); stroke(0); strokeWeight(3);
  textSize(64); textAlign(CENTER, TOP);
  text(n, width / 2, 10);
  pop();

  // --- Gesture labels ---
  push();
  fill(255); noStroke(); textSize(22); textAlign(LEFT, TOP);
  let y = 20;
  if (isPinching())  { text("Pinching!", 20, y); y += 28; }
  if (isPeace())     { text("Peace!", 20, y); y += 28; }
  if (isPointing())  { text("Pointing!", 20, y); y += 28; }
  if (isThumbsUp())  { text("Thumbs up!", 20, y); y += 28; }
  if (isRockOn())    { text("Rock on!", 20, y); y += 28; }
  if (isShaka())     { text("Shaka!", 20, y); y += 28; }
  if (isGun())       { text("Pew pew!", 20, y); y += 28; }
  if (isGrabbing())  { text("Grabbing!", 20, y); y += 28; }
  if (isOpenHand())  { text("Open hand!", 20, y); y += 28; }
  pop();

  // --- Draw a yellow circle on the index fingertip ---
  let tip = fingerTip("index");
  if (tip) {
    push();
    fill(255, 255, 0, 180); noStroke();
    circle(tip.x, tip.y, 30);
    pop();
  }

  // --- Show pinch point when pinching ---
  if (isPinching()) {
    let pp = pinchPoint();
    if (pp) {
      push();
      fill(0, 255, 200); noStroke();
      circle(pp.x, pp.y, 20);
      pop();
    }
  }

  // --- Hand info (bottom-right) ---
  push();
  fill(255, 255, 255, 180); noStroke();
  textSize(12); textAlign(RIGHT, BOTTOM);
  let sz = handSize();
  let ang = handAngle();
  if (sz) text("size: " + nf(sz, 1, 0), width - 10, height - 30);
  if (ang !== null) text("angle: " + nf(degrees(ang), 1, 0) + "°", width - 10, height - 14);
  pop();
}
