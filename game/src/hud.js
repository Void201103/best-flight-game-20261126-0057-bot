// The HUD and the lit instruments: altitude, speed and heading as text,
// plus an attitude indicator, a compass tape, a fuel gauge and an integrity
// bar drawn on the instrument strip at the bottom of the screen.
(function (global) {
  'use strict';

  var R = global.MeridianRandom;

  var COMPASS_NAMES = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

  function compassName(headingDeg) {
    var idx = Math.round(headingDeg / 22.5) % 16;
    return COMPASS_NAMES[idx];
  }

  function formatTime(seconds) {
    var m = Math.floor(seconds / 60);
    var s = Math.floor(seconds % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function createHud() {
    var els = {
      alt: document.getElementById('alt-value'),
      vs: document.getElementById('vs-value'),
      spd: document.getElementById('spd-value'),
      hdg: document.getElementById('hdg-value'),
      hdgName: document.getElementById('hdg-name'),
      missionName: document.getElementById('mission-name'),
      missionGoal: document.getElementById('mission-goal'),
      ringCount: document.getElementById('ring-count'),
      score: document.getElementById('score-value'),
      time: document.getElementById('time-value'),
      message: document.getElementById('hud-message'),
      sub: document.getElementById('hud-sub'),
      throttleFill: document.getElementById('hud-throttle-fill'),
      damage: document.getElementById('hud-damage'),
    };
    var canvas = document.getElementById('instruments');
    var ctx = canvas.getContext('2d');

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = 190;
    }
    window.addEventListener('resize', resize);
    resize();

    function drawAttitude(cx, cy, radius, pitch, roll) {
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.clip();
      ctx.translate(cx, cy);
      ctx.rotate(-roll);
      var pitchPx = R.clamp(pitch, -0.6, 0.6) * radius * 1.4;
      var grad = ctx.createLinearGradient(0, -radius - pitchPx, 0, radius - pitchPx);
      grad.addColorStop(0, '#2f7fc9');
      grad.addColorStop(0.5, '#7ec3ee');
      grad.addColorStop(0.5, '#8a6a3f');
      grad.addColorStop(1, '#5a3d22');
      ctx.fillStyle = grad;
      ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
      // Horizon line and pitch ladder.
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-radius, -pitchPx); ctx.lineTo(radius, -pitchPx); ctx.stroke();
      ctx.lineWidth = 1.5;
      [-0.3, -0.15, 0.15, 0.3].forEach(function (p) {
        var y = -pitchPx - p * radius * 1.4;
        ctx.beginPath(); ctx.moveTo(-radius * 0.35, y); ctx.lineTo(radius * 0.35, y); ctx.stroke();
      });
      ctx.restore();
      // Fixed aircraft symbol and bezel.
      ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx - 26, cy); ctx.lineTo(cx - 6, cy); ctx.moveTo(cx + 6, cy); ctx.lineTo(cx + 26, cy); ctx.stroke();
      ctx.fillStyle = '#ffd27a';
      ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(234,246,255,0.9)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
    }

    function drawCompassTape(cx, cy, width, headingDeg) {
      ctx.save();
      ctx.beginPath(); ctx.rect(cx - width / 2, cy - 18, width, 36); ctx.clip();
      ctx.fillStyle = 'rgba(6, 20, 34, 0.72)';
      ctx.fillRect(cx - width / 2, cy - 18, width, 36);
      ctx.font = 'bold 15px Verdana, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (var d = -90; d <= 90; d += 5) {
        var deg = Math.round(((headingDeg + d) % 360 + 360) % 360);
        var x = cx + d * 3.4;
        var major = deg % 30 === 0;
        ctx.strokeStyle = major ? '#eaf6ff' : 'rgba(234,246,255,0.45)';
        ctx.lineWidth = major ? 2 : 1;
        ctx.beginPath(); ctx.moveTo(x, cy + 12); ctx.lineTo(x, cy + (major ? 2 : 8)); ctx.stroke();
        if (major) {
          var label = deg % 90 === 0 ? ['N', 'E', 'S', 'W'][Math.round(deg / 90) % 4] : String(deg).padStart(3, '0');
          ctx.fillStyle = '#eaf6ff';
          ctx.fillText(label, x, cy - 8);
        }
      }
      ctx.restore();
      // Centre lubber line.
      ctx.fillStyle = '#ffb347';
      ctx.beginPath(); ctx.moveTo(cx, cy - 20); ctx.lineTo(cx - 6, cy - 30); ctx.lineTo(cx + 6, cy - 30); ctx.closePath(); ctx.fill();
    }

    function drawGauge(cx, cy, width, label, fraction, color, text) {
      ctx.fillStyle = 'rgba(6, 20, 34, 0.72)';
      ctx.beginPath(); ctx.roundRect(cx - width / 2, cy - 16, width, 32, 6); ctx.fill();
      ctx.fillStyle = color;
      var w = Math.max(0, Math.min(1, fraction)) * (width - 8);
      ctx.beginPath(); ctx.roundRect(cx - width / 2 + 4, cy - 11, w, 22, 4); ctx.fill();
      ctx.fillStyle = '#eaf6ff';
      ctx.font = 'bold 13px Verdana, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label + '  ' + text, cx, cy + 1);
    }

    function drawInstruments(state, mission, ringsDone, elapsed) {
      var w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      // A dark panel behind the strip so the instruments read at a glance.
      ctx.fillStyle = 'rgba(4, 16, 30, 0.55)';
      ctx.fillRect(0, h - 190, w, 190);
      ctx.strokeStyle = 'rgba(234,246,255,0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, h - 190); ctx.lineTo(w, h - 190); ctx.stroke();

      drawAttitude(120, h - 95, 62, state.pitch, state.roll);
      ctx.fillStyle = '#eaf6ff'; ctx.font = '11px Verdana, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ATTITUDE', 120, h - 18);

      drawCompassTape(w / 2, h - 150, 460, R.radToDeg(state.heading));
      ctx.fillStyle = '#eaf6ff'; ctx.font = '11px Verdana, sans-serif';
      ctx.fillText('HEADING', w / 2, h - 118);

      drawGauge(w - 260, h - 158, 300, 'FUEL', state.fuel / 100, state.fuel > 25 ? '#7ec850' : '#ff5a4d', Math.round(state.fuel) + '%');
      drawGauge(w - 260, h - 108, 300, 'AIRFRAME', state.integrity / 100, state.integrity > 50 ? '#7ec850' : (state.integrity > 25 ? '#ffb347' : '#ff5a4d'), Math.round(state.integrity) + '%');
      ctx.fillStyle = '#eaf6ff'; ctx.font = '11px Verdana, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('RINGS ' + ringsDone + ' / ' + mission.rings.length, w - 260, h - 58);
      if (state.speed < 26 && !state.onGround) {
        ctx.fillStyle = '#ff5a4d'; ctx.font = 'bold 16px Verdana, sans-serif';
        ctx.fillText('STALL — NOSE DOWN, POWER UP', w / 2, h - 40);
      }
      if (state.fuel <= 0) {
        ctx.fillStyle = '#ff5a4d'; ctx.font = 'bold 16px Verdana, sans-serif';
        ctx.fillText('FUEL EMPTY — GLIDING', w / 2, h - 40);
      }
    }

    function update(state, mission, ringsDone, score, elapsed) {
      var altFt = Math.max(0, Math.round((state.y - 6) * 3.28084));
      var spdKts = Math.round(state.speed * 1.94384);
      var hdgDeg = Math.round(((R.radToDeg(state.heading) % 360) + 360) % 360);
      var vsFpm = Math.round(state.verticalSpeed * 196.85);
      els.alt.textContent = altFt.toLocaleString('en-US');
      els.vs.textContent = (vsFpm >= 0 ? '+' : '') + vsFpm.toLocaleString('en-US');
      els.spd.textContent = spdKts;
      els.hdg.innerHTML = String(hdgDeg).padStart(3, '0') + '&deg;';
      els.hdgName.textContent = compassName(hdgDeg) + ' · ' + hdgDeg + '°';
      els.missionName.textContent = mission.name;
      els.missionGoal.textContent = mission.goal;
      els.ringCount.textContent = ringsDone + ' / ' + mission.rings.length;
      els.score.textContent = score.toLocaleString('en-US');
      els.time.textContent = formatTime(elapsed);
      els.throttleFill.style.height = Math.round(state.throttle * 100) + '%';
      els.damage.textContent = state.integrity < 100 ? 'AIRFRAME ' + Math.round(state.integrity) + '%' : '';
      drawInstruments(state, mission, ringsDone, elapsed);
    }

    function showMessage(text, sub) {
      els.message.textContent = text || '';
      els.sub.textContent = sub || '';
    }

    return { update: update, showMessage: showMessage, els: els };
  }

  global.MeridianHud = { createHud: createHud, compassName: compassName, formatTime: formatTime };
})(typeof window !== 'undefined' ? window : globalThis);
