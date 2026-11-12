// NATIF : resolution reellement rendue par resize() de FERRO v0.2 (renderer.js:1539-1552, METAL 0.8 : 1383-1396),
// recalculee a l'identique, pour chaque ecran et chaque mode. Aucune mesure : pure arithmetique du code.
function webgl(quality, cssW, cssH, dpr, autoScale = 1) {
  let ratio = typeof quality === 'number' ? quality : quality === 'low' ? .8 : quality === 'high' ? Math.min(dpr, 2) : Math.min(dpr, 1.5);
  ratio = Math.max(.5, Math.min(2, ratio));
  if (quality === 'auto') ratio = Math.min(ratio, Math.sqrt(1800000 / (cssW * cssH))) * autoScale;
  return [Math.max(1, Math.round(cssW * ratio)), Math.max(1, Math.round(cssH * ratio)), ratio];
}
function soft(quality, cssW, cssH) {
  const requested = quality === 'low' ? .8 : quality === 'high' ? 1.25 : 1, limit = quality === 'low' ? [720, 480] : quality === 'high' ? [1280, 900] : [1024, 720];
  const ratio = Math.min(requested, limit[0] / cssW, limit[1] / cssH);
  return [Math.round(cssW * ratio), Math.round(cssH * ratio), ratio];
}
const screens = [
  ['PC 1080p, DPR 1', 1920, 1080, 1], ['PC portable 1080p, DPR 1,25', 1536, 864, 1.25], ['PC 1440p, DPR 1', 2560, 1440, 1],
  ['PC 4K, DPR 1,5', 2560, 1440, 1.5], ['PC 4K, DPR 2', 1920, 1080, 2], ['MacBook Pro 14 Retina, DPR 2', 1512, 982, 2],
  ['iMac / Studio 5K, DPR 2', 2560, 1440, 2], ['Telephone 852x393, DPR 3', 852, 393, 3], ['Telephone Android 915x412, DPR 2,625', 915, 412, 2.625],
];
const rows = [];
for (const [name, w, h, dpr] of screens) {
  const nw = Math.round(w * dpr), nh = Math.round(h * dpr), native = nw * nh;
  const line = {ecran: name, css: w + 'x' + h, natif: nw + 'x' + nh, natifMPix: +(native / 1e6).toFixed(2)};
  for (const [label, q, s] of [['auto', 'auto', 1], ['autoPlancher', 'auto', .65], ['haute', 'high', 1], ['eco', 'low', 1]]) {
    const [cw, ch] = webgl(q, w, h, dpr, s);
    line[label] = `${cw}x${ch} (${(cw * ch / 1e6).toFixed(2)} MPix, ${(100 * cw * ch / native).toFixed(0)} % des pixels, echelle lineaire ${(cw / nw).toFixed(2)})`;
  }
  const [sw, sh] = soft('auto', w, h); line.logicielAuto = `${sw}x${sh} (${(100 * sw * sh / native).toFixed(0)} %)`;
  rows.push(line);
}
console.log(JSON.stringify(rows, null, 1));
