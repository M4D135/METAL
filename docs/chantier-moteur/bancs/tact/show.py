import json,sys
d=json.load(open(sys.argv[1]))
for name,m in d.items():
    print('=====',name,'viewport',m['viewport'],'canvas',m['canvas'],'safeArea',m['safeArea'],'safeOverride',m['safeOverride'],'startMs',m['startMs'],'state',m['state'])
    print(' menu:',m['menu']['buttons'],'coarse',m['menu']['coarse'],'mtp',m['menu']['mtp'])
    for t in m['targets']:
        e=t['edge'];print(f"  {t['id']:20s} {t['w']:6.1f}×{t['h']:5.1f} @({t['x']:6.1f},{t['y']:6.1f}) min={t['min']:5.1f} hit={t['hit']:14s} bords G{e['left']:.0f} H{e['top']:.0f} D{e['right']:.0f} B{e['bottom']:.0f} {'ctx' if t.get('contextual') else ''} {'désactivé' if t.get('disabled') else ''}")
    print('  under48:',m['under48'],' under44:',m['under44'])
    print('  overlaps:');[print('    ',o) for o in m['overlaps']]
    print('  gaps<12:',m['gaps'])
    print('  blocks:');[print(f"     {b['id']:18s} {b['w']:6.1f}×{b['h']:5.1f} @({b['x']:6.1f},{b['y']:6.1f}) {'ctx' if b.get('contextual') else ''}") for b in m['blocks']]
    print('  texts:',m['textCount'],m['textHist']);[print('    ',t) for t in m['smallest'][:10]]
