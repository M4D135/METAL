// FRender.mesh pour les harnais qui chargent un producteur de maillages isolé (RESTE-03).
// Les producteurs (actors.js, effects.js, game.js) construisent leurs maillages dynamiques
// par le constructeur unique du moteur : un harnais qui les charge seul doit fournir cette
// brique, exactement comme le jeu la fournit par src/renderer.js.
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const scope={window:{}};
vm.runInNewContext(readFileSync(new URL('../src/renderer.js',import.meta.url),'utf8'),scope);
export const FRender=scope.window.FRender;
export const FRenderMesh=scope.window.FRender.mesh;
