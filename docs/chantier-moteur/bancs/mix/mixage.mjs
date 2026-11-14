// Banc MIX — vérificateur de seuils du lot 11b (MIX-11).
// Lit un ou plusieurs fichiers JSON produits par mix.html (via run.mjs) et rend compte,
// ligne par ligne, des cinq seuils de la fiche : réduction de gain ≤ 3 dB, aucun échantillon
// au-dessus de 0,875 avant l'écrêteur, pompage ≤ 4 dB, aucune voix volée, nullité ≤ −110 dB RMS.
// Sortie : un tableau lisible, et un code de retour non nul si un seuil est dépassé.
// usage : node mixage.mjs [--passes=8] [--scenes=a,b,c,d] resultat.json [resultat2.json …]
import {readFileSync} from 'node:fs';

const args = process.argv.slice(2), files = [];
let minPasses = 8, wanted = null;
for (const a of args) {
  if (a.startsWith('--passes=')) minPasses = +a.slice(9);
  else if (a.startsWith('--scenes=')) wanted = a.slice(9).split(',');
  else files.push(a);
}
if (!files.length) { console.error('usage : node mixage.mjs [--passes=8] [--scenes=a,b,c,d] resultat.json …'); process.exit(2); }

const SEUILS = {reductionDb: 3, echantillon: 0, pompageDb: 4, voixvolees: 0, nulliteRmsDb: -110, nulliteCreteDb: -80, rattrapageDb: 0.05};
const checks = [], scenes = new Map();
const note = (where, controle, valeur, seuil, ok) => checks.push({where, controle, valeur, seuil, ok});
const num = v => (v === null || v === undefined || Number.isNaN(v) ? null : v);

for (const f of files) {
  const j = JSON.parse(readFileSync(f, 'utf8')), base = f.split('/').pop();
  if (j.errors && j.errors.length) note(base, 'erreurs de la page', String(j.errors[0]).slice(0, 120), 'aucune', false);
  for (const r of (j.rows || j.comp || [])) {
    if (wanted && r.scene && !wanted.includes(r.scene)) continue;
    const where = [base, j.job, r.scene, r.name, r.cue, r.recipe, r.comp, r.duck, r.tell, r.variant, r.pass !== undefined ? 'passe ' + r.pass : null].filter(Boolean).join(' · ');
    if (r.scene) { const k = `${base}|${j.job}|${r.scene}|${r.recipe || ''}|${r.comp || ''}|${r.duck || ''}|${r.tell || ''}`; scenes.set(k, (scenes.get(k) || 0) + 1); }
    // réduction de gain subie par le transitoire : rapport sortie/entrée du limiteur, rattrapage retiré
    const red = r.gr ? num(r.gr.minDb) : r.grMinDb !== undefined ? num(r.grMinDb) : undefined;
    if (red !== undefined && red !== null) note(where, 'réduction de gain (dB)', Math.abs(red).toFixed(2), `≤ ${SEUILS.reductionDb}`, Math.abs(red) <= SEUILS.reductionDb);
    // échantillons au-dessus de 0,875 avant l'écrêteur
    if (r.aboveKnee !== undefined) note(where, 'échantillons > 0,875', r.aboveKnee, `= ${SEUILS.echantillon}`, r.aboveKnee === SEUILS.echantillon);
    // pompage et ondulation de la musique pendant les rafales
    if (r.pump) {
      const d = num(r.pump.dropDb && r.pump.dropDb.max), rp = num(r.pump.rippleDb && r.pump.rippleDb.max);
      if (d !== null) note(where, 'pompage de la musique (dB)', d.toFixed(2), `≤ ${SEUILS.pompageDb}`, d <= SEUILS.pompageDb);
      if (rp !== null) note(where, 'ondulation à 3 Hz (dB)', rp.toFixed(2), 'mesurée', true);
    }
    // voix volées
    const stolen = r.voices ? num(r.voices.stolenVoices) : r.stolenVoices !== undefined ? num(r.stolenVoices) : undefined;
    if (stolen !== undefined && stolen !== null) note(where, 'voix volées', stolen, `= ${SEUILS.voixvolees}`, stolen === SEUILS.voixvolees);
    // nullité (job=null, job=ab, job=inject)
    if (r.diffRmsDbFS !== undefined) {
      const rms = r.diffRmsDbFS === null ? -Infinity : r.diffRmsDbFS, pk = r.diffPeakDbFS === null ? -Infinity : r.diffPeakDbFS;
      note(where, 'nullité (dB RMS)', Number.isFinite(rms) ? rms.toFixed(2) : '−∞', `≤ ${SEUILS.nulliteRmsDb}`, rms <= SEUILS.nulliteRmsDb);
      note(where, 'nullité (dBFS crête)', Number.isFinite(pk) ? pk.toFixed(2) : '−∞', `≤ ${SEUILS.nulliteCreteDb}`, pk <= SEUILS.nulliteCreteDb);
    }
    // rattrapage mesuré contre rattrapage annoncé par FAudio.makeupDb (job=calib, T3)
    if (r.makeupDb !== undefined && r.annonceDb !== undefined) {
      const e = Math.abs(r.makeupDb - r.annonceDb);
      note(where, 'écart rattrapage mesuré/annoncé (dB)', e.toFixed(3), `≤ ${SEUILS.rattrapageDb}`, e <= SEUILS.rattrapageDb);
    }
  }
}
for (const [k, n] of scenes) if (n < minPasses) note(k.split('|').slice(1).join(' · '), 'passes par scène', n, `≥ ${minPasses}`, false);

const w = Math.max(12, ...checks.map(c => c.controle.length));
console.log(`seuils : réduction ≤ ${SEUILS.reductionDb} dB · ${SEUILS.echantillon} échantillon > 0,875 · pompage ≤ ${SEUILS.pompageDb} dB · ${SEUILS.voixvolees} voix volée · nullité ≤ ${SEUILS.nulliteRmsDb} dB RMS et ≤ ${SEUILS.nulliteCreteDb} dBFS crête · au moins ${minPasses} passes par scène`);
for (const c of checks) console.log(`${c.ok ? 'OK    ' : 'ÉCHEC '} ${c.controle.padEnd(w)} | ${String(c.valeur).padStart(9)} | ${String(c.seuil).padEnd(12)} | ${c.where}`);
const failed = checks.filter(c => !c.ok).length;
console.log(`${checks.length} contrôles, ${checks.length - failed} conformes, ${failed} hors seuil.`);
process.exit(failed ? 1 : 0);
