// The Kestrel, Meridian Air's courier seaplane, built from primitives in
// her own teal-and-amber livery. No borrowed model, no borrowed art.
(function (global) {
  'use strict';

  function lambert(color) { return new THREE.MeshLambertMaterial({ color: color }); }

  function buildKestrel() {
    var plane = new THREE.Group();
    var teal = lambert(0x1f7a6e);
    var cream = lambert(0xf2e8d5);
    var amber = lambert(0xffb347);
    var dark = lambert(0x22303a);
    var glass = new THREE.MeshLambertMaterial({ color: 0x9fd0ef, transparent: true, opacity: 0.85 });

    // Fuselage: a tapered cylinder with a rounded nose.
    var body = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 0.72, 6.4, 12), teal);
    body.rotation.x = Math.PI / 2;
    plane.add(body);
    var nose = new THREE.Mesh(new THREE.SphereGeometry(1.05, 12, 10), amber);
    nose.scale.set(1, 1, 1.15);
    nose.position.z = 3.2;
    plane.add(nose);
    var tailCone = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.18, 2.4, 10), teal);
    tailCone.rotation.x = Math.PI / 2;
    tailCone.position.z = -4.2;
    plane.add(tailCone);

    // Canopy: a glass bubble the pilot sits under.
    var canopy = new THREE.Mesh(new THREE.SphereGeometry(0.85, 14, 10), glass);
    canopy.scale.set(0.95, 0.75, 1.9);
    canopy.position.set(0, 0.85, 1.1);
    plane.add(canopy);

    // Main wings: a low wing with a slight dihedral, amber tips.
    function wing(side) {
      var w = new THREE.Group();
      var panel = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.22, 1.7), cream);
      panel.position.x = side * 2.9;
      w.add(panel);
      var tip = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.24, 1.7), amber);
      tip.position.x = side * 5.35;
      w.add(tip);
      w.rotation.z = side * -0.07;
      w.position.z = 0.4;
      return w;
    }
    plane.add(wing(-1)); plane.add(wing(1));

    // Tail: fin and stabilisers.
    var fin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.0, 1.5), amber);
    fin.position.set(0, 1.05, -4.9);
    fin.rotation.x = -0.18;
    plane.add(fin);
    var stab = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.18, 1.1), cream);
    stab.position.set(0, 0.25, -4.9);
    plane.add(stab);

    // Propeller: a spinner and two blades that spin in the loop.
    var prop = new THREE.Group();
    var spinner = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.9, 10), dark);
    spinner.rotation.x = Math.PI / 2;
    spinner.position.z = 0.5;
    prop.add(spinner);
    var bladeGeo = new THREE.BoxGeometry(0.28, 3.4, 0.1);
    var blade1 = new THREE.Mesh(bladeGeo, dark);
    var blade2 = new THREE.Mesh(bladeGeo, dark);
    blade2.rotation.z = Math.PI / 2;
    prop.add(blade1); prop.add(blade2);
    prop.position.z = 4.35;
    plane.add(prop);

    // Floats: she is a seaplane, so two floats under the wings.
    [-1, 1].forEach(function (side) {
      var float = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 4.6, 8), amber);
      float.rotation.x = Math.PI / 2;
      float.position.set(side * 1.9, -1.25, 0.6);
      plane.add(float);
      var strut = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.1, 0.5), dark);
      strut.position.set(side * 1.9, -0.65, 0.6);
      plane.add(strut);
    });

    // Landing gear: three small wheels that drop with the G key.
    var gear = new THREE.Group();
    var wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10);
    wheelGeo.rotateZ(Math.PI / 2);
    [[-1.5, -1.7, 1.2], [1.5, -1.7, 1.2], [0, -1.7, -3.4]].forEach(function (p) {
      var wheel = new THREE.Mesh(wheelGeo, dark);
      wheel.position.set(p[0], p[1], p[2]);
      gear.add(wheel);
      var leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.9, 0.14), dark);
      leg.position.set(p[0], -1.25, p[2]);
      gear.add(leg);
    });
    gear.visible = false;
    plane.add(gear);

    // Navigation lights: red port, green starboard, white tail strobe.
    function navLight(color, x, y, z) {
      var light = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 8, 6),
        new THREE.MeshBasicMaterial({ color: color })
      );
      light.position.set(x, y, z);
      plane.add(light);
      return light;
    }
    var lightPort = navLight(0xff2a2a, -5.6, 0.1, 0.4);
    var lightStarboard = navLight(0x2aff5a, 5.6, 0.1, 0.4);
    var lightTail = navLight(0xffffff, 0, 0.4, -5.4);

    // A faint propeller disc so the spin reads at a glance.
    var disc = new THREE.Mesh(
      new THREE.CircleGeometry(1.75, 24),
      new THREE.MeshBasicMaterial({ color: 0xdddddd, transparent: true, opacity: 0.10, side: THREE.DoubleSide })
    );
    disc.position.z = 4.4;
    plane.add(disc);

    return {
      group: plane,
      propeller: prop,
      propellerDisc: disc,
      gear: gear,
      lightPort: lightPort,
      lightStarboard: lightStarboard,
      lightTail: lightTail,
    };
  }

  global.MeridianAircraft = { buildKestrel: buildKestrel };
})(typeof window !== 'undefined' ? window : globalThis);
