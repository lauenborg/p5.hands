/**
 * p5.Hands — Friendly hand tracking for p5.js
 * A wrapper around ml5.js HandPose that makes hand tracking
 * dead simple for beginners.
 *
 * Quick start:
 *   function setup() {
 *     createCanvas(640, 480);
 *     initHands();
 *   }
 *   function draw() {
 *     drawVideo();
 *     drawHands();
 *   }
 *
 * Requires: p5.js and ml5.js (v1+)
 */
(function () {
  "use strict";

  // ============================================================
  //  INTERNAL STATE
  // ============================================================
  var _model = null;
  var _video = null;
  var _hands = [];
  var _smoothedHands = [];
  var _prevHands = [];
  var _ready = false;
  var _running = false;
  var _connections = null;
  var _smoothing = 0.3;
  var _flipped = false;
  var _pInst = null;
  var _videoW = 640;
  var _videoH = 480;

  // ============================================================
  //  KEYPOINT CONSTANTS
  // ============================================================
  var KP = {
    wrist: 0,
    thumb_cmc: 1, thumb_mcp: 2, thumb_ip: 3, thumb_tip: 4,
    index_finger_mcp: 5, index_finger_pip: 6, index_finger_dip: 7, index_finger_tip: 8,
    middle_finger_mcp: 9, middle_finger_pip: 10, middle_finger_dip: 11, middle_finger_tip: 12,
    ring_finger_mcp: 13, ring_finger_pip: 14, ring_finger_dip: 15, ring_finger_tip: 16,
    pinky_finger_mcp: 17, pinky_finger_pip: 18, pinky_finger_dip: 19, pinky_finger_tip: 20
  };

  // Friendly short names → full keypoint names
  var TIP_NAMES = {
    thumb: "thumb_tip", index: "index_finger_tip",
    middle: "middle_finger_tip", ring: "ring_finger_tip", pinky: "pinky_finger_tip"
  };
  var PIP_NAMES = {
    thumb: "thumb_ip", index: "index_finger_pip",
    middle: "middle_finger_pip", ring: "ring_finger_pip", pinky: "pinky_finger_pip"
  };
  var MCP_NAMES = {
    thumb: "thumb_mcp", index: "index_finger_mcp",
    middle: "middle_finger_mcp", ring: "ring_finger_mcp", pinky: "pinky_finger_mcp"
  };

  var FINGER_NAMES = ["thumb", "index", "middle", "ring", "pinky"];

  // Colors per finger for drawing
  var FINGER_COLORS = {
    thumb: [255, 100, 100], index: [255, 180, 50],
    middle: [100, 255, 100], ring: [100, 150, 255], pinky: [200, 100, 255]
  };

  // Which keypoint indices belong to each finger (starting from wrist)
  var FINGER_CONNECTIONS = {
    thumb: [0, 1, 2, 3, 4], index: [0, 5, 6, 7, 8],
    middle: [0, 9, 10, 11, 12], ring: [0, 13, 14, 15, 16], pinky: [0, 17, 18, 19, 20]
  };

  // Palm outline connections
  var PALM_CONNECTIONS = [[5, 9], [9, 13], [13, 17], [0, 5], [0, 17]];

  // ============================================================
  //  INTERNAL HELPERS
  // ============================================================
  // When `which` is undefined/null (caller didn't specify a side), we fall
  // back to the single detected hand regardless of its handedness. This
  // makes life easy for beginners who don't think about left vs. right.
  //
  // When `which` is an explicit "left"/"right" string, we are strict: only
  // return a hand whose handedness actually matches. This prevents the
  // right-hand pinch from accidentally triggering a left-hand gesture.
  function _resolveHand(which) {
    if (which && typeof which === "object" && which.keypoints) return which;
    var source = _smoothing > 0 ? _smoothedHands : _hands;
    if (!source || source.length === 0) return null;

    // Was a specific side explicitly requested?
    var explicit = typeof which === "string" && /^(left|right|l|r)$/i.test(which);

    which = (which || "right").toLowerCase();
    if (which === "any" || which === "first") return source[0];

    var wanted = which.startsWith("l") ? "Left" : "Right";
    var found = source.find(function (h) { return h.handedness === wanted; });

    // Only fall back to the single hand when no explicit side was given
    if (!found && source.length === 1 && !explicit) return source[0];
    return found || null;
  }

  function _getKeypoint(hand, name) {
    if (!hand || !hand.keypoints) return null;
    // Try friendly short name (e.g. "thumb" → "thumb_tip")
    if (TIP_NAMES[name]) name = TIP_NAMES[name];
    var idx = KP[name];
    if (idx !== undefined && hand.keypoints[idx]) return hand.keypoints[idx];
    // Fallback: search by name property
    return hand.keypoints.find(function (kp) { return kp.name === name; }) || null;
  }

  function _dist(p1, p2) {
    if (!p1 || !p2) return Infinity;
    var dx = p1.x - p2.x, dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function _lerp(a, b, t) { return a + (b - a) * t; }

  function _smoothHands(rawHands) {
    if (_smoothing <= 0 || !rawHands) { _smoothedHands = rawHands; return; }
    var t = 1 - _smoothing; // higher smoothing = slower response
    var result = [];
    for (var hi = 0; hi < rawHands.length; hi++) {
      var raw = rawHands[hi];
      var prev = _smoothedHands.find(function (h) { return h.handedness === raw.handedness; });
      if (!prev || !prev.keypoints) {
        result.push(JSON.parse(JSON.stringify(raw)));
        continue;
      }
      var smoothed = JSON.parse(JSON.stringify(raw));
      for (var i = 0; i < smoothed.keypoints.length; i++) {
        if (prev.keypoints[i]) {
          smoothed.keypoints[i].x = _lerp(prev.keypoints[i].x, raw.keypoints[i].x, t);
          smoothed.keypoints[i].y = _lerp(prev.keypoints[i].y, raw.keypoints[i].y, t);
        }
      }
      result.push(smoothed);
    }
    _smoothedHands = result;
  }

  function _handleResults(results) {
    _prevHands = _smoothing > 0
      ? _smoothedHands.map(function (h) { return JSON.parse(JSON.stringify(h)); })
      : _hands.map(function (h) { return JSON.parse(JSON.stringify(h)); });
    _hands = results || [];
    _smoothHands(_hands);
  }

  // ============================================================
  //  INITIALIZATION
  // ============================================================

  /**
   * Load the HandPose model. Use in preload() for faster startup.
   * Then call startHands() in setup().
   *
   *   function preload() { loadHands(); }
   *   function setup() { createCanvas(640,480); startHands(); }
   */
  p5.prototype.loadHands = function (options) {
    _pInst = this;
    options = options || {};
    _smoothing = options.smoothing !== undefined ? options.smoothing : 0.3;
    _videoW = options.width || 640;
    _videoH = options.height || 480;

    var modelOpts = { maxHands: options.maxHands || 2 };
    _flipped = !!options.flipped;
    if (options.flipped !== undefined) modelOpts.flipped = options.flipped;
    if (options.runtime) modelOpts.runtime = options.runtime;
    if (options.modelType) modelOpts.modelType = options.modelType;

    var self = this;
    _model = ml5.handPose(modelOpts, function () {
      _ready = true;
      if (_model.getConnections) _connections = _model.getConnections();
      if (self._decrementPreload) self._decrementPreload();
    });
  };

  p5.prototype.registerPreloadMethod("loadHands", p5.prototype);

  /**
   * Start hand detection. Call in setup() after loadHands() in preload().
   */
  p5.prototype.startHands = function (options) {
    _pInst = this;
    options = options || {};
    var w = options.width || _videoW;
    var h = options.height || _videoH;

    if (!_video) {
      _video = this.createCapture(this.VIDEO);
      _video.size(w, h);
      _video.hide();
    }
    if (_model && !_running) {
      if (_model.getConnections) _connections = _model.getConnections();
      _model.detectStart(_video, _handleResults);
      _running = true;
    }
  };

  /**
   * The simplest way to start — does everything in one call.
   * Use in setup():
   *
   *   function setup() {
   *     createCanvas(640, 480);
   *     initHands();
   *   }
   *
   * Options:
   *   maxHands  — number of hands to detect (default 2)
   *   flipped   — mirror the detection (default false)
   *   smoothing — 0 to 1, higher = smoother but laggier (default 0.3)
   *   width     — video width  (default 640)
   *   height    — video height (default 480)
   */
  p5.prototype.initHands = function (options) {
    _pInst = this;
    options = options || {};
    _smoothing = options.smoothing !== undefined ? options.smoothing : 0.3;
    _videoW = options.width || 640;
    _videoH = options.height || 480;

    var modelOpts = { maxHands: options.maxHands || 2 };
    _flipped = !!options.flipped;
    if (options.flipped !== undefined) modelOpts.flipped = options.flipped;
    if (options.runtime) modelOpts.runtime = options.runtime;
    if (options.modelType) modelOpts.modelType = options.modelType;

    _video = this.createCapture(this.VIDEO);
    _video.size(_videoW, _videoH);
    _video.hide();

    _model = ml5.handPose(modelOpts, function () {
      _ready = true;
      if (_model.getConnections) _connections = _model.getConnections();
      _model.detectStart(_video, _handleResults);
      _running = true;
    });
  };

  /** Stop hand detection. */
  p5.prototype.stopHands = function () {
    if (_model && _running) { _model.detectStop(); _running = false; }
  };

  // ============================================================
  //  DATA ACCESS
  // ============================================================

  /** Get all detected hands (array). */
  p5.prototype.getHands = function () {
    return _smoothing > 0 ? _smoothedHands : _hands;
  };

  /** Get a specific hand. Pass "left", "right", or "any". Default "right". */
  p5.prototype.getHand = function (which) { return _resolveHand(which); };

  /** Is a hand detected? */
  p5.prototype.handDetected = function (which) { return _resolveHand(which) !== null; };

  /** How many hands are currently detected. */
  p5.prototype.handCount = function () {
    return (_smoothing > 0 ? _smoothedHands : _hands).length;
  };

  /** Is the model loaded and running? */
  p5.prototype.handsReady = function () { return _ready && _running; };

  /** Get the webcam video element. */
  p5.prototype.getHandsVideo = function () { return _video; };

  // ============================================================
  //  POINT ACCESS
  // ============================================================

  /**
   * Get any keypoint by name.
   *   getPoint("right", "thumb_tip")
   *   getPoint("thumb")            // defaults to right hand, returns thumb tip
   *   getPoint("left", "wrist")
   */
  p5.prototype.getPoint = function (which, name) {
    if (name === undefined && typeof which === "string" && !/^(left|right|l|r|any|first)$/i.test(which)) {
      name = which; which = undefined;
    }
    return _getKeypoint(_resolveHand(which), name);
  };

  /**
   * Get a fingertip position.
   *   fingerTip("right", "index")
   *   fingerTip("index")   // defaults to right hand
   */
  p5.prototype.fingerTip = function (which, finger) {
    if (finger === undefined && FINGER_NAMES.indexOf(which) !== -1) {
      finger = which; which = undefined;
    }
    var hand = _resolveHand(which);
    var name = TIP_NAMES[finger];
    return name ? _getKeypoint(hand, name) : null;
  };

  /** Get the wrist position. */
  p5.prototype.wristPoint = function (which) {
    return _getKeypoint(_resolveHand(which), "wrist");
  };

  /** Center of the palm (average of wrist + finger MCPs). */
  p5.prototype.palmCenter = function (which) {
    var hand = _resolveHand(which);
    if (!hand || !hand.keypoints) return null;
    var indices = [KP.wrist, KP.index_finger_mcp, KP.middle_finger_mcp, KP.ring_finger_mcp, KP.pinky_finger_mcp];
    var sx = 0, sy = 0, n = 0;
    for (var i = 0; i < indices.length; i++) {
      var kp = hand.keypoints[indices[i]];
      if (kp) { sx += kp.x; sy += kp.y; n++; }
    }
    return n ? { x: sx / n, y: sy / n } : null;
  };

  /** Center of all keypoints (hand centroid). */
  p5.prototype.handCenter = function (which) {
    var hand = _resolveHand(which);
    if (!hand || !hand.keypoints || !hand.keypoints.length) return null;
    var sx = 0, sy = 0;
    for (var i = 0; i < hand.keypoints.length; i++) {
      sx += hand.keypoints[i].x; sy += hand.keypoints[i].y;
    }
    return { x: sx / hand.keypoints.length, y: sy / hand.keypoints.length };
  };

  /**
   * Get all keypoints for a specific finger (array of {x, y, name}).
   *   getFingerPoints("right", "index")
   *   getFingerPoints("index")
   */
  p5.prototype.getFingerPoints = function (which, finger) {
    if (finger === undefined && FINGER_NAMES.indexOf(which) !== -1) {
      finger = which; which = undefined;
    }
    var hand = _resolveHand(which);
    if (!hand || !hand.keypoints) return [];
    var conn = FINGER_CONNECTIONS[finger];
    if (!conn) return [];
    return conn.slice(1).map(function (idx) { return hand.keypoints[idx]; }).filter(Boolean);
  };

  // ============================================================
  //  FINGER STATE DETECTION
  // ============================================================

  /**
   * Is a finger extended (up)?
   * Uses distance-from-wrist comparison — works regardless of hand rotation.
   *   isFingerUp("right", "index")
   *   isFingerUp("index")
   */
  p5.prototype.isFingerUp = function (which, finger) {
    if (finger === undefined && FINGER_NAMES.indexOf(which) !== -1) {
      finger = which; which = undefined;
    }
    var hand = _resolveHand(which);
    if (!hand || !hand.keypoints) return false;
    var wrist = hand.keypoints[KP.wrist];
    var tip = _getKeypoint(hand, TIP_NAMES[finger]);
    var pip = _getKeypoint(hand, PIP_NAMES[finger]);
    if (!tip || !pip || !wrist) return false;
    return _dist(tip, wrist) > _dist(pip, wrist);
  };

  /**
   * Which fingers are up?
   * Returns { thumb: bool, index: bool, middle: bool, ring: bool, pinky: bool }
   */
  p5.prototype.fingersUp = function (which) {
    var result = {};
    for (var i = 0; i < FINGER_NAMES.length; i++) {
      result[FINGER_NAMES[i]] = this.isFingerUp(which, FINGER_NAMES[i]);
    }
    return result;
  };

  /** Count how many fingers are extended (0–5). */
  p5.prototype.countFingers = function (which) {
    var n = 0;
    for (var i = 0; i < FINGER_NAMES.length; i++) {
      if (this.isFingerUp(which, FINGER_NAMES[i])) n++;
    }
    return n;
  };

  // ============================================================
  //  GESTURE DETECTION
  // ============================================================

  /** Is the hand pinching? (thumb + index close together) */
  p5.prototype.isPinching = function (which, threshold) {
    if (typeof which === "number") { threshold = which; which = undefined; }
    threshold = threshold || 40;
    var hand = _resolveHand(which);
    return _dist(_getKeypoint(hand, "thumb_tip"), _getKeypoint(hand, "index_finger_tip")) < threshold;
  };

  /** Pinch amount: 0 = open, 1 = fully pinched. */
  p5.prototype.pinchAmount = function (which, min, max) {
    if (typeof which === "number") { max = min; min = which; which = undefined; }
    min = min || 15; max = max || 100;
    var hand = _resolveHand(which);
    var d = _dist(_getKeypoint(hand, "thumb_tip"), _getKeypoint(hand, "index_finger_tip"));
    if (d === Infinity) return 0;
    return Math.max(0, Math.min(1, (max - d) / (max - min)));
  };

  /** Midpoint between thumb tip and index tip — great for dragging things. */
  p5.prototype.pinchPoint = function (which) {
    var hand = _resolveHand(which);
    var a = _getKeypoint(hand, "thumb_tip"), b = _getKeypoint(hand, "index_finger_tip");
    if (!a || !b) return null;
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  };

  /** Is the hand making a fist? */
  p5.prototype.isGrabbing = function (which, threshold) {
    if (typeof which === "number") { threshold = which; which = undefined; }
    threshold = threshold || 90;
    var hand = _resolveHand(which);
    if (!hand || !hand.keypoints) return false;
    var wrist = hand.keypoints[KP.wrist];
    if (!wrist) return false;
    var total = 0, n = 0;
    for (var i = 0; i < FINGER_NAMES.length; i++) {
      var tip = _getKeypoint(hand, TIP_NAMES[FINGER_NAMES[i]]);
      if (tip) { total += _dist(tip, wrist); n++; }
    }
    return n >= 3 && (total / n) < threshold;
  };

  /** All fingers extended? */
  p5.prototype.isOpenHand = function (which) { return this.countFingers(which) >= 5; };

  /** Only index finger up? */
  p5.prototype.isPointing = function (which) {
    var f = this.fingersUp(which);
    return f.index && !f.middle && !f.ring && !f.pinky;
  };

  /** Index + middle up, rest down? */
  p5.prototype.isPeace = function (which) {
    var f = this.fingersUp(which);
    return f.index && f.middle && !f.ring && !f.pinky;
  };

  /** Only thumb up? */
  p5.prototype.isThumbsUp = function (which) {
    var f = this.fingersUp(which);
    return f.thumb && !f.index && !f.middle && !f.ring && !f.pinky;
  };

  /** Index + pinky up, middle + ring down? */
  p5.prototype.isRockOn = function (which) {
    var f = this.fingersUp(which);
    return f.index && f.pinky && !f.middle && !f.ring;
  };

  /** Thumb + pinky up, rest down (hang loose / shaka). */
  p5.prototype.isShaka = function (which) {
    var f = this.fingersUp(which);
    return f.thumb && f.pinky && !f.index && !f.middle && !f.ring;
  };

  /** Middle + ring + pinky down, thumb + index up (L shape / gun). */
  p5.prototype.isGun = function (which) {
    var f = this.fingersUp(which);
    return f.thumb && f.index && !f.middle && !f.ring && !f.pinky;
  };

  /** Index + middle + ring up, thumb + pinky down (three / OK scout). */
  p5.prototype.isThree = function (which) {
    var f = this.fingersUp(which);
    return f.index && f.middle && f.ring && !f.pinky;
  };

  /** Show a specific number of fingers? Ignores thumb for 1-4, includes for 5. */
  p5.prototype.isShowingNumber = function (which, num) {
    if (typeof which === "number") { num = which; which = undefined; }
    var f = this.fingersUp(which);
    var fingers = [f.index, f.middle, f.ring, f.pinky];
    var count = fingers.filter(Boolean).length;
    if (num === 5) return count === 4 && f.thumb;
    if (num === 0) return count === 0 && !f.thumb;
    return count === num && !f.thumb;
  };

  // ============================================================
  //  MATH & UTILITY
  // ============================================================

  /**
   * Distance between two hand points.
   *   handDist("right", "thumb", "right", "index")
   *   handDist(point1, point2)
   */
  p5.prototype.handDist = function (a, b, c, d) {
    if (a && typeof a === "object" && b && typeof b === "object" && c === undefined) {
      var dd = _dist(a, b); return dd === Infinity ? null : dd;
    }
    var p1 = this.getPoint(a, b), p2 = this.getPoint(c, d);
    var dd2 = _dist(p1, p2);
    return dd2 === Infinity ? null : dd2;
  };

  /** Approximate hand size (wrist → middle fingertip distance). */
  p5.prototype.handSize = function (which) {
    var hand = _resolveHand(which);
    if (!hand || !hand.keypoints) return null;
    var d = _dist(hand.keypoints[KP.wrist], hand.keypoints[KP.middle_finger_tip]);
    return d === Infinity ? null : d;
  };

  /** Hand rotation in radians (wrist → middle MCP direction). */
  p5.prototype.handAngle = function (which) {
    var hand = _resolveHand(which);
    if (!hand || !hand.keypoints) return null;
    var w = hand.keypoints[KP.wrist], m = hand.keypoints[KP.middle_finger_mcp];
    if (!w || !m) return null;
    return Math.atan2(m.y - w.y, m.x - w.x);
  };

  /**
   * Velocity of a keypoint (pixels per frame).
   * Returns { x, y, speed } or null.
   *   pointVelocity("right", "wrist")
   *   pointVelocity("index")   // right hand, index tip
   */
  p5.prototype.pointVelocity = function (which, name) {
    if (name === undefined && typeof which === "string" && !/^(left|right|l|r|any|first)$/i.test(which)) {
      name = which; which = undefined;
    }
    name = name || "wrist";
    var hand = _resolveHand(which);
    var curr = _getKeypoint(hand, name);
    // Use the actual resolved hand's side to find the matching previous-frame hand
    var wanted = hand ? hand.handedness : "Right";
    var prevHand = _prevHands.find(function (h) { return h.handedness === wanted; });
    var prev = prevHand ? _getKeypoint(prevHand, name) : null;
    if (!curr || !prev) return null;
    var vx = curr.x - prev.x, vy = curr.y - prev.y;
    return { x: vx, y: vy, speed: Math.sqrt(vx * vx + vy * vy) };
  };

  /**
   * Detect swipe direction based on wrist velocity.
   * Returns "left", "right", "up", "down", or "none".
   */
  p5.prototype.handSwipe = function (which, minSpeed) {
    if (typeof which === "number") { minSpeed = which; which = undefined; }
    minSpeed = minSpeed || 12;
    var vel = this.pointVelocity(which, "wrist");
    if (!vel || vel.speed < minSpeed) return "none";
    if (Math.abs(vel.x) > Math.abs(vel.y)) return vel.x > 0 ? "right" : "left";
    return vel.y > 0 ? "down" : "up";
  };

  /**
   * Map a point from video coordinates to canvas coordinates.
   * Useful when canvas and video sizes differ.
   */
  p5.prototype.mapHandPoint = function (pt) {
    if (!pt || !_video || !_pInst) return pt;
    return {
      x: (pt.x / _video.width) * _pInst.width,
      y: (pt.y / _video.height) * _pInst.height
    };
  };

  // ============================================================
  //  DRAWING
  // ============================================================

  /** Draw the webcam video on the canvas. Automatically mirrors when flipped: true. */
  p5.prototype.drawVideo = function () {
    if (!_video) return;
    if (_flipped) {
      this.push();
      this.translate(this.width, 0);
      this.scale(-1, 1);
      this.image(_video, 0, 0, this.width, this.height);
      this.pop();
    } else {
      this.image(_video, 0, 0, this.width, this.height);
    }
  };

  /**
   * Draw all detected hands (landmarks + skeleton).
   * Options:
   *   size          — dot diameter (default 8)
   *   color         — [r,g,b] for all dots
   *   strokeColor   — [r,g,b,a] for lines
   *   strokeWeight  — line thickness (default 2)
   *   colorByFinger — different color per finger (default true)
   *   skeleton      — draw connection lines (default true)
   *   landmarks     — draw keypoint dots (default true)
   *   labels        — show keypoint names (default false)
   */
  p5.prototype.drawHands = function (options) {
    var hands = _smoothing > 0 ? _smoothedHands : _hands;
    for (var i = 0; i < hands.length; i++) {
      this.drawOneHand(hands[i], options);
    }
  };

  /** Draw a single hand. Pass a hand object or "left"/"right". */
  p5.prototype.drawOneHand = function (handOrWhich, options) {
    var hand = typeof handOrWhich === "string" ? _resolveHand(handOrWhich) : handOrWhich;
    if (!hand || !hand.keypoints) return;
    options = options || {};

    var size = options.size || 8;
    var showSkeleton = options.skeleton !== false;
    var showLandmarks = options.landmarks !== false;
    var colorByFinger = options.colorByFinger !== false;
    var showLabels = options.labels || false;
    var sw = options.strokeWeight || 2;
    var defaultColor = options.color || [255, 255, 255];
    var strokeColor = options.strokeColor || [255, 255, 255, 150];
    var kps = hand.keypoints;

    this.push();

    // — Skeleton lines —
    if (showSkeleton) {
      this.strokeWeight(sw);
      for (var fi = 0; fi < FINGER_NAMES.length; fi++) {
        var fname = FINGER_NAMES[fi];
        var c = colorByFinger ? FINGER_COLORS[fname] : strokeColor;
        this.stroke(c[0], c[1], c[2], c[3] !== undefined ? c[3] : 150);
        var conn = FINGER_CONNECTIONS[fname];
        for (var ci = 0; ci < conn.length - 1; ci++) {
          var a = kps[conn[ci]], b = kps[conn[ci + 1]];
          if (a && b) this.line(a.x, a.y, b.x, b.y);
        }
      }
      // Palm outline
      this.stroke(strokeColor[0] || 255, strokeColor[1] || 255, strokeColor[2] || 255, 100);
      for (var pi = 0; pi < PALM_CONNECTIONS.length; pi++) {
        var pa = kps[PALM_CONNECTIONS[pi][0]], pb = kps[PALM_CONNECTIONS[pi][1]];
        if (pa && pb) this.line(pa.x, pa.y, pb.x, pb.y);
      }
    }

    // — Landmark dots —
    if (showLandmarks) {
      this.noStroke();
      for (var ki = 0; ki < kps.length; ki++) {
        var kp = kps[ki];
        if (!kp) continue;
        if (colorByFinger) {
          var col = defaultColor;
          for (var fj = 0; fj < FINGER_NAMES.length; fj++) {
            if (ki !== 0 && FINGER_CONNECTIONS[FINGER_NAMES[fj]].indexOf(ki) !== -1) {
              col = FINGER_COLORS[FINGER_NAMES[fj]]; break;
            }
          }
          this.fill(col[0], col[1], col[2]);
        } else {
          this.fill(defaultColor[0], defaultColor[1], defaultColor[2]);
        }
        this.circle(kp.x, kp.y, size);

        if (showLabels) {
          this.fill(255); this.textSize(8); this.textAlign(this.LEFT, this.TOP);
          this.text(kp.name || ki, kp.x + size, kp.y);
        }
      }
    }

    this.pop();
  };

  /** Draw only landmarks (dots). */
  p5.prototype.drawLandmarks = function (which, options) {
    if (typeof which === "object" && which !== null && !which.keypoints) { options = which; which = undefined; }
    var opts = Object.assign({}, options, { skeleton: false });
    if (which) this.drawOneHand(which, opts); else this.drawHands(opts);
  };

  /** Draw only skeleton (lines). */
  p5.prototype.drawSkeleton = function (which, options) {
    if (typeof which === "object" && which !== null && !which.keypoints) { options = which; which = undefined; }
    var opts = Object.assign({}, options, { landmarks: false });
    if (which) this.drawOneHand(which, opts); else this.drawHands(opts);
  };

  /** Highlight a specific finger. */
  p5.prototype.drawFinger = function (which, finger, options) {
    if (finger === undefined && FINGER_NAMES.indexOf(which) !== -1) {
      finger = which; which = undefined;
    }
    var hand = _resolveHand(which);
    if (!hand || !hand.keypoints) return;
    options = options || {};
    var sz = options.size || 10;
    var col = options.color || FINGER_COLORS[finger] || [255, 255, 255];
    var sw = options.strokeWeight || 3;
    var kps = hand.keypoints;
    var conn = FINGER_CONNECTIONS[finger];
    if (!conn) return;

    this.push();
    this.stroke(col[0], col[1], col[2]); this.strokeWeight(sw);
    for (var i = 0; i < conn.length - 1; i++) {
      var a = kps[conn[i]], b = kps[conn[i + 1]];
      if (a && b) this.line(a.x, a.y, b.x, b.y);
    }
    this.noStroke(); this.fill(col[0], col[1], col[2]);
    for (var j = 1; j < conn.length; j++) {
      var kp = kps[conn[j]];
      if (kp) this.circle(kp.x, kp.y, sz);
    }
    this.pop();
  };

  /**
   * Show a helpful status message while model loads or no hands are visible.
   * Great to call in draw() so beginners know what's happening.
   */
  p5.prototype.drawHandsStatus = function () {
    this.push();
    this.textAlign(this.CENTER, this.CENTER);
    if (!_ready) {
      this.fill(255); this.textSize(20);
      this.text("Loading hand tracking...", this.width / 2, this.height / 2);
    } else if ((_smoothing > 0 ? _smoothedHands : _hands).length === 0) {
      this.fill(255, 255, 255, 160); this.textSize(16);
      this.text("Show your hand to the camera", this.width / 2, this.height - 30);
    }
    this.pop();
  };

  // ============================================================
  //  STATIC NAMESPACE — for advanced users
  // ============================================================
  p5.Hands = {
    KEYPOINTS: KP,
    FINGER_NAMES: FINGER_NAMES,
    TIP_NAMES: TIP_NAMES,
    PIP_NAMES: PIP_NAMES,
    MCP_NAMES: MCP_NAMES,
    FINGER_COLORS: FINGER_COLORS,
    FINGER_CONNECTIONS: FINGER_CONNECTIONS,
    PALM_CONNECTIONS: PALM_CONNECTIONS,
    dist: _dist
  };

})();
