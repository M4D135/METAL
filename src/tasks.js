/* METAL — pure preparation jobs, shared verbatim by the page and its worker. */
(function(G){'use strict';
  const jobs={
    world:q=>{const world=G.FWorld.create(q.seed,q.index,q.options);if(q.prepare&&G.FSimulation){const sim=G.FSimulation.create(world);world.preparedNavigation=sim.nav.bake();sim.dispose();}return world;},
    music:q=>({stage:q.stage,bytes:G.FMusic.getModule(q.stage,q.seed),prepared:G.FMusic.prepared(q.stage,q.seed)}),
    fx:q=>{const options=G.MetalAudio.options(),recipe=options.recipes?.[q.name]||options.extras?.[q.name];return {name:q.name,variant:q.variant,pcm:recipe?recipe.synth(q.variant,22050):G.FAudio.synthesize(q.name,q.variant,22050)};}
  };
  G.MetalTasks={jobs};
})(typeof window!=='undefined'?window:globalThis);
