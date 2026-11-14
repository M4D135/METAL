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
  }, confirmations = {
    // FEEL-07 confirmations. These names are METAL's, not engine effect names:
    // FAudio prepares them with the bank, and without them hit and kill keep
    // the v0.2 cues. Touch: two tonal ticks at 2.8 and 4.1 kHz, the generator's
    // 11 ms tonal decay standing for the 12 ms of the brief. Kill: a 90 to
    // 50 Hz thunk over a 70 ms decay plus one 3.2 kHz tick, both in one buffer.
    touchConfirm: {dur:.055, mech:[[0,.34,2800],[.002,.28,4100]], room:{tr:.030,g:.10}},
    killConfirm: {dur:.20, thump:{f0:90,f1:50,tp:.030,ta:.070,g:.95}, body:{cut:600,tb:.050,g:.55,drive:2.2}, mech:[[.004,.45,3200]], room:{tr:.060,g:.12}}
  }, recipes = {}, extras = {};
  // FEEL-07 enemy reports: the same recipe as the player's weapon, minus the
  // mechanical click. The rate (.85), the 1.1 kHz ceiling and the level (.24)
  // belong to the voice in FAudio, not to the waveform, so the enemy shares the
  // player's buffers byte for byte whenever the engine asks for these names.
  function noMech (recipe) {
    var copy = {}, key;
    for (key in recipe) if (Object.prototype.hasOwnProperty.call(recipe, key)) copy[key] = recipe[key];
    copy.mech = [];
    return copy;
  }
  Object.keys(weapons).forEach(function (name) { recipes[name] = FAudio.recipe(name, weapons[name]); });
  Object.keys(confirmations).forEach(function (name) { extras[name] = FAudio.recipe(name, confirmations[name]); });
  extras.enemySmg = FAudio.recipe('enemySmg', noMech(weapons.smg));
  extras.enemyGrenade = FAudio.recipe('enemyGrenade', noMech(weapons.grenade));
  // MIX-V1 : le pistolet tire tous les 0,32 s. Une tenue de 0,18 s laisse la
  // musique remonter puis replonger trois fois par seconde (ondulation mesurée
  // 5,8 dB à la scène « Fer noir »). Tenir 0,36 s au tir et 0,30 s aux armes
  // lourdes supprime l'ondulation, sans toucher à la profondeur du duck ni au
  // timbre de la musique : le retour reste à tau 0,18 s.
  var duckClasses = [
    {cues: ['shot'], hold: .36},
    {cues: ['fracture', 'rocket', 'grenade', 'grenadeLaunch'], hold: .30}
  ];
  // MIX-04 : le préréglage « Doom » mesuré par le banc. Les rapports du joueur
  // montent de 3 dB (×1,41 : pistolet 0,89, SMG 0,69, pompe 1,09, roquette 0,80
  // sur les gains internes 0,63 / 0,49 / 0,77 / 0,57), et le limiteur passe à
  // −9 dB, genou 6, ratio 8:1, attaque 2 ms, relâchement 100 ms. level:'auto' :
  // pas de compensation du rattrapage, la crête de la scène (c) passerait de
  // 0,77 à 0,87, au ras du genou de l'écrêteur. Les tirs ennemis ne sont pas
  // concernés : la table n'est lue que dans les cues du joueur.
  var weaponGain = {pistol: 1.41, smg: 1.41, shotgun: 1.41, rocket: 1.41};
  var chain = {compressor: {threshold: -9, knee: 6, ratio: 8, attack: .002, release: .10}, level: 'auto'};
  window.MetalAudio = {recipes: recipes, extras: extras, options: function () { return {recipes: recipes, extras: extras, duck: {classes: duckClasses}, weaponGain: weaponGain, chain: chain}; }};
}());
