// Tunables and the three missions of Meridian Ridge. One file, one job:
// every number the game balances on lives here.
(function (global) {
  'use strict';

  var CONFIG = {
    worldSeed: 20261126,
    worldSize: 4200,          // terrain spans -2100..2100 m on x and z
    waterLevel: 0,
    maxSpeed: 92,             // m/s at full throttle
    cruiseSpeed: 58,
    stallSpeed: 26,           // below this she sinks
    minSpeed: 12,
    pitchRate: 0.55,          // rad/s at full stick
    rollRate: 1.5,
    maxBank: 1.05,            // rad, about 60 degrees
    maxPitch: 0.55,
    throttleRate: 0.55,       // per second
    fuelCapacity: 100,
    fuelBurn: 0.55,           // per second at full throttle
    ringRadius: 26,
    ringScore: 100,
    landingScoreMax: 500,
    crashDamage: 100,
    terrainHitDamage: 34,
    hardLandingDamage: 45,
    cameraChaseDistance: 15,
    cameraChaseHeight: 4.5,
  };

  // Ring courses are fixed waypoints over the islands; the seeded noise only
  // decorates the terrain, so every pilot flies the same course.
  var MISSIONS = [
    {
      id: 0,
      name: 'Harbour Rings',
      tagline: '5 rings · calm air',
      goal: 'Thread 5 rings, then land on the strip',
      dusk: false,
      wind: 0.0,
      fuelStart: 100,
      startHeading: 35,
      rings: [
        { x: 260, y: 130, z: -420 },
        { x: 640, y: 120, z: -760 },
        { x: 1050, y: 110, z: -620 },
        { x: 1180, y: 125, z: -140 },
        { x: 820, y: 85, z: 260 },
      ],
    },
    {
      id: 1,
      name: 'Mountain Pass',
      tagline: '6 rings · gusty valleys',
      goal: 'Thread 6 rings through the high valleys, then land',
      dusk: false,
      wind: 0.35,
      fuelStart: 100,
      startHeading: 300,
      rings: [
        { x: -420, y: 150, z: -620 },
        { x: -820, y: 190, z: -980 },
        { x: -1150, y: 280, z: -560 },
        { x: -980, y: 170, z: -40 },
        { x: -560, y: 130, z: 420 },
        { x: -120, y: 100, z: 700 },
      ],
    },
    {
      id: 2,
      name: 'Storm Courier',
      tagline: '7 rings · dusk & low fuel',
      goal: 'Deliver the mail through 7 rings at dusk, then land',
      dusk: true,
      wind: 0.5,
      fuelStart: 78,
      startHeading: 140,
      rings: [
        { x: 420, y: 100, z: 520 },
        { x: 900, y: 130, z: 780 },
        { x: 1330, y: 120, z: 420 },
        { x: 1420, y: 150, z: -160 },
        { x: 1080, y: 180, z: -620 },
        { x: 560, y: 140, z: -900 },
        { x: 120, y: 110, z: -560 },
      ],
    },
  ];

  // The runway at Port Anselm: a flat strip on the main island, heading 040.
  var RUNWAY = {
    centerX: 0, centerZ: -60,
    headingDeg: 40,
    length: 420, width: 34,
    altitude: 6,
  };

  global.MeridianConfig = { CONFIG: CONFIG, MISSIONS: MISSIONS, RUNWAY: RUNWAY };
})(typeof window !== 'undefined' ? window : globalThis);
