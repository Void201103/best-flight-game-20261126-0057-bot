// Synthesised sound: engine hum, wind, ring chimes, landing thud and crash.
// Everything is made with WebAudio oscillators and noise — no audio files.
(function (global) {
  'use strict';

  function createAudio() {
    var ctx = null;
    var master = null;
    var engineOsc = null, engineGain = null, windGain = null, windSource = null;
    var muted = false;

    function ensure() {
      if (ctx) return true;
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.5;
        master.connect(ctx.destination);
        // Engine: two detuned sawtooth oscillators through a low-pass.
        engineOsc = ctx.createOscillator();
        engineOsc.type = 'sawtooth';
        engineOsc.frequency.value = 70;
        var engineOsc2 = ctx.createOscillator();
        engineOsc2.type = 'sawtooth';
        engineOsc2.frequency.value = 71.5;
        var filter = ctx.createBiquadFilter();
        filter.type = 'lowpass'; filter.frequency.value = 420;
        engineGain = ctx.createGain();
        engineGain.gain.value = 0.0;
        engineOsc.connect(filter); engineOsc2.connect(filter);
        filter.connect(engineGain); engineGain.connect(master);
        engineOsc.start(); engineOsc2.start();
        // Wind: looped noise through a band-pass.
        var len = ctx.sampleRate * 2;
        var buffer = ctx.createBuffer(1, len, ctx.sampleRate);
        var data = buffer.getChannelData(0);
        for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        windSource = ctx.createBufferSource();
        windSource.buffer = buffer; windSource.loop = true;
        var windFilter = ctx.createBiquadFilter();
        windFilter.type = 'bandpass'; windFilter.frequency.value = 500; windFilter.Q.value = 0.6;
        windGain = ctx.createGain(); windGain.gain.value = 0.0;
        windSource.connect(windFilter); windFilter.connect(windGain); windGain.connect(master);
        windSource.start();
        return true;
      } catch (e) {
        return false;
      }
    }

    function resume() {
      if (ensure() && ctx.state === 'suspended') ctx.resume();
    }

    function setEngine(throttle, speed, flying) {
      if (!ctx || muted) return;
      var t = ctx.currentTime;
      engineGain.gain.setTargetAtTime(flying ? 0.05 + throttle * 0.08 : 0.0, t, 0.1);
      engineOsc.frequency.setTargetAtTime(58 + throttle * 62, t, 0.1);
      windGain.gain.setTargetAtTime(flying ? Math.min(0.12, speed * 0.0011) : 0.0, t, 0.15);
    }

    function blip(freq, dur, type, gain, when) {
      if (!ctx || muted) return;
      var t = ctx.currentTime + (when || 0);
      var osc = ctx.createOscillator();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain || 0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g); g.connect(master);
      osc.start(t); osc.stop(t + dur + 0.05);
    }

    function ringChime() { blip(880, 0.5, 'sine', 0.3); blip(1318, 0.6, 'sine', 0.22, 0.09); }
    function click() { blip(660, 0.08, 'square', 0.08); }
    function thud() { blip(90, 0.35, 'sine', 0.5); blip(55, 0.5, 'triangle', 0.4, 0.02); }

    function crashNoise() {
      if (!ctx || muted) return;
      var t = ctx.currentTime;
      var len = ctx.sampleRate * 0.7;
      var buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      var data = buffer.getChannelData(0);
      for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      var src = ctx.createBufferSource();
      src.buffer = buffer;
      var g = ctx.createGain(); g.gain.value = 0.6;
      src.connect(g); g.connect(master);
      src.start(t);
    }

    function setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    }

    return {
      resume: resume, setEngine: setEngine, ringChime: ringChime,
      click: click, thud: thud, crashNoise: crashNoise,
      setMuted: setMuted, isMuted: function () { return muted; },
    };
  }

  global.MeridianAudio = { createAudio: createAudio };
})(typeof window !== 'undefined' ? window : globalThis);
