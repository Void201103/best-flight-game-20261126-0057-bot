// The Meridian islands: procedural terrain, sea, runway, rings, clouds and
// sky. The height function is the single source of truth — physics, the
// camera and the crash check all ask it the same question.
(function (global) {
  'use strict';

  var R = global.MeridianRandom;
  var CFG = global.MeridianConfig.CONFIG;
  var RUNWAY = global.MeridianConfig.RUNWAY;

  // Three island humps: main island at the origin, a high island west, a low
  // island east. Heights are in metres; the sea sits at y = 0.
  var ISLANDS = [
    { x: 0, z: 0, radius: 1050, height: 150 },
    { x: -1150, z: -650, radius: 750, height: 260 },
    { x: 1250, z: -350, radius: 680, height: 120 },
    { x: 900, z: 950, radius: 520, height: 70 },
    { x: -700, z: 1050, radius: 480, height: 55 },
  ];

  var noise = R.makeNoise2D(CFG.worldSeed);

  function islandFalloff(dx, dz, radius) {
    var d = Math.sqrt(dx * dx + dz * dz) / radius;
    if (d >= 1) return 0;
    var t = 1 - d * d;
    return t * t;
  }

  function runwayBlend(x, z) {
    // Flatten the ground into a shelf under the runway strip.
    var hdg = R.degToRad(RUNWAY.headingDeg);
    var dx = x - RUNWAY.centerX, dz = z - RUNWAY.centerZ;
    var along = dx * Math.sin(hdg) + dz * Math.cos(hdg);
    var across = dx * Math.cos(hdg) - dz * Math.sin(hdg);
    var a = Math.max(0, 1 - Math.abs(along) / (RUNWAY.length / 2 + 60));
    var b = Math.max(0, 1 - Math.abs(across) / (RUNWAY.width / 2 + 55));
    return Math.min(a, b);
  }

  // A broad valley along the runway's axis, so the strip sits in open
  // ground and a take-off or a final approach never meets a wall of hill.
  function runwayValley(x, z) {
    var hdg = R.degToRad(RUNWAY.headingDeg);
    var dx = x - RUNWAY.centerX, dz = z - RUNWAY.centerZ;
    var along = dx * Math.sin(hdg) + dz * Math.cos(hdg);
    var across = dx * Math.cos(hdg) - dz * Math.sin(hdg);
    function smoothEdge(v, inner, outer) {
      var t = R.clamp((outer - Math.abs(v)) / (outer - inner), 0, 1);
      return t * t * (3 - 2 * t);
    }
    return Math.min(smoothEdge(along, 480, 760), smoothEdge(across, 150, 280));
  }

  function terrainHeight(x, z) {
    var h = -14; // sea floor
    for (var i = 0; i < ISLANDS.length; i++) {
      var isl = ISLANDS[i];
      h += isl.height * islandFalloff(x - isl.x, z - isl.z, isl.radius);
    }
    // Rolling hills on top of the islands, none in the open sea.
    var land = Math.max(0, h + 14);
    if (land > 0.5) {
      h += noise.fbm(x * 0.0016 + 7, z * 0.0016 - 3, 4) * 26 * Math.min(1, land / 60);
      h += noise.fbm(x * 0.006 + 31, z * 0.006 + 11, 3) * 5 * Math.min(1, land / 40);
    }
    var flat = runwayBlend(x, z);
    if (flat > 0) h = R.lerp(h, RUNWAY.altitude, flat);
    var valley = runwayValley(x, z);
    if (valley > 0) h = R.lerp(h, RUNWAY.altitude + 4, valley * 0.92);
    return h;
  }

  function terrainColor(height, slope, rand) {
    // Sand at the shore, grass on the low land, rock on the steep high
    // ground, snow on the peaks — one coherent island palette.
    if (height < 3.5) return [0.86, 0.78, 0.55];
    if (height < 9) return [0.62, 0.72, 0.38];
    if (slope > 0.55 && height > 40) return [0.45, 0.42, 0.40];
    if (height > 190) return [0.93, 0.94, 0.96];
    if (height > 120) return [0.48, 0.50, 0.44];
    var g = 0.55 + rand() * 0.12;
    return [0.30 + rand() * 0.08, g, 0.24 + rand() * 0.06];
  }

  function buildTerrainMesh(scene) {
    var size = CFG.worldSize;
    var segments = 180;
    var geo = new THREE.PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2);
    var pos = geo.attributes.position;
    var colors = new Float32Array(pos.count * 3);
    var rand = R.mulberry32(CFG.worldSeed + 5);
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i), z = pos.getZ(i);
      var h = terrainHeight(x, z);
      pos.setY(i, h);
      var slope = Math.abs(terrainHeight(x + 8, z) - h) / 8 + Math.abs(terrainHeight(x, z + 8) - h) / 8;
      var c = terrainColor(h, slope, rand);
      colors[i * 3] = c[0]; colors[i * 3 + 1] = c[1]; colors[i * 3 + 2] = c[2];
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    var mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = false;
    scene.add(mesh);
    return mesh;
  }

  function buildSea(scene) {
    var geo = new THREE.PlaneGeometry(CFG.worldSize * 2.4, CFG.worldSize * 2.4, 1, 1);
    geo.rotateX(-Math.PI / 2);
    var mat = new THREE.MeshLambertMaterial({ color: 0x1d6f8e, transparent: true, opacity: 0.92 });
    var sea = new THREE.Mesh(geo, mat);
    sea.position.y = CFG.waterLevel;
    scene.add(sea);
    return sea;
  }

  function buildTrees(scene) {
    // Low-poly pines, instanced, scattered where the land is grassy.
    var rand = R.mulberry32(CFG.worldSeed + 77);
    var trunkGeo = new THREE.CylinderGeometry(0.5, 0.8, 4, 5);
    var trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
    var coneGeo = new THREE.ConeGeometry(3.4, 11, 6);
    var coneMat = new THREE.MeshLambertMaterial({ color: 0x2e6b34 });
    var placements = [];
    var tries = 0;
    while (placements.length < 420 && tries < 6000) {
      tries++;
      var x = (rand() * 2 - 1) * 1900, z = (rand() * 2 - 1) * 1900;
      var h = terrainHeight(x, z);
      if (h < 10 || h > 110) continue;
      if (runwayBlend(x, z) > 0.05) continue;
      var slope = Math.abs(terrainHeight(x + 8, z) - h) / 8;
      if (slope > 0.45) continue;
      placements.push({ x: x, z: z, h: h, s: 0.8 + rand() * 0.9 });
    }
    var trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, placements.length);
    var cones = new THREE.InstancedMesh(coneGeo, coneMat, placements.length);
    var m = new THREE.Matrix4();
    for (var i = 0; i < placements.length; i++) {
      var p = placements[i];
      m.makeScale(p.s, p.s, p.s);
      m.setPosition(p.x, p.h + 2 * p.s, p.z);
      trunks.setMatrixAt(i, m);
      m.makeScale(p.s, p.s, p.s);
      m.setPosition(p.x, p.h + (4 + 5.5) * p.s, p.z);
      cones.setMatrixAt(i, m);
    }
    scene.add(trunks); scene.add(cones);
    return { trunks: trunks, cones: cones };
  }

  function buildRunway(scene) {
    var group = new THREE.Group();
    var hdg = R.degToRad(RUNWAY.headingDeg);
    var strip = new THREE.Mesh(
      new THREE.PlaneGeometry(RUNWAY.width, RUNWAY.length),
      new THREE.MeshLambertMaterial({ color: 0x3a3f45 })
    );
    strip.rotation.x = -Math.PI / 2;
    strip.rotation.z = -hdg;
    strip.position.set(RUNWAY.centerX, RUNWAY.altitude + 0.15, RUNWAY.centerZ);
    group.add(strip);
    // Centre dashes.
    var dashMat = new THREE.MeshBasicMaterial({ color: 0xf5f0dc });
    for (var d = -RUNWAY.length / 2 + 30; d < RUNWAY.length / 2 - 10; d += 40) {
      var dash = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 16), dashMat);
      dash.rotation.x = -Math.PI / 2; dash.rotation.z = -hdg;
      dash.position.set(
        RUNWAY.centerX + Math.sin(hdg) * d,
        RUNWAY.altitude + 0.3,
        RUNWAY.centerZ + Math.cos(hdg) * d
      );
      group.add(dash);
    }
    // Threshold bars and edge lights, alternating white / amber.
    var edgeMatA = new THREE.MeshBasicMaterial({ color: 0xffffff });
    var edgeMatB = new THREE.MeshBasicMaterial({ color: 0xffb347 });
    for (var e = -RUNWAY.length / 2; e <= RUNWAY.length / 2; e += 30) {
      var side = [-1, 1];
      for (var s = 0; s < 2; s++) {
        var bulb = new THREE.Mesh(new THREE.SphereGeometry(1.1, 8, 6), (Math.round(e / 30) % 2 === 0) ? edgeMatA : edgeMatB);
        bulb.position.set(
          RUNWAY.centerX + Math.sin(hdg) * e + Math.cos(hdg) * side[s] * (RUNWAY.width / 2 + 3),
          RUNWAY.altitude + 0.8,
          RUNWAY.centerZ + Math.cos(hdg) * e - Math.sin(hdg) * side[s] * (RUNWAY.width / 2 + 3)
        );
        group.add(bulb);
      }
    }
    // A small tower and two hangars beside the strip.
    var tower = new THREE.Mesh(new THREE.BoxGeometry(10, 26, 10), new THREE.MeshLambertMaterial({ color: 0xd8d3c4 }));
    tower.position.set(RUNWAY.centerX + 46, RUNWAY.altitude + 13, RUNWAY.centerZ + 30);
    group.add(tower);
    var cab = new THREE.Mesh(new THREE.BoxGeometry(13, 5, 13), new THREE.MeshLambertMaterial({ color: 0x2e5a7d }));
    cab.position.set(RUNWAY.centerX + 46, RUNWAY.altitude + 28, RUNWAY.centerZ + 30);
    group.add(cab);
    var hangarMat = new THREE.MeshLambertMaterial({ color: 0xb8542f });
    [-70, -95].forEach(function (along) {
      var hangar = new THREE.Mesh(new THREE.BoxGeometry(26, 10, 20), hangarMat);
      hangar.position.set(
        RUNWAY.centerX + Math.sin(hdg) * along - Math.cos(hdg) * 48,
        RUNWAY.altitude + 5,
        RUNWAY.centerZ + Math.cos(hdg) * along + Math.sin(hdg) * 48
      );
      hangar.rotation.y = -hdg;
      group.add(hangar);
    });
    scene.add(group);
    return group;
  }

  function buildRingMesh(x, y, z, radius, index) {
    var group = new THREE.Group();
    var torus = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 1.6, 12, 40),
      new THREE.MeshBasicMaterial({ color: 0xffb347 })
    );
    group.add(torus);
    var inner = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.55, 8, 40),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8 })
    );
    group.add(inner);
    var label = makeNumberSprite(index + 1);
    label.position.set(0, radius + 12, 0);
    group.add(label);
    group.position.set(x, y, z);
    return group;
  }

  function makeNumberSprite(number) {
    var canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(10, 26, 43, 0.85)';
    ctx.beginPath(); ctx.arc(64, 64, 56, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffb347'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(64, 64, 56, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ffe9a8'; ctx.font = 'bold 64px Verdana, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(number), 64, 68);
    var tex = new THREE.CanvasTexture(canvas);
    var sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    sprite.scale.set(18, 18, 1);
    return sprite;
  }

  function buildClouds(scene) {
    var group = new THREE.Group();
    var rand = R.mulberry32(CFG.worldSeed + 31);
    var mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.88 });
    for (var i = 0; i < 34; i++) {
      var cloud = new THREE.Group();
      var puffs = 3 + Math.floor(rand() * 3);
      for (var p = 0; p < puffs; p++) {
        var r = 14 + rand() * 22;
        var puff = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat);
        puff.position.set((rand() * 2 - 1) * 40, (rand() * 2 - 1) * 6, (rand() * 2 - 1) * 18);
        puff.scale.y = 0.45;
        cloud.add(puff);
      }
      cloud.position.set((rand() * 2 - 1) * 1900, 190 + rand() * 130, (rand() * 2 - 1) * 1900);
      cloud.userData.drift = 1.5 + rand() * 2.5;
      group.add(cloud);
    }
    scene.add(group);
    return group;
  }

  function buildLights(scene, dusk) {
    var hemi = new THREE.HemisphereLight(dusk ? 0x8a6a9a : 0xbfd9ff, dusk ? 0x3a2f2a : 0x3f6b3a, dusk ? 0.55 : 0.85);
    scene.add(hemi);
    var sun = new THREE.DirectionalLight(dusk ? 0xff9a4d : 0xfff2d0, dusk ? 0.9 : 1.15);
    if (dusk) sun.position.set(-900, 260, -700);
    else sun.position.set(700, 1100, 400);
    scene.add(sun);
    return { hemi: hemi, sun: sun };
  }

  function buildSunSprite(scene, dusk) {
    var canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    var ctx = canvas.getContext('2d');
    var grad = ctx.createRadialGradient(128, 128, 8, 128, 128, 128);
    grad.addColorStop(0, dusk ? 'rgba(255, 190, 90, 1)' : 'rgba(255, 250, 220, 1)');
    grad.addColorStop(0.35, dusk ? 'rgba(255, 140, 60, 0.55)' : 'rgba(255, 240, 180, 0.45)');
    grad.addColorStop(1, 'rgba(255, 180, 80, 0)');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 256, 256);
    var tex = new THREE.CanvasTexture(canvas);
    var sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
    sprite.scale.set(520, 520, 1);
    if (dusk) sprite.position.set(-2600, 420, -2100);
    else sprite.position.set(2100, 1500, 1200);
    scene.add(sprite);
    return sprite;
  }

  global.MeridianTerrain = {
    terrainHeight: terrainHeight,
    buildTerrainMesh: buildTerrainMesh,
    buildSea: buildSea,
    buildTrees: buildTrees,
    buildRunway: buildRunway,
    buildRingMesh: buildRingMesh,
    buildClouds: buildClouds,
    buildLights: buildLights,
    buildSunSprite: buildSunSprite,
  };
})(typeof window !== 'undefined' ? window : globalThis);
