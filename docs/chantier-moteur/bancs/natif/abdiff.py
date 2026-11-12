import zlib, struct, sys
def load(p):
    d = open(p, 'rb').read(); pos = 8; idat = b''
    while pos < len(d):
        n, t = struct.unpack('>I4s', d[pos:pos+8]); body = d[pos+8:pos+8+n]; pos += 12 + n
        if t == b'IHDR': W, H, bd, ct = struct.unpack('>IIBB', body[:10])
        elif t == b'IDAT': idat += body
    bpp = {2: 3, 6: 4}[ct]; raw = zlib.decompress(idat); stride = W * bpp; rows = []; prev = bytearray(stride)
    for y in range(H):
        f = raw[y*(stride+1)]; cur = bytearray(raw[y*(stride+1)+1:(y+1)*(stride+1)])
        if f == 1:
            for i in range(bpp, stride): cur[i] = (cur[i] + cur[i-bpp]) & 255
        elif f == 2:
            cur = bytearray((a + b) & 255 for a, b in zip(cur, prev))
        elif f == 3:
            for i in range(stride): cur[i] = (cur[i] + (((cur[i-bpp] if i >= bpp else 0) + prev[i]) >> 1)) & 255
        elif f == 4:
            for i in range(stride):
                a = cur[i-bpp] if i >= bpp else 0; b = prev[i]; c = prev[i-bpp] if i >= bpp else 0
                p = a + b - c; pa, pb, pc = abs(p-a), abs(p-b), abs(p-c)
                cur[i] = (cur[i] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        rows.append(cur); prev = cur
    return W, H, bpp, rows
for s in ('ext', 'int'):
    W, H, bpp, A = load(f'out/ab-base-{s}.png'); _, _, _, B = load(f'out/ab-visu4-{s}.png')
    mx = 0; n1 = n3 = 0; tot = 0; mean = 0
    for ra, rb in zip(A, B):
        for x in range(0, W*bpp, bpp):
            d = max(abs(ra[x]-rb[x]), abs(ra[x+1]-rb[x+1]), abs(ra[x+2]-rb[x+2])); mean += ra[x+1]
            if d:
                tot += 1
                if d > 1: n1 += 1
                if d > 3: n3 += 1
                if d > mx: mx = d
    print(s, W, 'x', H, 'moyenne verte', round(mean/(W*H), 1), '| ecart max', mx, '| px differents', tot, '(%.1f %%)' % (100*tot/(W*H)), '| >1 niveau', n1, '(%.2f %%)' % (100*n1/(W*H)), '| >3 niveaux', n3, '(%.3f %%)' % (100*n3/(W*H)))
