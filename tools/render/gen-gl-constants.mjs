// Lot 00 / R2: records the WebGL2 constants, limits, initial state, extensions and
// renderable formats of the local Chrome (R1 launcher, file:// only, no port) and
// writes tools/render/gl-constants.mjs, the numeric table of the Node fake WebGL2.
//
//   node tools/render/gen-gl-constants.mjs                 rewrite gl-constants.mjs
//   node tools/render/gen-gl-constants.mjs --check         exit 1 if the capture differs
//   node tools/render/gen-gl-constants.mjs --out F.mjs     write elsewhere (david-pc, other GPU)
//   options: --chrome-path P, --angle metal|d3d11|none
//
// The capture runs on about:blank in a throw-away profile. Only values that do not
// change between two runs are written (no date, no timer value), so that --check is
// a reproducibility test.
import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {withChrome} from './chrome.mjs';

export const DEFAULT_OUT = fileURLToPath(new URL('./gl-constants.mjs', import.meta.url));

// Implementation parameters (limits, strings, ranges): constant for a given GPU and
// browser. Every other valid getParameter name is context state (INITIAL_STATE).
export const IMPLEMENTATION_PARAMETER = /^(MAX_|MIN_PROGRAM_TEXEL_OFFSET$|ALIASED_|SUBPIXEL_BITS$|VENDOR$|RENDERER$|VERSION$|SHADING_LANGUAGE_VERSION$|COMPRESSED_TEXTURE_FORMATS$|UNIFORM_BUFFER_OFFSET_ALIGNMENT$)/;
// Parameters of the bound draw or read framebuffer, captured per context attributes.
export const FRAMEBUFFER_PARAMETER = /^((RED|GREEN|BLUE|ALPHA|DEPTH|STENCIL)_BITS|SAMPLES|SAMPLE_BUFFERS|IMPLEMENTATION_COLOR_READ_(FORMAT|TYPE))$/;

export const ATTRIBUTE_SETS = Object.freeze([
  {},
  {alpha: false, antialias: false, depth: true, powerPreference: 'high-performance'},
  {alpha: false, antialias: false, depth: true, stencil: true},
  {antialias: false},
  {depth: false, antialias: false},
  {premultipliedAlpha: false, preserveDrawingBuffer: true},
]);

export const SIZED_FORMATS = Object.freeze([
  'R8', 'R8_SNORM', 'R16F', 'R32F', 'R8UI', 'R8I', 'R16UI', 'R16I', 'R32UI', 'R32I',
  'RG8', 'RG8_SNORM', 'RG16F', 'RG32F', 'RG8UI', 'RG8I', 'RG16UI', 'RG16I', 'RG32UI', 'RG32I',
  'RGB8', 'SRGB8', 'RGB565', 'RGB8_SNORM', 'R11F_G11F_B10F', 'RGB9_E5', 'RGB16F', 'RGB32F',
  'RGB8UI', 'RGB8I', 'RGB16UI', 'RGB16I', 'RGB32UI', 'RGB32I',
  'RGBA8', 'SRGB8_ALPHA8', 'RGBA8_SNORM', 'RGB5_A1', 'RGBA4', 'RGB10_A2', 'RGBA16F', 'RGBA32F',
  'RGBA8UI', 'RGBA8I', 'RGB10_A2UI', 'RGBA16UI', 'RGBA16I', 'RGBA32I', 'RGBA32UI',
  'DEPTH_COMPONENT16', 'DEPTH_COMPONENT24', 'DEPTH_COMPONENT32F', 'DEPTH24_STENCIL8', 'DEPTH32F_STENCIL8', 'STENCIL_INDEX8',
]);

// Runs in the page. Must not reference anything outside its own body.
function capturePage(attributeSets, sizedFormats, implementationSource, framebufferSource) {
  const IMPLEMENTATION = new RegExp(implementationSource), FRAMEBUFFER = new RegExp(framebufferSource);
  const encode = v => {
    if (v === null || v === undefined || typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') return v ?? null;
    if (ArrayBuffer.isView(v)) return {$type: v.constructor.name, values: Array.from(v)};
    if (Array.isArray(v)) return v.map(encode);
    return {$object: Object.prototype.toString.call(v).slice(8, -1)};
  };
  const proto = WebGL2RenderingContext.prototype, constants = {}, methods = [], attributes = [];
  for (const key of Object.getOwnPropertyNames(proto).sort()) {
    const d = Object.getOwnPropertyDescriptor(proto, key);
    if ('value' in d) { if (typeof d.value === 'number') constants[key] = d.value; else if (typeof d.value === 'function' && key !== 'constructor') methods.push(key); }
    else if (d.get) attributes.push(key);
  }
  const names = Object.keys(constants).sort();
  const parameters = (gl, list) => {
    const out = {};
    while (gl.getError()) {}
    for (const name of list) {
      const value = gl.getParameter(gl[name]);
      if (gl.getError() === 0) out[name] = encode(value);
    }
    return out;
  };
  const canvas = () => document.createElement('canvas');
  // Fresh core context: no extension enabled, default attributes, default 300x150 canvas.
  const glA = canvas().getContext('webgl2');
  const all = parameters(glA, names), implementation = {}, initialState = {}, framebuffer = {};
  for (const [name, value] of Object.entries(all)) {
    if (FRAMEBUFFER.test(name)) framebuffer[name] = value;
    else if (IMPLEMENTATION.test(name)) implementation[name] = value;
    else initialState[name] = value;
  }
  const precision = {};
  for (const shader of ['VERTEX_SHADER', 'FRAGMENT_SHADER']) {
    precision[shader] = {};
    for (const kind of ['LOW_FLOAT', 'MEDIUM_FLOAT', 'HIGH_FLOAT', 'LOW_INT', 'MEDIUM_INT', 'HIGH_INT']) {
      const f = glA.getShaderPrecisionFormat(glA[shader], glA[kind]);
      precision[shader][kind] = [f.rangeMin, f.rangeMax, f.precision];
    }
  }
  // Object parameter defaults.
  const objectDefaults = {texture: {}, sampler: {}, buffer: {}, renderbuffer: {}, vertexAttrib: {}, program: {}, shader: {}, query: {}};
  {
    const gl = glA, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    for (const name of ['TEXTURE_MIN_FILTER', 'TEXTURE_MAG_FILTER', 'TEXTURE_WRAP_S', 'TEXTURE_WRAP_T', 'TEXTURE_WRAP_R', 'TEXTURE_COMPARE_MODE', 'TEXTURE_COMPARE_FUNC', 'TEXTURE_BASE_LEVEL', 'TEXTURE_MAX_LEVEL', 'TEXTURE_MIN_LOD', 'TEXTURE_MAX_LOD', 'TEXTURE_IMMUTABLE_FORMAT', 'TEXTURE_IMMUTABLE_LEVELS'])
      objectDefaults.texture[name] = encode(gl.getTexParameter(gl.TEXTURE_2D, gl[name]));
    gl.bindTexture(gl.TEXTURE_2D, null); gl.deleteTexture(t);
    const s = gl.createSampler();
    for (const name of ['TEXTURE_MIN_FILTER', 'TEXTURE_MAG_FILTER', 'TEXTURE_WRAP_S', 'TEXTURE_WRAP_T', 'TEXTURE_WRAP_R', 'TEXTURE_COMPARE_MODE', 'TEXTURE_COMPARE_FUNC', 'TEXTURE_MIN_LOD', 'TEXTURE_MAX_LOD'])
      objectDefaults.sampler[name] = encode(gl.getSamplerParameter(s, gl[name]));
    gl.deleteSampler(s);
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    for (const name of ['BUFFER_SIZE', 'BUFFER_USAGE']) objectDefaults.buffer[name] = encode(gl.getBufferParameter(gl.ARRAY_BUFFER, gl[name]));
    gl.bindBuffer(gl.ARRAY_BUFFER, null); gl.deleteBuffer(b);
    const r = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, r);
    for (const name of ['RENDERBUFFER_WIDTH', 'RENDERBUFFER_HEIGHT', 'RENDERBUFFER_INTERNAL_FORMAT', 'RENDERBUFFER_RED_SIZE', 'RENDERBUFFER_GREEN_SIZE', 'RENDERBUFFER_BLUE_SIZE', 'RENDERBUFFER_ALPHA_SIZE', 'RENDERBUFFER_DEPTH_SIZE', 'RENDERBUFFER_STENCIL_SIZE', 'RENDERBUFFER_SAMPLES'])
      objectDefaults.renderbuffer[name] = encode(gl.getRenderbufferParameter(gl.RENDERBUFFER, gl[name]));
    gl.bindRenderbuffer(gl.RENDERBUFFER, null); gl.deleteRenderbuffer(r);
    for (const name of ['VERTEX_ATTRIB_ARRAY_BUFFER_BINDING', 'VERTEX_ATTRIB_ARRAY_ENABLED', 'VERTEX_ATTRIB_ARRAY_SIZE', 'VERTEX_ATTRIB_ARRAY_STRIDE', 'VERTEX_ATTRIB_ARRAY_TYPE', 'VERTEX_ATTRIB_ARRAY_NORMALIZED', 'VERTEX_ATTRIB_ARRAY_INTEGER', 'VERTEX_ATTRIB_ARRAY_DIVISOR', 'CURRENT_VERTEX_ATTRIB'])
      objectDefaults.vertexAttrib[name] = encode(gl.getVertexAttrib(0, gl[name]));
    objectDefaults.vertexAttrib.VERTEX_ATTRIB_ARRAY_POINTER = gl.getVertexAttribOffset(0, gl.VERTEX_ATTRIB_ARRAY_POINTER);
    const vs = gl.createShader(gl.VERTEX_SHADER), fs = gl.createShader(gl.FRAGMENT_SHADER), p = gl.createProgram();
    for (const name of ['SHADER_TYPE', 'DELETE_STATUS', 'COMPILE_STATUS']) objectDefaults.shader[name] = encode(gl.getShaderParameter(vs, gl[name]));
    objectDefaults.shader.infoLog = gl.getShaderInfoLog(vs);
    for (const name of ['DELETE_STATUS', 'LINK_STATUS', 'VALIDATE_STATUS', 'ATTACHED_SHADERS', 'ACTIVE_ATTRIBUTES', 'ACTIVE_UNIFORMS', 'TRANSFORM_FEEDBACK_BUFFER_MODE', 'TRANSFORM_FEEDBACK_VARYINGS', 'ACTIVE_UNIFORM_BLOCKS'])
      objectDefaults.program[name] = encode(gl.getProgramParameter(p, gl[name]));
    objectDefaults.program.infoLog = gl.getProgramInfoLog(p);
    gl.deleteShader(vs); gl.deleteShader(fs); gl.deleteProgram(p);
    while (gl.getError()) {}
  }
  // Default framebuffer per set of requested context attributes.
  const defaultFramebuffers = attributeSets.map(requested => {
    const gl = canvas().getContext('webgl2', requested);
    const bits = {};
    for (const name of Object.keys(framebuffer)) { const v = gl.getParameter(gl[name]); if (gl.getError() === 0) bits[name] = encode(v); }
    return {requested, granted: gl.getContextAttributes(), parameters: bits,
      drawingBufferColorSpace: gl.drawingBufferColorSpace ?? null, unpackColorSpace: gl.unpackColorSpace ?? null};
  });
  // Every supported extension, enabled in a second context.
  const glB = canvas().getContext('webgl2'), supported = glB.getSupportedExtensions(), extensions = {};
  for (const name of supported) {
    const ext = glB.getExtension(name), c = {}, m = [];
    for (const key in ext) { const v = ext[key]; if (typeof v === 'number') c[key] = v; else if (typeof v === 'function') m.push(key); }
    const sorted = {};
    for (const key of Object.keys(c).sort()) sorted[key] = c[key];
    extensions[name] = {constants: sorted, methods: m.sort(), parameters: {}};
  }
  while (glB.getError()) {}
  const dynamic = new Set(['TIMESTAMP_EXT']);
  for (const [name, info] of Object.entries(extensions)) {
    for (const [key, value] of Object.entries(info.constants)) {
      if (dynamic.has(key)) continue;
      const v = glB.getParameter(value);
      if (glB.getError() === 0) info.parameters[key] = encode(v);
      if (key === 'DEPTH_CLAMP_EXT') { info.parameters['isEnabled:' + key] = glB.isEnabled(value); while (glB.getError()) {} }
    }
  }
  const timer = extensions.EXT_disjoint_timer_query_webgl2;
  if (timer) {
    const ext = glB.getExtension('EXT_disjoint_timer_query_webgl2');
    timer.queryCounterBits = {TIME_ELAPSED_EXT: glB.getQuery(ext.TIME_ELAPSED_EXT, ext.QUERY_COUNTER_BITS_EXT), TIMESTAMP_EXT: glB.getQuery(ext.TIMESTAMP_EXT, ext.QUERY_COUNTER_BITS_EXT)};
    while (glB.getError()) {}
  }
  // Renderable sized formats: texture and renderbuffer attachments, core and with extensions.
  const formatProbe = gl => {
    const out = {};
    const statusName = s => Object.keys(constants).find(k => constants[k] === s && /^FRAMEBUFFER_/.test(k)) || s;
    for (const name of sizedFormats) {
      const format = gl[name], depth = /^DEPTH|^STENCIL/.test(name), stencil = /STENCIL/.test(name), onlyStencil = name === 'STENCIL_INDEX8';
      const point = onlyStencil ? gl.STENCIL_ATTACHMENT : depth && stencil ? gl.DEPTH_STENCIL_ATTACHMENT : depth ? gl.DEPTH_ATTACHMENT : gl.COLOR_ATTACHMENT0;
      const entry = {};
      while (gl.getError()) {}
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      if (!onlyStencil) {
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texStorage2D(gl.TEXTURE_2D, 1, format, 4, 4);
        const e = gl.getError();
        entry.texStorage = e === 0 ? 'ok' : e;
        if (e === 0) { gl.framebufferTexture2D(gl.FRAMEBUFFER, point, gl.TEXTURE_2D, t, 0); entry.texture = statusName(gl.checkFramebufferStatus(gl.FRAMEBUFFER)); gl.framebufferTexture2D(gl.FRAMEBUFFER, point, gl.TEXTURE_2D, null, 0); }
        gl.bindTexture(gl.TEXTURE_2D, null); gl.deleteTexture(t);
      }
      while (gl.getError()) {}
      const r = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, r);
      gl.renderbufferStorage(gl.RENDERBUFFER, format, 4, 4);
      const e = gl.getError();
      entry.renderbufferStorage = e === 0 ? 'ok' : e;
      if (e === 0) {
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, point, gl.RENDERBUFFER, r);
        entry.renderbuffer = statusName(gl.checkFramebufferStatus(gl.FRAMEBUFFER));
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, point, gl.RENDERBUFFER, null);
        const samples = gl.getInternalformatParameter(gl.RENDERBUFFER, format, gl.SAMPLES);
        entry.samples = samples ? Array.from(samples) : null;
      }
      while (gl.getError()) {}
      gl.bindRenderbuffer(gl.RENDERBUFFER, null); gl.deleteRenderbuffer(r);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(fb);
      out[name] = entry;
    }
    return out;
  };
  const formats = {core: formatProbe(glA), withExtensions: formatProbe(glB)};
  const debug = glB.getExtension('WEBGL_debug_renderer_info');
  return {
    userAgent: navigator.userAgent, platform: navigator.platform,
    unmaskedVendor: debug ? glB.getParameter(debug.UNMASKED_VENDOR_WEBGL) : null,
    unmaskedRenderer: debug ? glB.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null,
    constants, methods, attributes, implementation, initialState, framebufferParameters: framebuffer,
    precision, objectDefaults, defaultFramebuffers, supportedExtensions: supported, extensions, formats,
  };
}

const json = value => JSON.stringify(value);
function block(name, value, comment) {
  const lines = [`// ${comment}`];
  if (value && typeof value === 'object' && !Array.isArray(value) && Object.values(value).every(v => typeof v === 'number')) {
    lines.push(`export const ${name} = Object.freeze({`);
    for (const [k, v] of Object.entries(value)) lines.push(`  ${k}: ${v},`);
    lines.push('});');
  } else if (value && typeof value === 'object' && !Array.isArray(value)) {
    lines.push(`export const ${name} = deepFreeze({`);
    for (const [k, v] of Object.entries(value)) lines.push(`  ${/^[A-Za-z_$][\w$]*$/.test(k) ? k : json(k)}: ${json(v)},`);
    lines.push('});');
  } else lines.push(`export const ${name} = deepFreeze(${json(value)});`);
  return lines.join('\n');
}

export function renderModule(capture, browserVersion) {
  const source = {
    generator: 'tools/render/gen-gl-constants.mjs',
    browser: browserVersion.product, revision: browserVersion.revision, userAgent: capture.userAgent, platform: capture.platform,
    unmaskedVendor: capture.unmaskedVendor, unmaskedRenderer: capture.unmaskedRenderer,
    counts: {constants: Object.keys(capture.constants).length, methods: capture.methods.length, extensions: capture.supportedExtensions.length},
  };
  const parts = [
    '// GENERATED by tools/render/gen-gl-constants.mjs from the local Chrome: do not edit by hand.',
    `// ${source.browser} — ${source.unmaskedRenderer}`,
    '// Numeric WebGL2 values read in the browser (never strings, never a Proxy) for the Node',
    '// fake WebGL2 (tools/render/fake-webgl2.mjs). Regenerate: node tools/render/gen-gl-constants.mjs',
    '',
    'function deepFreeze(value) {',
    "  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); for (const key of Object.keys(value)) deepFreeze(value[key]); }",
    '  return value;',
    '}',
    '',
    block('SOURCE', source, 'Where and by what this table was captured.'),
    block('GL', capture.constants, 'WebGL2RenderingContext constants (prototype own properties, sorted).'),
    block('METHODS', capture.methods, 'WebGL2RenderingContext methods (prototype own properties, sorted).'),
    block('ATTRIBUTES', capture.attributes, 'WebGL2RenderingContext accessor attributes.'),
    block('PARAMETERS', capture.implementation, 'Implementation parameters (limits, strings, ranges): getParameter on a fresh context.'),
    block('FRAMEBUFFER_PARAMETERS', capture.framebufferParameters, 'Default framebuffer parameters of a fresh context with default attributes.'),
    block('INITIAL_STATE', capture.initialState, 'Every other valid getParameter name: context state of a fresh 300x150 context.'),
    block('PRECISION', capture.precision, 'getShaderPrecisionFormat: [rangeMin, rangeMax, precision].'),
    block('OBJECT_DEFAULTS', capture.objectDefaults, 'Parameters of freshly created objects.'),
    block('DEFAULT_FRAMEBUFFERS', capture.defaultFramebuffers, 'Context attributes requested and granted, default framebuffer parameters.'),
    block('SUPPORTED_EXTENSIONS', capture.supportedExtensions, 'getSupportedExtensions(), in browser order.'),
    block('EXTENSIONS', capture.extensions, 'Per extension: numeric constants, method names, getParameter values once enabled.'),
    block('FORMATS', capture.formats, 'Sized internal formats: texStorage2D / renderbufferStorage result and framebuffer status, core and with every extension enabled.'),
    '',
  ];
  return parts.join('\n');
}

export async function capture({chromePath, angle} = {}) {
  return withChrome({chromePath, angle, window: [320, 200]}, async browser => {
    const page = await browser.openPage('about:blank');
    const data = await page.call(capturePage, ATTRIBUTE_SETS, SIZED_FORMATS, IMPLEMENTATION_PARAMETER.source, FRAMEBUFFER_PARAMETER.source);
    if (!data || !data.constants || !Object.keys(data.constants).length) throw new Error('WebGL2 capture failed: no constants');
    return {data, version: browser.version};
  });
}

function parseArgs(argv) {
  const out = {out: DEFAULT_OUT, check: false};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--check') out.check = true;
    else if (a === '--help') out.help = true;
    else if (['--out', '--chrome-path', '--angle'].includes(a) && i + 1 < argv.length) out[a.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = argv[++i];
    else throw new Error(`Unknown or incomplete option: ${a}`);
  }
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Usage: node tools/render/gen-gl-constants.mjs [--check] [--out file] [--chrome-path path] [--angle metal|d3d11|none]');
  } else {
    const {data, version} = await capture(args);
    const text = renderModule(data, version), out = resolve(args.out);
    const summary = {out, browser: version.product, renderer: data.unmaskedRenderer, constants: Object.keys(data.constants).length,
      methods: data.methods.length, extensions: data.supportedExtensions.length, parameters: Object.keys(data.implementation).length,
      initialState: Object.keys(data.initialState).length, bytes: Buffer.byteLength(text)};
    if (args.check) {
      let previous = null;
      try { previous = readFileSync(out, 'utf8'); } catch {}
      summary.identical = previous === text;
      console.log(JSON.stringify(summary, null, 2));
      process.exitCode = summary.identical ? 0 : 1;
    } else {
      writeFileSync(out, text);
      console.log(JSON.stringify(summary, null, 2));
    }
  }
}
