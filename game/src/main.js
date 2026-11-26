// Meridian Ridge: the game itself. Wires the renderer, the Kestrel, the
// islands, the rings, the HUD and the menus into one loop.
(function (global) {
  'use strict';

  var R = global.MeridianRandom;
  var CFG = global.MeridianConfig.CONFIG;
  var MISSIONS = global.MeridianConfig.MISSIONS;
  var RUNWAY = global.MeridianConfig.RUNWAY;
  var Terrain = global.MeridianTerrain;
  var Aircraft = global.MeridianAircraft;
  var Physics = global.MeridianPhysics;
  var Input = global.MeridianInput;
  var Hud = global.MeridianHud;
  var AudioSys = global.MeridianAudio;
  var Shots = global.MeridianShots;

  var canvas = document.getElementById('scene');
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 9000);
  scene.add(camera);

  // ---- world, built once -----------------------------------------------
  Terrain.buildTerrainMesh(scene);
  Terrain.buildSea(scene);
  Terrain.buildTrees(scene);
  Terrain.buildRunway(scene);
  var clouds = Terrain.buildClouds(scene);
  var lights = null;
  var sunSprite = null;

  function setTimeOfDay(dusk) {
    if (lights) { scene.remove(lights.hemi); scene.remove(lights.sun); }
    if (sunSprite) scene.remove(sunSprite);
    lights = Terrain.buildLights(scene, dusk);
    sunSprite = Terrain.buildSunSprite(scene, dusk);
    if (dusk) {
      scene.background = new THREE.Color(0x35325e);
      scene.fog = new THREE.Fog(0x4a3a5e, 300, 3400);
    } else {
      scene.background = new THREE.Color(0x8fc3e8);
      scene.fog = new THREE.Fog(0x9fc3dd, 400, 3800);
    }
  }
  setTimeOfDay(false);

  // ---- the Kestrel ------------------------------------------------------
  var kestrel = Aircraft.buildKestrel();
  scene.add(kestrel.group);
  kestrel.group.rotation.order = 'YXZ';

  // ---- cockpit dashboard, parented to the camera -----------------------
  var dashboard = buildDashboard();
  dashboard.visible = false;
  camera.add(dashboard);

  function buildDashboard() {
    var group = new THREE.Group();
    var panel = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 0.7, 0.2),
      new THREE.MeshLambertMaterial({ color: 0x1c2836 })
    );
    panel.position.set(0, -0.92, -2.1);
    panel.rotation.x = -0.25;
    group.add(panel);
    // Gauge faces, drawn once on a canvas texture: attitude, altimeter,
    // airspeed, compass, fuel — lit, so the cockpit reads at a glance.
    var texCanvas = document.createElement('canvas');
    texCanvas.width = 1024; texCanvas.height = 256;
    var g = texCanvas.getContext('2d');
    var gauges = [
      { x: 128, label: 'ATT', draw: function (cx) { drawAttitudeFace(g, cx, 128); } },
      { x: 384, label: 'ALT', draw: function (cx) { drawDialFace(g, cx, 128, '#7ec3ee'); } },
      { x: 640, label: 'SPD', draw: function (cx) { drawDialFace(g, cx, 128, '#ffb347'); } },
      { x: 896, label: 'HDG', draw: function (cx) { drawCompassFace(g, cx, 128); } },
    ];
    gauges.forEach(function (gauge) {
      g.fillStyle = '#0a1826';
      g.beginPath(); g.arc(gauge.x, 128, 104, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#eaf6ff'; g.lineWidth = 5;
      g.beginPath(); g.arc(gauge.x, 128, 104, 0, Math.PI * 2); g.stroke();
      gauge.draw(gauge.x);
      g.fillStyle = '#eaf6ff'; g.font = 'bold 26px Verdana, sans-serif';
      g.textAlign = 'center';
      g.fillText(gauge.label, gauge.x, 252);
    });
    var tex = new THREE.CanvasTexture(texCanvas);
    var face = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 0.62),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true })
    );
    face.position.set(0, -0.88, -1.98);
    face.rotation.x = -0.25;
    group.add(face);
    // Glare shield above the panel.
    var shield = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 0.2, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x121c28 })
    );
    shield.position.set(0, -0.52, -2.05);
    shield.rotation.x = -0.15;
    group.add(shield);
    // The cowling ahead: the nose of the Kestrel stretching to the horizon.
    var cowl = new THREE.Mesh(
      new THREE.ConeGeometry(0.55, 2.4, 12),
      new THREE.MeshLambertMaterial({ color: 0x1f7a6e })
    );
    cowl.rotation.x = -Math.PI / 2;
    cowl.position.set(0, -0.62, -3.4);
    group.add(cowl);
    var cowlTip = new THREE.Mesh(
      new THREE.ConeGeometry(0.2, 0.5, 10),
      new THREE.MeshLambertMaterial({ color: 0xffb347 })
    );
    cowlTip.rotation.x = -Math.PI / 2;
    cowlTip.position.set(0, -0.62, -4.7);
    group.add(cowlTip);
    return group;
  }

  function drawAttitudeFace(g, cx, cy) {
    g.save();
    g.beginPath(); g.arc(cx, cy, 88, 0, Math.PI * 2); g.clip();
    var grad = g.createLinearGradient(0, cy - 88, 0, cy + 88);
    grad.addColorStop(0, '#2f7fc9'); grad.addColorStop(0.5, '#7ec3ee');
    grad.addColorStop(0.5, '#8a6a3f'); grad.addColorStop(1, '#5a3d22');
    g.fillStyle = grad; g.fillRect(cx - 88, cy - 88, 176, 176);
    g.strokeStyle = '#fff'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(cx - 88, cy); g.lineTo(cx + 88, cy); g.stroke();
    g.restore();
    g.strokeStyle = '#ffd27a'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(cx - 40, cy); g.lineTo(cx + 40, cy); g.stroke();
  }

  function drawDialFace(g, cx, cy, color) {
    g.strokeStyle = color; g.lineWidth = 5;
    for (var i = 0; i < 12; i++) {
      var a = (i / 12) * Math.PI * 2;
      g.beginPath();
      g.moveTo(cx + Math.sin(a) * 76, cy - Math.cos(a) * 76);
      g.lineTo(cx + Math.sin(a) * 88, cy - Math.cos(a) * 88);
      g.stroke();
    }
    g.strokeStyle = '#fff'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + 34, cy - 52); g.stroke();
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(cx, cy, 7, 0, Math.PI * 2); g.fill();
  }

  function drawCompassFace(g, cx, cy) {
    g.fillStyle = '#0a1826';
    g.beginPath(); g.arc(cx, cy, 88, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#eaf6ff'; g.font = 'bold 30px Verdana, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('N', cx, cy - 58); g.fillText('E', cx + 58, cy);
    g.fillText('S', cx, cy + 58); g.fillText('W', cx - 58, cy);
    g.strokeStyle = '#ffb347'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx, cy - 66); g.stroke();
  }

  // ---- game state -------------------------------------------------------
  var hud = Hud.createHud();
  var audio = AudioSys.createAudio();
  var input = Input.createInput();

  var game = {
    state: null,
    missionIndex: 0,
    mission: MISSIONS[0],
    rings: [],
    ringMeshes: [],
    ringsDone: 0,
    score: 0,
    elapsed: 0,
    phase: 'menu', // menu | flying | paused | ended
    cameraMode: 'chase',
    messageTimer: 0,
    timeOfDay: 'day',
  };

  function runwayStartPose() {
    var hdg = R.degToRad(RUNWAY.headingDeg);
    var along = -RUNWAY.length / 2 + 40;
    return {
      x: RUNWAY.centerX + Math.sin(hdg) * along,
      z: RUNWAY.centerZ + Math.cos(hdg) * along,
      y: RUNWAY.altitude,
      heading: hdg,
    };
  }

  function buildRings(mission) {
    game.ringMeshes.forEach(function (m) { scene.remove(m); });
    game.ringMeshes = [];
    game.rings = mission.rings.map(function (wp, i) {
      var prev = i === 0 ? runwayStartPose() : mission.rings[i - 1];
      var next = i === mission.rings.length - 1 ? wp : mission.rings[i + 1];
      var dir = new THREE.Vector3(next.x - prev.x, next.y - prev.y, next.z - prev.z).normalize();
      var mesh = Terrain.buildRingMesh(wp.x, wp.y, wp.z, CFG.ringRadius, i);
      mesh.lookAt(wp.x + dir.x * 100, wp.y + dir.y * 100, wp.z + dir.z * 100);
      scene.add(mesh);
      game.ringMeshes.push(mesh);
      return {
        x: wp.x, y: wp.y, z: wp.z,
        normal: dir,
        passed: false,
        prevDot: null,
        mesh: mesh,
      };
    });
  }

  function selectMission(index, silent) {
    game.missionIndex = index;
    game.mission = MISSIONS[index];
    setTimeOfDay(game.mission.dusk);
    game.timeOfDay = game.mission.dusk ? 'dusk' : 'day';
    buildRings(game.mission);
    resetFlight();
    document.querySelectorAll('.mission-btn').forEach(function (btn) {
      btn.classList.toggle('selected', Number(btn.dataset.mission) === index);
    });
    if (!silent) audio.click();
  }

  function resetFlight() {
    var pose = runwayStartPose();
    game.state = Physics.createFlightState(game.mission);
    game.state.x = pose.x; game.state.z = pose.z;
    game.state.heading = pose.heading;
    game.state.y = RUNWAY.altitude + 1.6;
    game.state.speed = 0;
    game.state.throttle = 0.35;
    game.state.onGround = true;
    game.ringsDone = 0;
    game.score = 0;
    game.elapsed = 0;
    game.rings.forEach(function (ring) {
      ring.passed = false; ring.prevDot = null;
      ring.mesh.children[0].material.color.setHex(0xffb347);
      ring.mesh.children[1].material.color.setHex(0xffe9a8);
    });
    kestrel.gear.visible = false;
    hud.showMessage('', '');
    updatePlaneTransform(0);
  }

  function startFlight(fromShot) {
    audio.resume();
    document.getElementById('menu-panel').classList.add('hidden');
    document.getElementById('end-panel').classList.add('hidden');
    game.phase = 'flying';
    if (!fromShot) {
      hud.showMessage('TAKE OFF — THROTTLE UP WITH SHIFT', 'Thread the rings, then land on the lit strip');
      game.messageTimer = 4;
    }
  }

  function endFlight(title, sub, statsHtml) {
    game.phase = 'ended';
    document.getElementById('end-title').textContent = title;
    document.getElementById('end-sub').textContent = sub;
    document.getElementById('end-stats').innerHTML = statsHtml;
    document.getElementById('end-panel').classList.remove('hidden');
  }

  function fmtStats(extra) {
    return 'Score <b>' + game.score.toLocaleString('en-US') + '</b> &middot; Rings <b>' +
      game.ringsDone + ' / ' + game.mission.rings.length + '</b> &middot; Time <b>' +
      Hud.formatTime(game.elapsed) + '</b><br>' + extra;
  }

  function crash(reason) {
    var st = game.state;
    st.crashed = true;
    audio.crashNoise();
    audio.setEngine(0, 0, false);
    var text = reason === 'ditching' ? 'DITCHED IN THE SEA' : (reason === 'gear-up' ? 'BELLY LANDING — GEAR WAS UP' : 'CRASHED INTO THE TERRAIN');
    endFlight('CRASHED', text + ' · ' + game.mission.name, fmtStats(
      'The Kestrel is a write-off, but the courier walks away. Rings paid <b>' +
      (game.ringsDone * CFG.ringScore) + '</b> points before the end.'
    ));
  }

  function land(result) {
    var st = game.state;
    st.landed = true;
    audio.thud();
    audio.setEngine(0, 0, false);
    var allRings = game.ringsDone === game.mission.rings.length;
    var landingBonus = Math.round(R.clamp(500 - Math.max(0, result.sinkFpm - 100), 100, 500));
    if (!allRings) landingBonus = Math.round(landingBonus / 2);
    var timeBonus = allRings ? Math.max(0, Math.round(600 - game.elapsed * 2)) : 0;
    game.score += landingBonus + timeBonus;
    endFlight(
      allRings ? 'MISSION COMPLETE' : 'LANDED EARLY',
      (allRings ? 'All rings flown · ' : 'Rings missed · ') + game.mission.name + ' · Port Anselm',
      fmtStats('Landing bonus <b>+' + landingBonus + '</b>' + (timeBonus ? ' &middot; Time bonus <b>+' + timeBonus + '</b>' : '') +
        ' &middot; Sink rate <b>' + Math.round(result.sinkFpm) + ' ft/min</b>')
    );
  }

  // ---- per-frame updates -------------------------------------------------
  var cameraPos = new THREE.Vector3(0, 200, 600);
  var tmpVec = new THREE.Vector3();

  function forwardVector(state) {
    return new THREE.Vector3(
      Math.sin(state.heading) * Math.cos(state.pitch),
      Math.sin(state.pitch),
      Math.cos(state.heading) * Math.cos(state.pitch)
    );
  }

  function updatePlaneTransform(dt) {
    var st = game.state;
    kestrel.group.position.set(st.x, st.y, st.z);
    kestrel.group.rotation.set(-st.pitch, st.heading, -st.roll, 'YXZ');
    var spin = (0.4 + st.throttle * 1.6) * (st.onGround ? 0.4 : 1);
    kestrel.propeller.rotation.z += spin * dt * 22;
    kestrel.propellerDisc.material.opacity = 0.05 + st.throttle * 0.08;
    kestrel.gear.visible = st.gearDown;
    var blink = Math.sin(performance.now() * 0.006) > 0;
    kestrel.lightTail.visible = blink;
    kestrel.lightPort.visible = true;
    kestrel.lightStarboard.visible = true;
  }

  function updateCamera(dt) {
    var st = game.state;
    var fwd = forwardVector(st);
    if (game.cameraMode === 'cockpit') {
      kestrel.group.visible = false;
      dashboard.visible = true;
      tmpVec.copy(fwd).multiplyScalar(1.4);
      camera.position.set(st.x + tmpVec.x, st.y + 0.95 + tmpVec.y, st.z + tmpVec.z);
      tmpVec.copy(fwd).multiplyScalar(120);
      camera.lookAt(st.x + tmpVec.x, st.y + 0.95 + tmpVec.y * 0.4, st.z + tmpVec.z);
    } else {
      kestrel.group.visible = true;
      dashboard.visible = false;
      tmpVec.copy(fwd).multiplyScalar(-CFG.cameraChaseDistance);
      var desired = new THREE.Vector3(st.x + tmpVec.x, st.y + CFG.cameraChaseHeight, st.z + tmpVec.z);
      var ground = Terrain.terrainHeight(desired.x, desired.z);
      if (desired.y < ground + 3) desired.y = ground + 3;
      var k = 1 - Math.exp(-dt * 5);
      cameraPos.lerp(desired, k);
      camera.position.copy(cameraPos);
      tmpVec.copy(fwd).multiplyScalar(14);
      camera.lookAt(st.x + tmpVec.x, st.y + 1 + tmpVec.y, st.z + tmpVec.z);
    }
  }

  function updateRings(dt, now) {
    var st = game.state;
    game.rings.forEach(function (ring, i) {
      var pulse = i === game.ringsDone ? 1 + Math.sin(now * 0.004) * 0.06 : 1;
      ring.mesh.scale.setScalar(pulse);
      if (ring.passed) return;
      var dx = st.x - ring.x, dy = st.y - ring.y, dz = st.z - ring.z;
      var dot = dx * ring.normal.x + dy * ring.normal.y + dz * ring.normal.z;
      var lateral = Math.sqrt(Math.max(0, dx * dx + dy * dy + dz * dz - dot * dot));
      if (ring.prevDot !== null && ring.prevDot * dot <= 0 && lateral < CFG.ringRadius * 0.92 && i === game.ringsDone) {
        ring.passed = true;
        game.ringsDone++;
        game.score += CFG.ringScore;
        ring.mesh.children[0].material.color.setHex(0x7ec850);
        ring.mesh.children[1].material.color.setHex(0xd8ffb0);
        audio.ringChime();
        if (game.ringsDone === game.mission.rings.length) {
          hud.showMessage('ALL RINGS FLOWN — LAND AT PORT ANSELM', 'Follow the lit strip home · gear down with G');
          game.messageTimer = 5;
        } else {
          hud.showMessage('RING ' + game.ringsDone + ' / ' + game.mission.rings.length, 'Next ring glows amber ahead');
          game.messageTimer = 2.2;
        }
      }
      ring.prevDot = dot;
    });
  }

  function updateGroundContact() {
    var st = game.state;
    if (!st.groundContact || st.onGround || st.crashed || st.landed) return;
    // Climbing away from the strip after lift-off is not a landing.
    if (st.verticalSpeed > 1) return;
    var result = Physics.checkLanding(st, RUNWAY);
    if (result === null) {
      crash('terrain');
      return;
    }
    if (result.ok) { land(result); return; }
    if (result.reason === 'gear-up') { crash('gear-up'); return; }
    // A hard landing bends the airframe and bounces her back up.
    st.integrity -= CFG.hardLandingDamage;
    st.y = RUNWAY.altitude + 9;
    st.pitch = 0.12;
    st.verticalSpeed = 6;
    hud.showMessage('HARD LANDING — AIRFRAME ' + Math.round(st.integrity) + '%', 'Sink rate ' + Math.round(result.sinkFpm) + ' ft/min · go around and try again');
    game.messageTimer = 3.5;
    audio.thud();
    if (st.integrity <= 0) crash('terrain');
  }

  // ---- main loop ---------------------------------------------------------
  var lastTime = performance.now();

  function loop(now) {
    requestAnimationFrame(loop);
    var dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    clouds.children.forEach(function (cloud) {
      cloud.position.x += cloud.userData.drift * dt;
      if (cloud.position.x > 2100) cloud.position.x = -2100;
    });

    if (game.phase === 'flying') {
      var st = game.state;
      game.elapsed += dt;
      if (game.messageTimer > 0) {
        game.messageTimer -= dt;
        if (game.messageTimer <= 0) hud.showMessage('', '');
      }
      // Mouse steers only while the button is held.
      var effectiveInput = input;
      if (!input.mouseSteer) {
        effectiveInput = Object.create(input);
        effectiveInput.mousePitch = 0;
        effectiveInput.mouseRoll = 0;
      }
      Physics.updateFlight(st, effectiveInput, dt, Terrain.terrainHeight, game.mission.wind);
      updateRings(dt, now);
      updateGroundContact();
      updatePlaneTransform(dt);
      updateCamera(dt);
      hud.update(st, game.mission, game.ringsDone, game.score, game.elapsed);
      audio.setEngine(st.throttle, st.speed, !st.onGround || st.speed > 5);
      if (st.fuel <= 0 && st.throttle === 0) {
        hud.showMessage('FUEL EMPTY — GLIDING', 'Find the strip or the sea');
      }
    } else if (game.phase === 'menu' || game.phase === 'ended') {
      // A slow orbit over the islands behind the menu and end screens.
      var t = now * 0.00004;
      camera.position.set(Math.sin(t) * 900, 320, Math.cos(t) * 900);
      camera.lookAt(0, 40, 0);
      kestrel.group.visible = true;
      dashboard.visible = false;
      updatePlaneTransform(dt);
    }
    renderer.render(scene, camera);
  }

  // ---- menus and keys ----------------------------------------------------
  document.querySelectorAll('.mission-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      selectMission(Number(btn.dataset.mission));
    });
  });
  document.getElementById('btn-fly').addEventListener('click', function () { audio.resume(); startFlight(false); });
  document.getElementById('btn-how').addEventListener('click', function () {
    document.getElementById('how-text').classList.toggle('hidden');
  });
  document.getElementById('btn-again').addEventListener('click', function () {
    selectMission(game.missionIndex, true);
    startFlight(false);
  });
  document.getElementById('btn-menu').addEventListener('click', function () {
    document.getElementById('end-panel').classList.add('hidden');
    document.getElementById('menu-panel').classList.remove('hidden');
    game.phase = 'menu';
    selectMission(game.missionIndex, true);
  });

  input.onKey = function (code) {
    audio.resume();
    if (code === 'KeyC' && game.phase === 'flying') {
      game.cameraMode = game.cameraMode === 'chase' ? 'cockpit' : 'chase';
      hud.showMessage(game.cameraMode === 'cockpit' ? 'COCKPIT VIEW' : 'CHASE VIEW', '');
      game.messageTimer = 1.5;
    }
    if (code === 'KeyG' && game.phase === 'flying') {
      game.state.gearDown = !game.state.gearDown;
      hud.showMessage(game.state.gearDown ? 'GEAR DOWN' : 'GEAR UP', '');
      game.messageTimer = 1.5;
      audio.click();
    }
    if (code === 'KeyP' && (game.phase === 'flying' || game.phase === 'paused')) {
      game.phase = game.phase === 'flying' ? 'paused' : 'flying';
      hud.showMessage(game.phase === 'paused' ? 'PAUSED' : '', game.phase === 'paused' ? 'Press P to resume' : '');
    }
    if (code === 'KeyR' && game.phase !== 'menu') {
      selectMission(game.missionIndex, true);
      if (game.phase === 'ended') startFlight(false);
      hud.showMessage('RESTARTED — ' + game.mission.name.toUpperCase(), '');
      game.messageTimer = 2;
    }
    if (code === 'KeyM') {
      audio.setMuted(!audio.isMuted());
      hud.showMessage(audio.isMuted() ? 'SOUND OFF' : 'SOUND ON', '');
      game.messageTimer = 1.2;
    }
    if (code === 'Enter' && game.phase === 'menu') startFlight(false);
  };

  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ---- boot --------------------------------------------------------------
  game.selectMission = selectMission;
  game.startFlight = startFlight;
  game.setTimeOfDay = function (name) { setTimeOfDay(name === 'dusk'); game.timeOfDay = name; };
  game.snapCamera = function () {
    var st = game.state;
    var fwd = forwardVector(st);
    cameraPos.set(st.x - fwd.x * CFG.cameraChaseDistance, st.y + CFG.cameraChaseHeight, st.z - fwd.z * CFG.cameraChaseDistance);
    camera.position.copy(cameraPos);
  };
  selectMission(0, true);
  game.phase = 'menu';
  var shot = Shots.getShotPreset();
  if (shot) {
    Shots.applyShotPreset(game, shot);
    game.snapCamera();
    // Let the sim settle (camera, HUD, ring pulse) before the shot counts.
    setTimeout(function () { window.__shotReady = true; }, 2500);
  }
  window.__meridian = game;
  window.__scene = scene;
  window.__camera = camera;
  window.__THREE = THREE;
  requestAnimationFrame(loop);
})(typeof window !== 'undefined' ? window : globalThis);
