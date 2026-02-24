// ============================================================
//  Fingertip Particles — Each fingertip shoots particles!
//  Different color per finger. Pinch to create an explosion.
// ============================================================

let particles = [];

function setup() {
  createCanvas(640, 480);
  initHands({ smoothing: 0.4, flipped: true });
}

function draw() {
  background(0, 30);

  // Faint video in the background
  push(); tint(255, 30); drawVideo(); pop();

  drawHandsStatus();

  if (handDetected()) {
    let fingers = ["thumb", "index", "middle", "ring", "pinky"];
    let colors = [
      [255, 100, 100], [255, 180, 50], [100, 255, 100],
      [100, 150, 255], [200, 100, 255]
    ];

    for (let i = 0; i < fingers.length; i++) {
      let tip = fingerTip(fingers[i]);
      if (tip && isFingerUp(fingers[i])) {
        // Spawn a particle from each extended fingertip
        particles.push(makeParticle(tip.x, tip.y, colors[i]));
      }
    }

    // Pinch explosion!
    if (isPinching()) {
      let pp = pinchPoint();
      if (pp) {
        for (let i = 0; i < 20; i++) {
          particles.push(makeParticle(pp.x, pp.y, [255, 255, 100], true));
        }
      }
    }
  }

  // Update and draw particles
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.15; // gravity
    p.life -= 2;

    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }

    noStroke();
    fill(p.col[0], p.col[1], p.col[2], p.life);
    circle(p.x, p.y, map(p.life, 0, 100, 1, p.size));
  }

  // Cap particles to keep it smooth
  if (particles.length > 500) particles.splice(0, particles.length - 500);
}

function makeParticle(x, y, col, explode) {
  let speed = explode ? random(2, 6) : random(0.5, 2);
  let angle = random(TWO_PI);
  return {
    x: x, y: y,
    vx: cos(angle) * speed,
    vy: sin(angle) * speed - (explode ? 0 : 1),
    col: col,
    life: random(60, 100),
    size: random(4, 10)
  };
}
