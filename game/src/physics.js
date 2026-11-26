// Arcade flight physics for the Kestrel: throttle sets the target speed,
// bank turns the heading, pitch trades speed for altitude, and below stall
// speed she sinks. Nothing here needs a physics engine.
(function (global) {
  'use strict';

  var R = global.MeridianRandom;
  var CFG = global.MeridianConfig.CONFIG;

  function createFlightState(mission) {
    return {
      x: 0, y: 150, z: 420,
      heading: R.degToRad(mission.startHeading),
      pitch: 0,
      roll: 0,
      speed: 45,
      throttle: 0.55,
      fuel: mission.fuelStart,
      integrity: 100,
      verticalSpeed: 0,
      gearDown: false,
      onGround: false,
      groundContact: false,
      groundHeight: 0,
      crashed: false,
      crashReason: null,
      landed: false,
    };
  }

  function updateFlight(state, input, dt, terrainHeightAt, wind) {
    if (state.crashed || state.landed) return;

    // Rolling on the strip: she stays on the ground until the pilot pulls
    // up with flying speed.
    if (state.onGround) {
      var rolling = terrainHeightAt(state.x, state.z);
      state.y = rolling + 1.6;
      state.verticalSpeed = 0;
      state.groundContact = true;
      state.groundHeight = rolling;
      if (input.pitch > 0.15 && state.speed > 30) {
        state.onGround = false;
        state.groundContact = false;
      }
    }

    // Throttle: Shift up, Ctrl down, smooth.
    var throttleTarget = state.throttle;
    if (input.throttleUp) throttleTarget += CFG.throttleRate * dt * 1.6;
    if (input.throttleDown) throttleTarget -= CFG.throttleRate * dt * 1.6;
    state.throttle = R.clamp(throttleTarget, 0, 1);

    // Airbrake bleeds speed fast.
    var targetSpeed = state.throttle * CFG.maxSpeed;
    if (input.brake) targetSpeed = Math.min(targetSpeed, CFG.minSpeed + 6);
    var accel = state.speed < targetSpeed ? 7 : 11;
    state.speed += R.clamp(targetSpeed - state.speed, -accel * dt, accel * dt);
    state.speed = Math.max(0, state.speed);

    // Pitch and roll ease toward the stick, with the mouse adding a nudge.
    var pitchTarget = R.clamp(-input.pitch * CFG.maxPitch + input.mousePitch * 0.22, -CFG.maxPitch, CFG.maxPitch);
    var rollTarget = R.clamp(input.roll * CFG.maxBank + input.mouseRoll * 0.4, -CFG.maxBank, CFG.maxBank);
    var ease = 1 - Math.exp(-dt * 4.5);
    state.pitch += (pitchTarget - state.pitch) * ease;
    state.roll += (rollTarget - state.roll) * ease;

    // The heading follows the bank: a banked turn, not a flat yaw.
    var turnRate = -Math.sin(state.roll) * 0.55 * R.clamp(state.speed / CFG.cruiseSpeed, 0.25, 1.3);
    state.heading = R.wrapAngle(state.heading + turnRate * dt);

    // Wind gusts push the nose sideways a little on the gusty missions.
    var gust = 0;
    if (wind > 0) {
      gust = Math.sin(performance.now() * 0.00021 + state.x * 0.002) * wind * 3.2;
    }

    // Lift: pitch converts speed into climb; below stall speed she sinks.
    var climb = Math.sin(state.pitch) * state.speed;
    if (state.speed < CFG.stallSpeed) {
      climb -= (CFG.stallSpeed - state.speed) * 0.85;
    }
    state.verticalSpeed = climb;
    var forward = state.speed * Math.cos(state.pitch);
    state.x += Math.sin(state.heading) * forward * dt + gust * dt * 0.4;
    state.z += Math.cos(state.heading) * forward * dt;
    state.y += climb * dt;

    // Fuel burns with throttle; running dry leaves her gliding.
    if (state.throttle > 0.02 && state.fuel > 0) {
      state.fuel = Math.max(0, state.fuel - CFG.fuelBurn * (0.35 + state.throttle * 0.65) * dt);
      if (state.fuel <= 0) state.throttle = 0;
    }

    // Soft world edge: the islands end, the sea goes on, gently turn back.
    var edge = 2050;
    if (Math.abs(state.x) > edge || Math.abs(state.z) > edge) {
      state.heading = R.wrapAngle(state.heading + Math.PI * dt * 0.25);
    }

    // Ground: the sea is never landable; solid ground reports contact and
    // main.js decides whether it is a runway landing or a crash.
    var ground = terrainHeightAt(state.x, state.z);
    if (ground < CFG.waterLevel && state.y <= CFG.waterLevel + 1.6) {
      state.y = CFG.waterLevel + 1.6;
      state.crashed = true;
      state.crashReason = 'ditching';
    } else if (state.y <= ground + 1.6) {
      state.y = ground + 1.6;
      state.groundContact = true;
      state.groundHeight = ground;
    } else {
      state.groundContact = false;
    }
  }

  // A touchdown counts as a landing only on the strip, gear down, gentle.
  function checkLanding(state, runway) {
    var hdg = R.degToRad(runway.headingDeg);
    var dx = state.x - runway.centerX, dz = state.z - runway.centerZ;
    var along = dx * Math.sin(hdg) + dz * Math.cos(hdg);
    var across = dx * Math.cos(hdg) - dz * Math.sin(hdg);
    if (Math.abs(along) > runway.length / 2 || Math.abs(across) > runway.width / 2 + 6) return null;
    if (state.y > runway.altitude + 4) return null;
    var headingError = Math.abs(R.wrapAngle(state.heading - hdg));
    var sinkFpm = -state.verticalSpeed * 196.85;
    var smooth = sinkFpm < 400 && Math.abs(state.roll) < 0.25 && headingError < 0.5 && state.speed > 20 && state.speed < 70;
    if (!state.gearDown) return { ok: false, reason: 'gear-up', sinkFpm: sinkFpm };
    if (!smooth) return { ok: false, reason: 'hard', sinkFpm: sinkFpm };
    return { ok: true, reason: 'landed', sinkFpm: sinkFpm };
  }

  global.MeridianPhysics = {
    createFlightState: createFlightState,
    updateFlight: updateFlight,
    checkLanding: checkLanding,
  };
})(typeof window !== 'undefined' ? window : globalThis);
