// Keyboard and mouse input. One file, one job: turn keys and the pointer
// into the stick, throttle and camera commands the flight model reads.
(function (global) {
  'use strict';

  function createInput() {
    var keys = {};
    var input = {
      pitch: 0,       // -1..1, positive pulls the nose up
      roll: 0,        // -1..1, positive banks right
      throttleUp: false,
      throttleDown: false,
      brake: false,
      mousePitch: 0,
      mouseRoll: 0,
      mouseSteer: false,
    };

    function recompute() {
      var pitch = 0, roll = 0;
      if (keys['KeyW'] || keys['ArrowUp']) pitch += 1;
      if (keys['KeyS'] || keys['ArrowDown']) pitch -= 1;
      if (keys['KeyA'] || keys['ArrowLeft']) roll -= 1;
      if (keys['KeyD'] || keys['ArrowRight']) roll += 1;
      input.pitch = pitch;
      input.roll = roll;
      input.throttleUp = !!(keys['ShiftLeft'] || keys['ShiftRight']);
      input.throttleDown = !!(keys['ControlLeft'] || keys['ControlRight']);
      input.brake = !!keys['Space'];
    }

    function onKeyDown(event) {
      if (event.repeat) return;
      keys[event.code] = true;
      recompute();
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(event.code) !== -1) {
        event.preventDefault();
      }
      if (input.onKey) input.onKey(event.code);
    }

    function onKeyUp(event) {
      keys[event.code] = false;
      recompute();
    }

    function onMouseMove(event) {
      var nx = (event.clientX / window.innerWidth) * 2 - 1;
      var ny = (event.clientY / window.innerHeight) * 2 - 1;
      input.mouseRoll = nx;
      input.mousePitch = -ny;
    }

    function onMouseDown(event) {
      if (event.button === 0) input.mouseSteer = true;
    }

    function onMouseUp(event) {
      if (event.button === 0) input.mouseSteer = false;
    }

    function onBlur() {
      keys = {};
      input.pitch = 0; input.roll = 0;
      input.throttleUp = false; input.throttleDown = false; input.brake = false;
      input.mouseRoll = 0; input.mousePitch = 0; input.mouseSteer = false;
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('blur', onBlur);

    input.reset = onBlur;
    // onKey is assigned by main.js: single-press actions (camera, gear,
    // pause, restart, mute) live there, not in the held-key state.
    input.onKey = null;
    return input;
  }

  global.MeridianInput = { createInput: createInput };
})(typeof window !== 'undefined' ? window : globalThis);
