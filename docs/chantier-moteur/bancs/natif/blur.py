# Decode le PNG (zlib, filtres 0-4) et mesure, par canvas, le contraste du damier et la nettete des traits.
import zlib, struct, sys
d = open(sys.argv[1], 'rb').read(); pos = 8; idat = b''
while pos < len(d):
    n, t = struct.unpack('>I4s', d[pos:pos+8]); body = d[pos+8:pos+8+n]; pos += 12 + n
    if t == b'IHDR': W, H, bd, ct = struct.unpack('>IIBB', body[:10])
    elif t == b'IDAT': idat += body
bpp = {2: 3, 6: 4, 0: 1}[ct]; raw = zlib.decompress(idat); stride = W * bpp; rows = []; prev = bytearray(stride)
for y in range(H):
    f = raw[y*(stride+1)]; cur = bytearray(raw[y*(stride+1)+1:(y+1)*(stride+1)])
    if f == 1:
        for i in range(bpp, stride): cur[i] = (cur[i] + cur[i-bpp]) & 255
    elif f == 2:
        for i in range(stride): cur[i] = (cur[i] + prev[i]) & 255
    elif f == 3:
        for i in range(stride): cur[i] = (cur[i] + (((cur[i-bpp] if i >= bpp else 0) + prev[i]) >> 1)) & 255
    elif f == 4:
        for i in range(stride):
            a = cur[i-bpp] if i >= bpp else 0; b = prev[i]; c = prev[i-bpp] if i >= bpp else 0
            p = a + b - c; pa, pb, pc = abs(p-a), abs(p-b), abs(p-c)
            cur[i] = (cur[i] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
    rows.append(cur); prev = cur
print('PNG', W, 'x', H, 'type', ct)
g = lambda x, y: rows[y][x*bpp+1]
names = ['600 (natif)', '599 (ecart d\'un pixel)', '559 (echelle 0,93 : auto sur 1080p)', '330 (echelle 0,55 : auto sur Retina 14)', '300 (echelle 0,5)']
ref = None
for i, name in enumerate(names):
    x0 = (20 + i*320)*2; y0 = 20*2
    # damier : moitie basse (lignes 330..580 du canvas en pixels physiques), contraste = moyenne |v-127.5|/127.5
    vals = [g(x0+x, y0+y) for y in range(330, 580, 3) for x in range(10, 590)]
    contrast = sum(abs(v-127.5) for v in vals)/len(vals)/127.5
    worst = min(sum(abs(g(x0+x, y0+y)-127.5) for x in range(xb, xb+40))/40/127.5 for y in (400, 500) for xb in range(10, 550, 20))
    # traits : moitie haute, nettete = moyenne du gradient horizontal absolu
    grad = sum(abs(g(x0+x+1, y0+y)-g(x0+x, y0+y)) for y in range(10, 290, 2) for x in range(10, 589))/(140*579)
    if ref is None: ref = (contrast, grad)
    print(f"  tampon {name:42s} damier: contraste {100*contrast:5.1f} % (pire bande {100*worst:5.1f} %) | traits: nettete {100*grad/ref[1]:5.1f} % du natif")
