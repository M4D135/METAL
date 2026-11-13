// PNG encoder/decoder and RGBA8 image helpers for the render tools (lot 00 / R1).
// Pure Node, no dependency. Outside npm test and outside the game's size budget.
//
// An image is {width, height, data}: data holds width*height*4 bytes, RGBA8,
// rows from top to bottom (the order of PNG files and of Canvas 2D ImageData).
// WebGL readPixels returns rows from bottom to top: flip them with flipRows(),
// or let chrome.mjs page.image() do it.
import zlib from 'node:zlib';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {createHash} from 'node:crypto';

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const MAX_PIXELS = 1 << 27; // 134 M pixels: far above a 4K frame, below an absurd allocation.
const FILTERS = {none: 0, sub: 1, up: 2, average: 3, paeth: 4};
const CHANNELS = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4};

let crcTable = null;
export function crc32(bytes) {
  if (typeof zlib.crc32 === 'function') return zlib.crc32(bytes) >>> 0;
  if (!crcTable) {
    crcTable = new Int32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c; }
  }
  let c = -1;
  for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

const asBuffer = bytes => Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);

export function checkImage(image, label = 'image') {
  if (!image || typeof image !== 'object') throw new TypeError(`${label}: expected {width, height, data}`);
  const {width, height, data} = image;
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || width * height > MAX_PIXELS)
    throw new RangeError(`${label}: invalid size ${width}x${height}`);
  if (!(data instanceof Uint8Array || data instanceof Uint8ClampedArray)) throw new TypeError(`${label}: data must be a Uint8Array, Uint8ClampedArray or Buffer`);
  if (data.length !== width * height * 4) throw new RangeError(`${label}: ${data.length} bytes for ${width}x${height} RGBA8 (expected ${width * height * 4})`);
  return image;
}

export function createImage(width, height, rgba = [0, 0, 0, 255]) {
  const image = {width, height, data: Buffer.alloc(width * height * 4)};
  checkImage(image);
  for (let i = 0; i < image.data.length; i += 4) image.data.set(rgba, i);
  return image;
}

export function cloneImage(image) {
  checkImage(image);
  return {width: image.width, height: image.height, data: Buffer.from(asBuffer(image.data))};
}

// Reverses the row order (bottom-up readPixels output <-> top-down image). Returns a new Buffer.
export function flipRows(data, width, height) {
  const stride = width * 4, out = Buffer.allocUnsafe(data.length);
  if (data.length !== stride * height) throw new RangeError(`flipRows: ${data.length} bytes for ${width}x${height}`);
  const source = asBuffer(data);
  for (let y = 0; y < height; y++) source.copy(out, y * stride, (height - 1 - y) * stride, (height - y) * stride);
  return out;
}

// SHA-256 of the pixel bytes only (RGBA8, top-down). Report width and height alongside it.
export function imageSha256(image) {
  checkImage(image);
  return createHash('sha256').update(asBuffer(image.data)).digest('hex');
}

function paeth(a, b, c) {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function filterRow(type, row, prev, out, bpp) {
  for (let i = 0; i < row.length; i++) {
    const x = row[i], a = i >= bpp ? row[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
    out[i] = (type === 0 ? x : type === 1 ? x - a : type === 2 ? x - b : type === 3 ? x - ((a + b) >> 1) : x - paeth(a, b, c)) & 255;
  }
}

function unfilterRow(type, line, prev, out, bpp) {
  for (let i = 0; i < line.length; i++) {
    const a = i >= bpp ? out[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
    let v;
    switch (type) {
      case 0: v = line[i]; break;
      case 1: v = line[i] + a; break;
      case 2: v = line[i] + b; break;
      case 3: v = line[i] + ((a + b) >> 1); break;
      case 4: v = line[i] + paeth(a, b, c); break;
      default: throw new Error(`PNG: unknown row filter ${type}`);
    }
    out[i] = v & 255;
  }
}

function chunk(type, body) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(type, 4, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
  return Buffer.concat([head, body, crc]);
}

// Encodes an RGBA8 image as a non-interlaced 8-bit RGBA PNG without colour chunks
// (no gAMA, iCCP or sRGB: readers keep the bytes as they are).
// filter: 'adaptive' (per row, smallest sum of absolute values) or one of none|sub|up|average|paeth.
// The output is deterministic for a given zlib; compare pixels, not PNG files.
export function encodePNG(image, {filter = 'adaptive', level = 9} = {}) {
  checkImage(image);
  const {width, height} = image, data = asBuffer(image.data), stride = width * 4;
  const types = filter === 'adaptive' ? [0, 1, 2, 3, 4] : [FILTERS[filter]];
  if (types[0] === undefined) throw new Error(`PNG: unknown filter ${filter}`);
  const raw = Buffer.alloc((stride + 1) * height), zero = Buffer.alloc(stride), scratch = types.map(() => Buffer.alloc(stride));
  for (let y = 0; y < height; y++) {
    const row = data.subarray(y * stride, (y + 1) * stride), prev = y ? data.subarray((y - 1) * stride, y * stride) : zero;
    let best = 0, bestScore = Infinity;
    for (let k = 0; k < types.length; k++) {
      filterRow(types[k], row, prev, scratch[k], 4);
      if (types.length === 1) break;
      let score = 0;
      for (let i = 0; i < stride; i++) { const v = scratch[k][i]; score += v < 128 ? v : 256 - v; }
      if (score < bestScore) { bestScore = score; best = k; }
    }
    raw[y * (stride + 1)] = types[best];
    scratch[best].copy(raw, y * (stride + 1) + 1);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA; compression, filter method and interlace stay 0
  return Buffer.concat([SIGNATURE, chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(raw, {level})), chunk('IEND', Buffer.alloc(0))]);
}

// Decodes a non-interlaced 8-bit PNG (grey, grey+alpha, RGB, RGBA or palette, with tRNS)
// into an RGBA8 image. Every chunk CRC is checked. Anything else fails with an explicit error.
export function decodePNG(bytes) {
  const buf = asBuffer(bytes);
  if (buf.length < 8 || !buf.subarray(0, 8).equals(SIGNATURE)) throw new Error('PNG: invalid signature');
  let offset = 8, header = null, palette = null, transparency = null, ended = false;
  const idat = [];
  while (offset < buf.length) {
    if (offset + 12 > buf.length) throw new Error('PNG: truncated chunk header');
    const length = buf.readUInt32BE(offset), type = buf.toString('latin1', offset + 4, offset + 8), end = offset + 12 + length;
    if (end > buf.length) throw new Error(`PNG: truncated ${type} chunk`);
    const body = buf.subarray(offset + 8, offset + 8 + length);
    if (crc32(buf.subarray(offset + 4, offset + 8 + length)) !== buf.readUInt32BE(offset + 8 + length)) throw new Error(`PNG: CRC mismatch in ${type}`);
    if (type === 'IHDR') {
      if (length !== 13 || header) throw new Error('PNG: invalid IHDR');
      header = {width: body.readUInt32BE(0), height: body.readUInt32BE(4), bitDepth: body[8], colorType: body[9], compression: body[10], filter: body[11], interlace: body[12]};
    } else if (!header) throw new Error('PNG: IHDR must come first');
    else if (type === 'PLTE') palette = body;
    else if (type === 'tRNS') transparency = body;
    else if (type === 'IDAT') idat.push(body);
    else if (type === 'IEND') { ended = true; break; }
    else if (type.charCodeAt(0) < 97) throw new Error(`PNG: unsupported critical chunk ${type}`);
    offset = end;
  }
  if (!header) throw new Error('PNG: missing IHDR');
  if (!ended) throw new Error('PNG: missing IEND');
  if (!idat.length) throw new Error('PNG: missing IDAT');
  const {width, height, bitDepth, colorType} = header, channels = CHANNELS[colorType];
  if (!width || !height || width * height > MAX_PIXELS) throw new Error(`PNG: invalid size ${width}x${height}`);
  if (header.compression !== 0 || header.filter !== 0) throw new Error('PNG: unknown compression or filter method');
  if (header.interlace !== 0) throw new Error('PNG: interlaced images are not supported');
  if (!channels) throw new Error(`PNG: unknown colour type ${colorType}`);
  if (bitDepth !== 8) throw new Error(`PNG: bit depth ${bitDepth} is not supported (8 only)`);
  if (colorType === 3 && (!palette || palette.length % 3)) throw new Error('PNG: missing or invalid palette');
  const stride = width * channels, raw = zlib.inflateSync(Buffer.concat(idat));
  if (raw.length !== (stride + 1) * height) throw new Error(`PNG: ${raw.length} decompressed bytes, expected ${(stride + 1) * height}`);
  const samples = Buffer.alloc(stride * height);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const out = samples.subarray(y * stride, (y + 1) * stride);
    unfilterRow(raw[y * (stride + 1)], raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), prev, out, channels);
    prev = out;
  }
  const n = width * height, data = Buffer.alloc(n * 4);
  const key = transparency && (colorType === 0 && transparency.length >= 2 ? [transparency.readUInt16BE(0)]
    : colorType === 2 && transparency.length >= 6 ? [transparency.readUInt16BE(0), transparency.readUInt16BE(2), transparency.readUInt16BE(4)] : null);
  for (let p = 0; p < n; p++) {
    const s = p * channels, d = p * 4;
    if (colorType === 6) samples.copy(data, d, s, s + 4);
    else if (colorType === 2) { data[d] = samples[s]; data[d + 1] = samples[s + 1]; data[d + 2] = samples[s + 2]; data[d + 3] = key && key[0] === samples[s] && key[1] === samples[s + 1] && key[2] === samples[s + 2] ? 0 : 255; }
    else if (colorType === 0) { data[d] = data[d + 1] = data[d + 2] = samples[s]; data[d + 3] = key && key[0] === samples[s] ? 0 : 255; }
    else if (colorType === 4) { data[d] = data[d + 1] = data[d + 2] = samples[s]; data[d + 3] = samples[s + 1]; }
    else {
      const index = samples[s];
      if (index * 3 + 2 >= palette.length) throw new Error(`PNG: palette index ${index} out of range`);
      data[d] = palette[index * 3]; data[d + 1] = palette[index * 3 + 1]; data[d + 2] = palette[index * 3 + 2];
      data[d + 3] = transparency && index < transparency.length ? transparency[index] : 255;
    }
  }
  return {width, height, data};
}

export function writePNG(path, image, options) {
  const file = resolve(path);
  mkdirSync(dirname(file), {recursive: true});
  writeFileSync(file, encodePNG(image, options));
  return file;
}

export function readPNG(path) {
  return decodePNG(readFileSync(path));
}
