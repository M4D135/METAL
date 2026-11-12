/* METAL: weapon report recipes for FAudio (FEEL-06, MIX-01). Original numbers
   for a heavy, classic-shooter weight; no samples and no copied code. */
(function () {
  'use strict';
  if (!window.FAudio || typeof FAudio.recipe !== 'function') return;
  // Crack [gain, decay ms]; thump pitch f0->f1 Hz, pitch/amplitude decays s,
  // gain; body low-pass Hz, decay s, gain, drive; mechanism [s, gain, Hz];
  // room tail s and gain; final fade s. Rocket and grenade fade over 40 and
  // 80 ms so both bank variants end below .04. The grenade launch (also the
  // enemy grenadier) is the MIX bench hypothesis, 520 ms, to confirm by ear.
  var weapons = {
    pistol: {dur:.34, crack:[.55,1.6], thump:{f0:150,f1:55,tp:.020,ta:.060,g:.85}, body:{cut:2000,tb:.038,g:.75,drive:3.0}, mech:[[.055,.22,2600]], room:{tr:.085,g:.20}},
    smg: {dur:.24, crack:[.60,1.2], thump:{f0:175,f1:62,tp:.016,ta:.040,g:.80}, body:{cut:2300,tb:.026,g:.70,drive:3.4}, mech:[[.030,.16,3000]], room:{tr:.070,g:.18}},
    shotgun: {dur:.92, crack:[.70,2.2], thump:{f0:120,f1:42,tp:.032,ta:.130,g:1.0}, body:{cut:1500,tb:.085,g:.95,drive:4.0}, mech:[[.47,.30,2200],[.56,.34,1700]], room:{tr:.160,g:.24}},
    rocket: {dur:.80, fade:.04, crack:[.45,2.5], thump:{f0:95,f1:38,tp:.060,ta:.200,g:.95}, body:{cut:1100,tb:.180,g:.90,drive:2.6}, mech:[[.020,.20,1900]], room:{tr:.220,g:.22}},
    grenade: {dur:.52, fade:.08, crack:[.45,2.5], thump:{f0:110,f1:45,tp:.060,ta:.200,g:.95}, body:{cut:1100,tb:.120,g:.90,drive:2.6}, mech:[[.020,.20,1900]], room:{tr:.160,g:.22}}
  }, recipes = {};
  Object.keys(weapons).forEach(function (name) { recipes[name] = FAudio.recipe(name, weapons[name]); });
  window.MetalAudio = {recipes: recipes, options: function () { return {recipes: recipes}; }};
}());
