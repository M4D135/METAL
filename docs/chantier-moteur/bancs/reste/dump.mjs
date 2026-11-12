import {writeFileSync} from 'node:fs';import {simSource,source} from './build.mjs';import {patchRenderer} from '../rcpu/proto.mjs';
writeFileSync('out/P_simulation.js',simSource({}));writeFileSync('out/P_renderer.js',patchRenderer(source('renderer'),{}));
