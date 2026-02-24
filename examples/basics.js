// ============================================================
//  Absolute Basics — The simplest possible p5.Hands sketch.
//  Just 10 lines of code to get hand tracking working!
// ============================================================

function setup() {
  createCanvas(640, 480);
  initHands({ flipped: true });
}

function draw() {
  //drawVideo();
  background(30);
  drawHands();
  //drawHandsStatus();
}
