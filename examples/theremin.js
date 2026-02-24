// ============================================================
//  Air Theremin — Control pitch and volume with your hands!
//  Right hand Y = pitch, Left hand Y = volume.
//  Pinch right hand to play, release to stop.
// ============================================================

let osc, playing = false;
let audioStarted = false;

function setup() {
  createCanvas(640, 480);
  initHands({ maxHands: 2, flipped: true });
}

function draw() {
  background(20, 10, 40);
  push(); tint(255, 60); drawVideo(); pop();
  drawHands();
  drawHandsStatus();

  // Prompt user to click to unlock audio
  if (!audioStarted) {
    push();
    fill(255); textSize(22); textAlign(CENTER, CENTER);
    text("Click anywhere to enable sound", width / 2, height / 4);
    pop();
    return;
  }

  // Right hand = pitch control
  let rightTip = fingerTip("right", "index");
  if (rightTip) {
    let freq = map(rightTip.y, height, 0, 100, 1000);
    osc.freq(freq);

    push();
    noFill(); stroke(0, 255, 200); strokeWeight(1);
    line(0, rightTip.y, width, rightTip.y);
    fill(0, 255, 200); noStroke(); textSize(14);
    text(nf(freq, 1, 0) + " Hz", rightTip.x + 15, rightTip.y - 5);
    pop();
  }

  // Pinch right hand to play
  if (isPinching("right")) {
    if (!playing) { osc.amp(0.3, 0.1); playing = true; }
  } else {
    if (playing) { osc.amp(0, 0.1); playing = false; }
  }

  // Left hand = volume
  let leftTip = fingerTip("left", "index");
  if (leftTip && playing) {
    let vol = map(leftTip.y, height, 0, 0, 0.5);
    osc.amp(vol, 0.05);

    push();
    noFill(); stroke(255, 100, 200); strokeWeight(1);
    line(0, leftTip.y, width, leftTip.y);
    fill(255, 100, 200); noStroke(); textSize(14);
    text("vol: " + nf(vol, 1, 2), leftTip.x + 15, leftTip.y - 5);
    pop();
  }

  // Instructions
  push();
  fill(255, 200); textSize(14); textAlign(CENTER, BOTTOM);
  text("Right hand Y = pitch | Pinch to play | Left hand Y = volume", width / 2, height - 10);
  pop();

  // Playing indicator
  if (playing) {
    push();
    fill(0, 255, 100); noStroke();
    circle(width - 20, 20, 16);
    pop();
  }
}

function mousePressed() {
  if (!audioStarted) {
    userStartAudio();
    osc = new p5.Oscillator("sine");
    osc.amp(0);
    osc.start();
    audioStarted = true;
  }
}
