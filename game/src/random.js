// Seeded random numbers and smooth value noise, so the islands, the ring
// courses and the screenshot scenes are the same on every run.
(function (global) {
  'use strict';

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function nextRandom() {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Deterministic 2D value noise with smooth interpolation.
  function makeNoise2D(seed) {
    const rand = mulberry32(seed);
    const perm = new Uint8Array(512);
    const base = new Uint8Array(256);
    for (let i = 0; i < 256; i++) base[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = base[i]; base[i] = base[j]; base[j] = tmp;
    }
    for (let i = 0; i < 512; i++) perm[i] = base[i & 255];
    function hash(ix, iz) { return perm[(perm[ix & 255] + iz) & 255] / 255; }
    function smooth(t) { return t * t * (3 - 2 * t); }
    function noise(x, z) {
      const ix = Math.floor(x), iz = Math.floor(z);
      const fx = x - ix, fz = z - iz;
      const a = hash(ix, iz), b = hash(ix + 1, iz);
      const c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
      const u = smooth(fx), v = smooth(fz);
      return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
    }
    // Fractal noise: several octaves, returns roughly -1..1.
    function fbm(x, z, octaves) {
      let sum = 0, amp = 0.5, freq = 1, norm = 0;
      for (let o = 0; o < octaves; o++) {
        sum += amp * noise(x * freq, z * freq);
        norm += amp; amp *= 0.5; freq *= 2.03;
      }
      return sum / norm;
    }
    return { noise: noise, fbm: fbm };
  }

  function clamp(value, min, max) { return value < min ? min : (value > max ? max : value); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function degToRad(deg) { return deg * Math.PI / 180; }
  function radToDeg(rad) { return rad * 180 / Math.PI; }
  function wrapAngle(rad) {
    while (rad > Math.PI) rad -= Math.PI * 2;
    while (rad < -Math.PI) rad += Math.PI * 2;
    return rad;
  }

  global.MeridianRandom = {
    mulberry32: mulberry32,
    makeNoise2D: makeNoise2D,
    clamp: clamp,
    lerp: lerp,
    degToRad: degToRad,
    radToDeg: radToDeg,
    wrapAngle: wrapAngle,
  };
})(typeof window !== 'undefined' ? window : globalThis);
