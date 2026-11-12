// Shared mutable game state. Modules read/write this instead of importing each other in cycles.
export const G = {
  mode: 'menu',       // menu | create | play | dead
  paused: false,
  world: null, terrain: null, player: null,
  scene: null, camera: null, renderer: null,
  space: null,        // null = outdoors, else an interior/dungeon level object
  time: 8 * 3600,     // seconds of game time since day 0, 00:00
  ents: [],           // active entities in the current space
  save: null,         // persistent per-save data (discovered, quests, containers...)
  ui: null, keys: {}, fn: {},
};
export const hourOf = () => (G.time / 3600) % 24;
export const dayOf = () => Math.floor(G.time / 86400);
export const isNight = () => { const h = hourOf(); return h < 5.5 || h > 20.5; };
