// ============================================================
//  Hand Puppet — Your hand controls a simple character!
//  Move your hand to move the puppet. Pinch to blink.
//  Open/close fingers to open/close the puppet's mouth.
// ============================================================

function setup() {
  createCanvas(640, 480);
  initHands({ smoothing: 0.5 }); // extra smooth for puppet control
}

function draw() {
  background(30, 30, 60);
  drawHandsStatus();

  if (!handDetected()) {
    push();
    fill(255, 200); textSize(18); textAlign(CENTER, CENTER);
    text("Show your hand to spawn the puppet!", width / 2, height / 2);
    pop();
    return;
  }

  let center = palmCenter();
  if (!center) return;

  let sz = handSize() || 100;
  let fingers = countFingers();
  let pinching = isPinching();

  // Puppet body
  push();
  translate(center.x, center.y);

  // Body
  fill(100, 200, 255);
  noStroke();
  ellipse(0, 0, sz * 1.2, sz * 1.4);

  // Eyes
  let eyeSize = sz * 0.2;
  let eyeY = -sz * 0.15;
  fill(255);
  ellipse(-sz * 0.2, eyeY, eyeSize, pinching ? eyeSize * 0.1 : eyeSize);
  ellipse(sz * 0.2, eyeY, eyeSize, pinching ? eyeSize * 0.1 : eyeSize);

  if (!pinching) {
    fill(30);
    ellipse(-sz * 0.2, eyeY, eyeSize * 0.4, eyeSize * 0.4);
    ellipse(sz * 0.2, eyeY, eyeSize * 0.4, eyeSize * 0.4);
  }

  // Mouth — opens wider with more fingers
  let mouthOpen = map(fingers, 0, 5, 2, sz * 0.4);
  fill(200, 80, 80);
  ellipse(0, sz * 0.2, sz * 0.4, mouthOpen);

  pop();

  // Show finger count
  push();
  fill(255); textSize(14); textAlign(LEFT, TOP);
  text("Fingers: " + fingers, 10, 10);
  text("Pinch to blink!", 10, 30);
  pop();
}
