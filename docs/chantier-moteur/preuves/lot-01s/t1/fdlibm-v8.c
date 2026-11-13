/* Lot 01 suite / T1 — C witness: V8's fdlibm (src/base/ieee754.cc) for sin, cos,
 * atan, atan2 and __ieee754_rem_pio2 (with __kernel_rem_pio2), transcribed with
 * the same expressions as V8 so that a compiler contracts them the same way.
 *
 *   clang|gcc -O2 -ffp-contract=off -> what V8 computes without FMA (x86-64
 *                                      baseline); FMath (src/fmath.js) must
 *                                      equal it bit for bit.
 *   clang -O2 -ffp-contract=on      -> what V8 computes when its C++ is compiled
 *                                      with contraction on an FMA target
 *                                      (clang's default; Node on darwin-arm64).
 *   gcc -O2 -ffp-contract=fast      -> the same with gcc's default (Node on
 *                                      linux-arm64); gcc 13 treats =on as =off.
 *
 * Reads one request per line on stdin, hexadecimal IEEE-754 bit patterns:
 *   sin X | cos X | atan X | atan2 Y X   -> prints the result bits
 *   rem X                                -> prints "n Y0 Y1" (n in decimal)
 *
 * fdlibm: Copyright (C) 1993 by Sun Microsystems, Inc. All rights reserved.
 * Developed at SunSoft, a Sun Microsystems, Inc. business. Permission to use,
 * copy, modify, and distribute this software is freely granted, provided that
 * this notice is preserved.
 *
 * V8 (src/base/ieee754.cc): the original source code covered by the above
 * license has been modified significantly by Google Inc.
 * Copyright 2016 the V8 project authors. All rights reserved.
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *   * Redistributions of source code must retain the above copyright notice,
 *     this list of conditions and the following disclaimer.
 *   * Redistributions in binary form must reproduce the above copyright
 *     notice, this list of conditions and the following disclaimer in the
 *     documentation and/or other materials provided with the distribution.
 *   * Neither the name of Google Inc. nor the names of its contributors may be
 *     used to endorse or promote products derived from this software without
 *     specific prior written permission.
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */
#include <math.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>

static int32_t get_high(double d) { uint64_t b; memcpy(&b, &d, 8); return (int32_t)(b >> 32); }
static uint32_t get_low(double d) { uint64_t b; memcpy(&b, &d, 8); return (uint32_t)b; }
static double insert_words(uint32_t hi, uint32_t lo) { uint64_t b = ((uint64_t)hi << 32) | lo; double d; memcpy(&d, &b, 8); return d; }
#define GET_HIGH_WORD(i, d) ((i) = get_high(d))
#define GET_LOW_WORD(i, d) ((i) = get_low(d))
#define EXTRACT_WORDS(hi, lo, d) ((hi) = get_high(d), (lo) = get_low(d))
#define INSERT_WORDS(d, hi, lo) ((d) = insert_words((uint32_t)(hi), (uint32_t)(lo)))
#define SET_HIGH_WORD(d, v) ((d) = insert_words((uint32_t)(v), get_low(d)))
#define SET_LOW_WORD(d, v) ((d) = insert_words((uint32_t)get_high(d), (uint32_t)(v)))

static int __kernel_rem_pio2(double *x, double *y, int e0, int nx, int prec, const int32_t *ipio2) {
  static const int init_jk[] = {2, 3, 4, 6};
  static const double PIo2[] = {
      1.57079625129699707031e+00, /* 0x3FF921FB, 0x40000000 */
      7.54978941586159635335e-08, /* 0x3E74442D, 0x00000000 */
      5.39030252995776476554e-15, /* 0x3CF84698, 0x80000000 */
      3.28200341580791294123e-22, /* 0x3B78CC51, 0x60000000 */
      1.27065575308067607349e-29, /* 0x39F01B83, 0x80000000 */
      1.22933308981111328932e-36, /* 0x387A2520, 0x40000000 */
      2.73370053816464559624e-44, /* 0x36E38222, 0x80000000 */
      2.16741683877804819444e-51, /* 0x3569F31D, 0x00000000 */
  };
  static const double zero = 0.0, one = 1.0,
      two24 = 1.67772160000000000000e+07,  /* 0x41700000, 0x00000000 */
      twon24 = 5.96046447753906250000e-08; /* 0x3E700000, 0x00000000 */
  int32_t jz, jx, jv, jp, jk, carry, n, iq[20], i, j, k, m, q0, ih;
  double z, fw, f[20], fq[20], q[20];

  jk = init_jk[prec];
  jp = jk;
  jx = nx - 1;
  jv = (e0 - 3) / 24;
  if (jv < 0) jv = 0;
  q0 = e0 - 24 * (jv + 1);
  j = jv - jx;
  m = jx + jk;
  for (i = 0; i <= m; i++, j++) f[i] = (j < 0) ? zero : (double)ipio2[j];
  for (i = 0; i <= jk; i++) {
    for (j = 0, fw = 0.0; j <= jx; j++) fw += x[j] * f[jx + i - j];
    q[i] = fw;
  }
  jz = jk;
recompute:
  for (i = 0, j = jz, z = q[jz]; j > 0; i++, j--) {
    fw = (double)((int32_t)(twon24 * z));
    iq[i] = (int32_t)(z - two24 * fw);
    z = q[j - 1] + fw;
  }
  z = scalbn(z, q0);
  z -= 8.0 * floor(z * 0.125);
  n = (int32_t)z;
  z -= (double)n;
  ih = 0;
  if (q0 > 0) {
    i = (iq[jz - 1] >> (24 - q0));
    n += i;
    iq[jz - 1] -= i << (24 - q0);
    ih = iq[jz - 1] >> (23 - q0);
  } else if (q0 == 0) {
    ih = iq[jz - 1] >> 23;
  } else if (z >= 0.5) {
    ih = 2;
  }
  if (ih > 0) {
    n += 1;
    carry = 0;
    for (i = 0; i < jz; i++) {
      j = iq[i];
      if (carry == 0) {
        if (j != 0) {
          carry = 1;
          iq[i] = 0x1000000 - j;
        }
      } else {
        iq[i] = 0xFFFFFF - j;
      }
    }
    if (q0 > 0) {
      switch (q0) {
        case 1: iq[jz - 1] &= 0x7FFFFF; break;
        case 2: iq[jz - 1] &= 0x3FFFFF; break;
      }
    }
    if (ih == 2) {
      z = one - z;
      if (carry != 0) z -= scalbn(one, q0);
    }
  }
  if (z == zero) {
    j = 0;
    for (i = jz - 1; i >= jk; i--) j |= iq[i];
    if (j == 0) {
      for (k = 1; jk >= k && iq[jk - k] == 0; k++) {
      }
      for (i = jz + 1; i <= jz + k; i++) {
        f[jx + i] = ipio2[jv + i];
        for (j = 0, fw = 0.0; j <= jx; j++) fw += x[j] * f[jx + i - j];
        q[i] = fw;
      }
      jz += k;
      goto recompute;
    }
  }
  if (z == 0.0) {
    jz -= 1;
    q0 -= 24;
    while (iq[jz] == 0) {
      jz--;
      q0 -= 24;
    }
  } else {
    z = scalbn(z, -q0);
    if (z >= two24) {
      fw = (double)((int32_t)(twon24 * z));
      iq[jz] = (int32_t)(z - two24 * fw);
      jz += 1;
      q0 += 24;
      iq[jz] = (int32_t)fw;
    } else {
      iq[jz] = (int32_t)z;
    }
  }
  fw = scalbn(one, q0);
  for (i = jz; i >= 0; i--) {
    q[i] = fw * (double)iq[i];
    fw *= twon24;
  }
  for (i = jz; i >= 0; i--) {
    for (fw = 0.0, k = 0; k <= jp && k <= jz - i; k++) fw += PIo2[k] * q[i + k];
    fq[jz - i] = fw;
  }
  switch (prec) {
    case 0:
      fw = 0.0;
      for (i = jz; i >= 0; i--) fw += fq[i];
      y[0] = (ih == 0) ? fw : -fw;
      break;
    case 1:
    case 2:
      fw = 0.0;
      for (i = jz; i >= 0; i--) fw += fq[i];
      y[0] = (ih == 0) ? fw : -fw;
      fw = fq[0] - fw;
      for (i = 1; i <= jz; i++) fw += fq[i];
      y[1] = (ih == 0) ? fw : -fw;
      break;
    case 3:
      for (i = jz; i > 0; i--) {
        fw = fq[i - 1] + fq[i];
        fq[i] += fq[i - 1] - fw;
        fq[i - 1] = fw;
      }
      for (i = jz; i > 1; i--) {
        fw = fq[i - 1] + fq[i];
        fq[i] += fq[i - 1] - fw;
        fq[i - 1] = fw;
      }
      for (fw = 0.0, i = jz; i >= 2; i--) fw += fq[i];
      if (ih == 0) {
        y[0] = fq[0];
        y[1] = fq[1];
        y[2] = fw;
      } else {
        y[0] = -fq[0];
        y[1] = -fq[1];
        y[2] = -fw;
      }
  }
  return n & 7;
}

static int32_t __ieee754_rem_pio2(double x, double *y) {
  static const int32_t two_over_pi[] = {
      0xA2F983, 0x6E4E44, 0x1529FC, 0x2757D1, 0xF534DD, 0xC0DB62, 0x95993C,
      0x439041, 0xFE5163, 0xABDEBB, 0xC561B7, 0x246E3A, 0x424DD2, 0xE00649,
      0x2EEA09, 0xD1921C, 0xFE1DEB, 0x1CB129, 0xA73EE8, 0x8235F5, 0x2EBB44,
      0x84E99C, 0x7026B4, 0x5F7E41, 0x3991D6, 0x398353, 0x39F49C, 0x845F8B,
      0xBDF928, 0x3B1FF8, 0x97FFDE, 0x05980F, 0xEF2F11, 0x8B5A0A, 0x6D1F6D,
      0x367ECF, 0x27CB09, 0xB74F46, 0x3F669E, 0x5FEA2D, 0x7527BA, 0xC7EBE5,
      0xF17B3D, 0x0739F7, 0x8A5292, 0xEA6BFB, 0x5FB11F, 0x8D5D08, 0x560330,
      0x46FC7B, 0x6BABF0, 0xCFBC20, 0x9AF436, 0x1DA9E3, 0x91615E, 0xE61B08,
      0x659985, 0x5F14A0, 0x68408D, 0xFFD880, 0x4D7327, 0x310606, 0x1556CA,
      0x73A8C9, 0x60E27B, 0xC08C6B,
  };
  static const int32_t npio2_hw[] = {
      0x3FF921FB, 0x400921FB, 0x4012D97C, 0x401921FB, 0x401F6A7A, 0x4022D97C,
      0x4025FDBB, 0x402921FB, 0x402C463A, 0x402F6A7A, 0x4031475C, 0x4032D97C,
      0x40346B9C, 0x4035FDBB, 0x40378FDB, 0x403921FB, 0x403AB41B, 0x403C463A,
      0x403DD85A, 0x403F6A7A, 0x40407E4C, 0x4041475C, 0x4042106C, 0x4042D97C,
      0x4043A28C, 0x40446B9C, 0x404534AC, 0x4045FDBB, 0x4046C6CB, 0x40478FDB,
      0x404858EB, 0x404921FB,
  };
  static const double zero = 0.00000000000000000000e+00,
      half = 5.00000000000000000000e-01,    /* 0x3FE00000, 0x00000000 */
      two24 = 1.67772160000000000000e+07,   /* 0x41700000, 0x00000000 */
      invpio2 = 6.36619772367581382433e-01, /* 0x3FE45F30, 0x6DC9C883 */
      pio2_1 = 1.57079632673412561417e+00,  /* 0x3FF921FB, 0x54400000 */
      pio2_1t = 6.07710050650619224932e-11, /* 0x3DD0B461, 0x1A626331 */
      pio2_2 = 6.07710050630396597660e-11,  /* 0x3DD0B461, 0x1A600000 */
      pio2_2t = 2.02226624879595063154e-21, /* 0x3BA3198A, 0x2E037073 */
      pio2_3 = 2.02226624871116645580e-21,  /* 0x3BA3198A, 0x2E000000 */
      pio2_3t = 8.47842766036889956997e-32; /* 0x397B839A, 0x252049C1 */
  double z, w, t, r, fn;
  double tx[3];
  int32_t e0, i, j, nx, n, ix, hx;
  uint32_t low;

  z = 0;
  GET_HIGH_WORD(hx, x);
  ix = hx & 0x7FFFFFFF;
  if (ix <= 0x3FE921FB) {
    y[0] = x;
    y[1] = 0;
    return 0;
  }
  if (ix < 0x4002D97C) {
    if (hx > 0) {
      z = x - pio2_1;
      if (ix != 0x3FF921FB) {
        y[0] = z - pio2_1t;
        y[1] = (z - y[0]) - pio2_1t;
      } else {
        z -= pio2_2;
        y[0] = z - pio2_2t;
        y[1] = (z - y[0]) - pio2_2t;
      }
      return 1;
    } else {
      z = x + pio2_1;
      if (ix != 0x3FF921FB) {
        y[0] = z + pio2_1t;
        y[1] = (z - y[0]) + pio2_1t;
      } else {
        z += pio2_2;
        y[0] = z + pio2_2t;
        y[1] = (z - y[0]) + pio2_2t;
      }
      return -1;
    }
  }
  if (ix <= 0x413921FB) {
    t = fabs(x);
    n = (int32_t)(t * invpio2 + half);
    fn = (double)n;
    r = t - fn * pio2_1;
    w = fn * pio2_1t;
    if (n < 32 && ix != npio2_hw[n - 1]) {
      y[0] = r - w;
    } else {
      uint32_t high;
      j = ix >> 20;
      y[0] = r - w;
      GET_HIGH_WORD(high, y[0]);
      i = j - ((high >> 20) & 0x7FF);
      if (i > 16) {
        t = r;
        w = fn * pio2_2;
        r = t - w;
        w = fn * pio2_2t - ((t - r) - w);
        y[0] = r - w;
        GET_HIGH_WORD(high, y[0]);
        i = j - ((high >> 20) & 0x7FF);
        if (i > 49) {
          t = r;
          w = fn * pio2_3;
          r = t - w;
          w = fn * pio2_3t - ((t - r) - w);
          y[0] = r - w;
        }
      }
    }
    y[1] = (r - y[0]) - w;
    if (hx < 0) {
      y[0] = -y[0];
      y[1] = -y[1];
      return -n;
    } else {
      return n;
    }
  }
  if (ix >= 0x7FF00000) {
    y[0] = y[1] = x - x;
    return 0;
  }
  GET_LOW_WORD(low, x);
  SET_LOW_WORD(z, low);
  e0 = (ix >> 20) - 1046;
  SET_HIGH_WORD(z, ix - (int32_t)((uint32_t)e0 << 20));
  for (i = 0; i < 2; i++) {
    tx[i] = (double)((int32_t)(z));
    z = (z - tx[i]) * two24;
  }
  tx[2] = z;
  nx = 3;
  while (tx[nx - 1] == zero) nx--;
  n = __kernel_rem_pio2(tx, y, e0, nx, 2, two_over_pi);
  if (hx < 0) {
    y[0] = -y[0];
    y[1] = -y[1];
    return -n;
  }
  return n;
}

static double __kernel_cos(double x, double y) {
  static const double one = 1.00000000000000000000e+00,
      C1 = 4.16666666666666019037e-02,  /* 0x3FA55555, 0x5555554C */
      C2 = -1.38888888888741095749e-03, /* 0xBF56C16C, 0x16C15177 */
      C3 = 2.48015872894767294178e-05,  /* 0x3EFA01A0, 0x19CB1590 */
      C4 = -2.75573143513906633035e-07, /* 0xBE927E4F, 0x809C52AD */
      C5 = 2.08757232129817482790e-09,  /* 0x3E21EE9E, 0xBDB4B1C4 */
      C6 = -1.13596475577881948265e-11; /* 0xBDA8FAE9, 0xBE8838D4 */
  double a, iz, z, r, qx;
  int32_t ix;
  GET_HIGH_WORD(ix, x);
  ix &= 0x7FFFFFFF;
  if (ix < 0x3E400000) {
    if ((int)x == 0) return one;
  }
  z = x * x;
  r = z * (C1 + z * (C2 + z * (C3 + z * (C4 + z * (C5 + z * C6)))));
  if (ix < 0x3FD33333) {
    return one - (0.5 * z - (z * r - x * y));
  } else {
    if (ix > 0x3FE90000) {
      qx = 0.28125;
    } else {
      INSERT_WORDS(qx, ix - 0x00200000, 0);
    }
    iz = 0.5 * z - qx;
    a = one - qx;
    return a - (iz - (z * r - x * y));
  }
}

static double __kernel_sin(double x, double y, int iy) {
  static const double half = 5.00000000000000000000e-01,
      S1 = -1.66666666666666324348e-01, /* 0xBFC55555, 0x55555549 */
      S2 = 8.33333333332248946124e-03,  /* 0x3F811111, 0x1110F8A6 */
      S3 = -1.98412698298579493134e-04, /* 0xBF2A01A0, 0x19C161D5 */
      S4 = 2.75573137070700676789e-06,  /* 0x3EC71DE3, 0x57B1FE7D */
      S5 = -2.50507602534068634195e-08, /* 0xBE5AE5E6, 0x8A2B9CEB */
      S6 = 1.58969099521155010221e-10;  /* 0x3DE5D93A, 0x5ACFD57C */
  double z, r, v;
  int32_t ix;
  GET_HIGH_WORD(ix, x);
  ix &= 0x7FFFFFFF;
  if (ix < 0x3E400000) {
    if ((int)x == 0) return x;
  }
  z = x * x;
  v = z * x;
  r = S2 + z * (S3 + z * (S4 + z * (S5 + z * S6)));
  if (iy == 0) {
    return x + v * (S1 + z * r);
  } else {
    return x - ((z * (half * y - v * r) - y) - v * S1);
  }
}

static double v8_sin(double x) {
  double y[2], z = 0.0;
  int32_t n, ix;
  GET_HIGH_WORD(ix, x);
  ix &= 0x7FFFFFFF;
  if (ix <= 0x3FE921FB) {
    return __kernel_sin(x, z, 0);
  } else if (ix >= 0x7FF00000) {
    return x - x;
  } else {
    n = __ieee754_rem_pio2(x, y);
    switch (n & 3) {
      case 0: return __kernel_sin(y[0], y[1], 1);
      case 1: return __kernel_cos(y[0], y[1]);
      case 2: return -__kernel_sin(y[0], y[1], 1);
      default: return -__kernel_cos(y[0], y[1]);
    }
  }
}

static double v8_cos(double x) {
  double y[2], z = 0.0;
  int32_t n, ix;
  GET_HIGH_WORD(ix, x);
  ix &= 0x7FFFFFFF;
  if (ix <= 0x3FE921FB) {
    return __kernel_cos(x, z);
  } else if (ix >= 0x7FF00000) {
    return x - x;
  } else {
    n = __ieee754_rem_pio2(x, y);
    switch (n & 3) {
      case 0: return __kernel_cos(y[0], y[1]);
      case 1: return -__kernel_sin(y[0], y[1], 1);
      case 2: return -__kernel_cos(y[0], y[1]);
      default: return __kernel_sin(y[0], y[1], 1);
    }
  }
}

static double v8_atan(double x) {
  static const double atanhi[] = {
      4.63647609000806093515e-01, /* atan(0.5)hi 0x3FDDAC67, 0x0561BB4F */
      7.85398163397448278999e-01, /* atan(1.0)hi 0x3FE921FB, 0x54442D18 */
      9.82793723247329054082e-01, /* atan(1.5)hi 0x3FEF730B, 0xD281F69B */
      1.57079632679489655800e+00, /* atan(inf)hi 0x3FF921FB, 0x54442D18 */
  };
  static const double atanlo[] = {
      2.26987774529616870924e-17, /* atan(0.5)lo 0x3C7A2B7F, 0x222F65E2 */
      3.06161699786838301793e-17, /* atan(1.0)lo 0x3C81A626, 0x33145C07 */
      1.39033110312309984516e-17, /* atan(1.5)lo 0x3C700788, 0x7AF0CBBD */
      6.12323399573676603587e-17, /* atan(inf)lo 0x3C91A626, 0x33145C07 */
  };
  static const double aT[] = {
      3.33333333333329318027e-01,  /* 0x3FD55555, 0x5555550D */
      -1.99999999998764832476e-01, /* 0xBFC99999, 0x9998EBC4 */
      1.42857142725034663711e-01,  /* 0x3FC24924, 0x920083FF */
      -1.11111104054623557880e-01, /* 0xBFBC71C6, 0xFE231671 */
      9.09088713343650656196e-02,  /* 0x3FB745CD, 0xC54C206E */
      -7.69187620504482999495e-02, /* 0xBFB3B0F2, 0xAF749A6D */
      6.66107313738753120669e-02,  /* 0x3FB10D66, 0xA0D03D51 */
      -5.83357013379057348645e-02, /* 0xBFADDE2D, 0x52DEFD9A */
      4.97687799461593236017e-02,  /* 0x3FA97B4B, 0x24760DEB */
      -3.65315727442169155270e-02, /* 0xBFA2B444, 0x2C6A6C2F */
      1.62858201153657823623e-02,  /* 0x3F90AD3A, 0xE322DA11 */
  };
  static const double one = 1.0, huge = 1.0e300;
  double w, s1, s2, z;
  int32_t ix, hx, id;

  GET_HIGH_WORD(hx, x);
  ix = hx & 0x7FFFFFFF;
  if (ix >= 0x44100000) {
    uint32_t low;
    GET_LOW_WORD(low, x);
    if (ix > 0x7FF00000 || (ix == 0x7FF00000 && (low != 0))) return x + x;
    if (hx > 0)
      return atanhi[3] + *(volatile const double *)&atanlo[3];
    else
      return -atanhi[3] - *(volatile const double *)&atanlo[3];
  }
  if (ix < 0x3FDC0000) {
    if (ix < 0x3E400000) {
      if (huge + x > one) return x;
    }
    id = -1;
  } else {
    x = fabs(x);
    if (ix < 0x3FF30000) {
      if (ix < 0x3FE60000) {
        id = 0;
        x = (2.0 * x - one) / (2.0 + x);
      } else {
        id = 1;
        x = (x - one) / (x + one);
      }
    } else {
      if (ix < 0x40038000) {
        id = 2;
        x = (x - 1.5) / (one + 1.5 * x);
      } else {
        id = 3;
        x = -1.0 / x;
      }
    }
  }
  z = x * x;
  w = z * z;
  s1 = z * (aT[0] + w * (aT[2] + w * (aT[4] + w * (aT[6] + w * (aT[8] + w * aT[10])))));
  s2 = w * (aT[1] + w * (aT[3] + w * (aT[5] + w * (aT[7] + w * aT[9]))));
  if (id < 0) {
    return x - x * (s1 + s2);
  } else {
    z = atanhi[id] - ((x * (s1 + s2) - atanlo[id]) - x);
    return (hx < 0) ? -z : z;
  }
}

static double v8_atan2(double y, double x) {
  static volatile double tiny = 1.0e-300;
  static const double zero = 0.0,
      pi_o_4 = 7.8539816339744827900E-01, /* 0x3FE921FB, 0x54442D18 */
      pi_o_2 = 1.5707963267948965580E+00, /* 0x3FF921FB, 0x54442D18 */
      pi = 3.1415926535897931160E+00,     /* 0x400921FB, 0x54442D18 */
      pi_lo = 1.2246467991473531772E-16;  /* 0x3CA1A626, 0x33145C07 */
  double z;
  int32_t k, m, hx, hy, ix, iy;
  uint32_t lx, ly;

  EXTRACT_WORDS(hx, lx, x);
  ix = hx & 0x7FFFFFFF;
  EXTRACT_WORDS(hy, ly, y);
  iy = hy & 0x7FFFFFFF;
  if (((ix | ((lx | (0u - lx)) >> 31)) > 0x7FF00000) || ((iy | ((ly | (0u - ly)) >> 31)) > 0x7FF00000)) {
    return x + y;
  }
  if ((((uint32_t)hx - 0x3FF00000u) | lx) == 0) return v8_atan(y);
  m = ((hy >> 31) & 1) | ((hx >> 30) & 2);
  if ((iy | ly) == 0) {
    switch (m) {
      case 0:
      case 1: return y;
      case 2: return pi + tiny;
      case 3: return -pi - tiny;
    }
  }
  if ((ix | lx) == 0) return (hy < 0) ? -pi_o_2 - tiny : pi_o_2 + tiny;
  if (ix == 0x7FF00000) {
    if (iy == 0x7FF00000) {
      switch (m) {
        case 0: return pi_o_4 + tiny;
        case 1: return -pi_o_4 - tiny;
        case 2: return 3.0 * pi_o_4 + tiny;
        case 3: return -3.0 * pi_o_4 - tiny;
      }
    } else {
      switch (m) {
        case 0: return zero;
        case 1: return -zero;
        case 2: return pi + tiny;
        case 3: return -pi - tiny;
      }
    }
  }
  if (iy == 0x7FF00000) return (hy < 0) ? -pi_o_2 - tiny : pi_o_2 + tiny;
  k = (iy - ix) >> 20;
  if (k > 60) {
    z = pi_o_2 + 0.5 * pi_lo;
    m &= 1;
  } else if (hx < 0 && k < -60) {
    z = 0.0;
  } else {
    z = v8_atan(fabs(y / x));
  }
  switch (m) {
    case 0: return z;
    case 1: return -z;
    case 2: return pi - (z - pi_lo);
    default: return (z - pi_lo) - pi;
  }
}

static double from_bits(unsigned long long b) { double d; memcpy(&d, &b, 8); return d; }
static unsigned long long to_bits(double d) { unsigned long long b; memcpy(&b, &d, 8); return b; }

int main(void) {
  char fn[8];
  unsigned long long a, b;
  while (scanf("%7s %llx", fn, &a) == 2) {
    double x = from_bits(a), r;
    if (!strcmp(fn, "atan2")) {
      if (scanf("%llx", &b) != 1) return 2;
      r = v8_atan2(x, from_bits(b));
    } else if (!strcmp(fn, "rem")) {
      double y[2];
      int n = __ieee754_rem_pio2(x, y);
      printf("%d %016llx %016llx\n", n, to_bits(y[0]), to_bits(y[1]));
      continue;
    } else if (!strcmp(fn, "sin")) {
      r = v8_sin(x);
    } else if (!strcmp(fn, "cos")) {
      r = v8_cos(x);
    } else if (!strcmp(fn, "atan")) {
      r = v8_atan(x);
    } else {
      return 3;
    }
    printf("%016llx\n", to_bits(r));
  }
  return 0;
}
