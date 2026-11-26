// Screenshot scenes: ?shot=cover|cockpit|rings|landing puts the game into
// a fixed, flattering moment — same seed, same light, same pose — so the
// screenshots are real renders of the game's own code, taken in a browser.
(function (global) {
  'use strict';

  var R = global.MeridianRandom;

  // Each preset names the mission, where the Kestrel sits, where she points,
  // which camera, and what the light does. The game runs live from there.
  var SHOTS = {
    cover: {
      mission: 0, camera: 'chase', throttle: 0.72, speed: 58,
      x: 367, y: 130, z: -495, headingDeg: 305, pitch: 0.02, roll: -0.18,
      timeOfDay: 'day',
    },
    cockpit: {
      mission: 0, camera: 'cockpit', throttle: 0.68, speed: 55,
      x: 361, y: 130, z: -502, headingDeg: 309, pitch: 0.0, roll: -0.1,
      timeOfDay: 'day',
    },
    rings: {
      mission: 2, camera: 'chase', throttle: 0.78, speed: 62,
      x: 550, y: 100, z: 520, headingDeg: 270, pitch: -0.04, roll: 0.0,
      timeOfDay: 'dusk',
    },
    landing: {
      mission: 0, camera: 'chase', throttle: 0.32, speed: 36,
      x: -320, y: 55, z: -430, headingDeg: 44, pitch: -0.08, roll: 0.0,
      gearDown: true, ringsDone: 5,
      timeOfDay: 'day',
    },
  };

  function getShotPreset() {
    var params = new URLSearchParams(window.location.search);
    var name = params.get('shot');
    if (!name || !SHOTS[name]) return null;
    return { name: name, preset: SHOTS[name] };
  }

  // Place the flight state exactly as the preset says, then let the sim run.
  function applyShotPreset(game, shot) {
    var p = shot.preset;
    game.selectMission(p.mission, true);
    var st = game.state;
    st.x = p.x; st.y = p.y; st.z = p.z;
    st.heading = R.degToRad(p.headingDeg);
    st.pitch = p.pitch || 0; st.roll = p.roll || 0;
    st.throttle = p.throttle; st.speed = p.speed;
    st.gearDown = !!p.gearDown;
    st.onGround = false; // the preset puts her in the air, not on the strip
    st.groundContact = false;
    game.ringsDone = p.ringsDone || 0;
    game.rings.forEach(function (ring, i) {
      if (i < game.ringsDone) {
        ring.passed = true;
        ring.mesh.children[0].material.color.setHex(0x7ec850);
        ring.mesh.children[1].material.color.setHex(0xd8ffb0);
      }
    });
    game.cameraMode = p.camera;
    game.setTimeOfDay(p.timeOfDay);
    game.startFlight(true);
  }

  global.MeridianShots = { SHOTS: SHOTS, getShotPreset: getShotPreset, applyShotPreset: applyShotPreset };
})(typeof window !== 'undefined' ? window : globalThis);
