// Static game data: abilities, skills & perks, items, spells, monsters, biomes.

export const ABILITIES = [
  { id: 'wel', name: 'Well-being', desc: 'Health, stamina and natural recovery.' },
  { id: 'pow', name: 'Power', desc: 'Melee damage and carry weight (25 lb per point).' },
  { id: 'int', name: 'Intellect', desc: 'Mana pool, spell strength and potion brewing.' },
  { id: 'wil', name: 'Willpower', desc: 'Mana and stamina regeneration, resistance to magic.' },
  { id: 'gui', name: 'Guile', desc: 'Critical strikes, lock-picking, haggling and stealth.' },
];
export const ABIL_START = 4, ABIL_POINTS = 6, ABIL_CREATE_MAX = 8;
export const SKILL_START = 20, SKILL_POINTS = 200, SKILL_CREATE_MAX = 60, SKILL_CAP = 100, PERK_STEP = 25;

// mods are summed across all unlocked perks and read via player.perk(key)
export const SKILLS = [
  { id: 'short', name: 'Short Blades', abil: 'gui', desc: 'Daggers and short swords. Fast, precise.', perks: [
    ['Quick Hands', 'Short blades strike 15% faster.', { shortSpeed: 0.15 }],
    ['Backstab', 'Triple damage against foes that have not noticed you.', { backstab: 2 }],
    ['Open Vein', 'Short blade hits cause bleeding.', { shortBleed: 1 }],
    ['Flurry', '25% chance to instantly strike again.', { flurry: 0.25 }]] },
  { id: 'long', name: 'Long Blades', abil: 'pow', desc: 'Long swords and claymores.', perks: [
    ['Keen Edge', 'Long blades deal 10% more damage.', { longDmg: 0.1 }],
    ['Cleave', 'Long blade swings strike every foe in front of you.', { longCleave: 1 }],
    ['Duelist', '+10% critical chance with long blades.', { longCrit: 0.1 }],
    ['Executioner', '+50% damage to foes below a third of their health.', { execute: 0.5 }]] },
  { id: 'blunt', name: 'Blunt Weapons', abil: 'pow', desc: 'Maces and warhammers.', perks: [
    ['Heavy Hand', 'Blunt weapons deal 10% more damage.', { bluntDmg: 0.1 }],
    ['Crush', 'Blunt weapons ignore 35% of armor.', { bluntPierce: 0.35 }],
    ['Concussion', '20% chance to stun on hit.', { bluntStun: 0.2 }],
    ['Shatter', 'A further 20% damage with blunt weapons.', { bluntDmg: 0.2 }]] },
  { id: 'axes', name: 'Axes', abil: 'pow', desc: 'Hand axes and battle axes.', perks: [
    ['Hewer', 'Axes deal 10% more damage.', { axeDmg: 0.1 }],
    ['Rend', 'Axe hits cause bleeding.', { axeBleed: 1 }],
    ['Wide Arc', 'Axe swings strike every foe in front of you.', { axeCleave: 1 }],
    ['Frenzy', 'Axes strike 20% faster.', { axeSpeed: 0.2 }]] },
  { id: 'polearms', name: 'Pole-arms', abil: 'pow', desc: 'Spears and halberds. Superior reach.', perks: [
    ['Long Reach', 'Pole-arms reach half a meter further.', { poleReach: 0.5 }],
    ['Impale', 'Pole-arms deal 15% more damage.', { poleDmg: 0.15 }],
    ['Sweep', 'Pole-arm swings strike every foe in front of you.', { poleCleave: 1 }],
    ['Skewer', '+15% critical chance with pole-arms.', { poleCrit: 0.15 }]] },
  { id: 'archery', name: 'Archery', abil: 'gui', desc: 'Bows. Hold attack to draw, release to loose.', perks: [
    ['Steady Hand', 'Bows deal 15% more damage.', { bowDmg: 0.15 }],
    ['Quick Draw', 'Draw your bow 25% faster.', { bowSpeed: 0.25 }],
    ['Piercing Shot', 'Arrows ignore half of the target\'s armor.', { bowPierce: 0.5 }],
    ['Eagle Eye', '+25% critical chance with bows.', { bowCrit: 0.25 }]] },
  { id: 'shields', name: 'Shields', abil: 'wel', desc: 'Blocking with a shield (hold right mouse).', perks: [
    ['Brace', 'Shields absorb 15% more damage.', { blockAmt: 0.15 }],
    ['Shield Bash', 'Blocking a melee hit staggers the attacker.', { blockStagger: 1 }],
    ['Arrow Catcher', 'Blocked projectiles deal no damage.', { blockProj: 1 }],
    ['The Wall', 'Blocking costs no stamina.', { blockFree: 1 }]] },
  { id: 'light', name: 'Light Armor', abil: 'gui', desc: 'Hide, leather and scale armor.', perks: [
    ['Fitted', 'Light armor protects 20% better.', { lightAR: 0.2 }],
    ['Sidestep', '8% chance to dodge any attack.', { dodge: 0.08 }],
    ['Unburdened', 'Worn light armor weighs nothing.', { lightWeightless: 1 }],
    ['Wind Dancer', 'Move 10% faster.', { speed: 0.1 }]] },
  { id: 'heavy', name: 'Heavy Armor', abil: 'wel', desc: 'Metal plate and mail.', perks: [
    ['Tempered', 'Heavy armor protects 20% better.', { heavyAR: 0.2 }],
    ['Conditioning', 'Worn heavy armor weighs half as much.', { heavyHalf: 1 }],
    ['Spiked', 'Reflect 15% of melee damage taken.', { reflect: 0.15 }],
    ['Immovable', 'Take 15% less physical damage.', { physResist: 0.15 }]] },
  { id: 'destruction', name: 'Destruction', abil: 'int', desc: 'Offensive magic of fire, frost and storm.', perks: [
    ['Kindling', 'Destruction spells cost 15% less.', { costDestruction: 0.15 }],
    ['Searing', 'Destruction spells deal 20% more damage.', { destDmg: 0.2 }],
    ['Lingering Flame', 'Destruction spells set foes ablaze.', { destBurn: 1 }],
    ['Cataclysm', 'A further 25% damage and wider blasts.', { destDmg: 0.25, destArea: 0.5 }]] },
  { id: 'illusion', name: 'Illusion', abil: 'wil', desc: 'Magic of light, shadow and the mind.', perks: [
    ['Sleight', 'Illusion spells cost 15% less.', { costIllusion: 0.15 }],
    ['Persistence', 'Illusion spells last 30% longer.', { durIllusion: 0.3 }],
    ['Phantom', 'Enemies notice you from 25% less distance.', { stealth: 0.25 }],
    ['Dreamweaver', 'Illusion spells last a further 50% longer.', { durIllusion: 0.5 }]] },
  { id: 'alteration', name: 'Alteration', abil: 'int', desc: 'Magic that mends and reshapes body and world.', perks: [
    ['Economy', 'Alteration spells cost 15% less.', { costAlteration: 0.15 }],
    ['Stability', 'Alteration spells last 30% longer.', { durAlteration: 0.3 }],
    ['Potency', 'Alteration spells are 25% stronger.', { magAlteration: 0.25 }],
    ['Wellspring', 'Mana regenerates 50% faster.', { manaRegen: 0.5 }]] },
  { id: 'alchemy', name: 'Alchemy', abil: 'int', desc: 'Brew potions from ingredients sharing an effect.', perks: [
    ['Distiller', 'Potions you brew are 15% stronger.', { brewMag: 0.15 }],
    ['Double Batch', '25% chance to brew two potions at once.', { brewDouble: 0.25 }],
    ['Iron Stomach', 'Potions you drink are 25% more effective.', { drinkMag: 0.25 }],
    ['Purity', 'Potions you brew are a further 30% stronger.', { brewMag: 0.3 }]] },
  { id: 'foraging', name: 'Foraging', abil: 'wil', desc: 'Gathering herbs, fungi and ore in the wild.', perks: [
    ['Green Thumb', '50% chance to gather an extra ingredient.', { forageExtra: 0.5 }],
    ['Keen Eye', 'Nearby forageables appear on your compass.', { forageSense: 1 }],
    ['Naturalist', 'Sometimes find a rare ingredient while gathering.', { forageRare: 0.25 }],
    ['Bountiful', 'Always gather double.', { forageDouble: 1 }]] },
  { id: 'smithing', name: 'Smithing', abil: 'pow', desc: 'Forge, temper and repair arms and armor.', perks: [
    ['Apprentice', 'Your repairs restore 25% more condition.', { repairAmt: 0.25 }],
    ['Journeyman', 'Items you forge are of Fine quality.', { forgeQ: 1 }],
    ['Thrifty', '25% chance to save an ingot when forging.', { forgeSave: 0.25 }],
    ['Master Smith', 'Items you forge are of Masterwork quality.', { forgeQ: 1 }]] },
  { id: 'lockpick', name: 'Lock-picking', abil: 'gui', desc: 'Opening locked doors and chests.', perks: [
    ['Nimble Fingers', 'The sweet spot of every tumbler is 25% wider.', { pickZone: 0.25 }],
    ['Sturdy Picks', 'Picks break half as often.', { pickSturdy: 0.5 }],
    ['Treasure Sense', 'Find 30% more gold in chests.', { chestGold: 0.3 }],
    ['Master Thief', 'Your picks never break.', { pickSturdy: 1 }]] },
  { id: 'persuasion', name: 'Persuasion', abil: 'gui', desc: 'Haggling, charm and negotiation.', perks: [
    ['Haggler', 'Prices are 8% better.', { barter: 0.08 }],
    ['Charmer', 'People warm to you 50% faster.', { charm: 0.5 }],
    ['Negotiator', 'Quest rewards pay 20% more gold.', { questGold: 0.2 }],
    ['Silver Tongue', 'Prices are a further 10% better.', { barter: 0.1 }]] },
];
export const SKILL_BY_ID = Object.fromEntries(SKILLS.map((s) => [s.id, s]));

// ---------- Items ----------
export const METALS = ['Iron', 'Steel', 'Silvered', 'Duskiron', 'Starmetal'];
export const HIDES = ['Hide', 'Leather', 'Studded', 'Shadowhide', 'Drakescale'];
export const TIER_COL = ['#8a8a92', '#b8c0cc', '#e4e8f4', '#6a5a8c', '#7fd4e8'];
export const HIDE_COL = ['#8a6a48', '#6e4a2c', '#5c4030', '#3a3444', '#3f7a5a'];
export const TIER_DMG = [1, 1.3, 1.65, 2.05, 2.5];
export const TIER_VAL = [1, 2.4, 5.5, 12, 26];
export const SMITH_REQ = [0, 30, 50, 70, 90];

export const WEAPONS = {
  dagger: { name: 'Dagger', skill: 'short', dmg: 5, speed: 1.7, reach: 2.0, weight: 1.5, hands: 1, val: 14, ingots: 1 },
  shortsword: { name: 'Short Sword', skill: 'short', dmg: 7, speed: 1.4, reach: 2.2, weight: 3, hands: 1, val: 24, ingots: 2 },
  longsword: { name: 'Long Sword', skill: 'long', dmg: 10, speed: 1.1, reach: 2.5, weight: 5, hands: 1, val: 40, ingots: 3 },
  claymore: { name: 'Claymore', skill: 'long', dmg: 15, speed: 0.82, reach: 2.8, weight: 9, hands: 2, val: 62, ingots: 4 },
  mace: { name: 'Mace', skill: 'blunt', dmg: 9, speed: 1.05, reach: 2.2, weight: 6, hands: 1, val: 36, ingots: 3 },
  warhammer: { name: 'Warhammer', skill: 'blunt', dmg: 17, speed: 0.7, reach: 2.6, weight: 12, hands: 2, val: 66, ingots: 5 },
  handaxe: { name: 'Hand Axe', skill: 'axes', dmg: 8, speed: 1.2, reach: 2.1, weight: 4, hands: 1, val: 30, ingots: 2 },
  battleaxe: { name: 'Battle Axe', skill: 'axes', dmg: 15, speed: 0.8, reach: 2.6, weight: 10, hands: 2, val: 60, ingots: 4 },
  spear: { name: 'Spear', skill: 'polearms', dmg: 9, speed: 1.1, reach: 3.1, weight: 5, hands: 1, val: 32, ingots: 2 },
  halberd: { name: 'Halberd', skill: 'polearms', dmg: 15, speed: 0.8, reach: 3.4, weight: 11, hands: 2, val: 64, ingots: 4 },
  shortbow: { name: 'Short Bow', skill: 'archery', dmg: 8, speed: 1.25, reach: 60, weight: 2, hands: 2, val: 30, ingots: 1, bow: true },
  longbow: { name: 'Long Bow', skill: 'archery', dmg: 12, speed: 0.9, reach: 90, weight: 3.5, hands: 2, val: 52, ingots: 2, bow: true },
};
export const SHIELDS = {
  buckler: { name: 'Buckler', block: 0.4, weight: 4, val: 22, ar: 3, ingots: 2 },
  kite: { name: 'Kite Shield', block: 0.55, weight: 8, val: 44, ar: 5, ingots: 3 },
  tower: { name: 'Tower Shield', block: 0.7, weight: 14, val: 70, ar: 8, ingots: 5 },
};
export const ARMOR_SLOTS = {
  head: { ar: 6, w: 5, val: 30, heavy: 'Helm', light: 'Cap', ingots: 2 },
  body: { ar: 13, w: 24, val: 75, heavy: 'Cuirass', light: 'Jerkin', ingots: 5 },
  arms: { ar: 5, w: 6, val: 28, heavy: 'Gauntlets', light: 'Bracers', ingots: 2 },
  legs: { ar: 8, w: 13, val: 48, heavy: 'Greaves', light: 'Leggings', ingots: 3 },
  feet: { ar: 5, w: 6, val: 26, heavy: 'Sabatons', light: 'Boots', ingots: 2 },
};
export const EQUIP_SLOTS = [
  ['head', 'Head'], ['amulet', 'Amulet'], ['body', 'Body'], ['arms', 'Arms'], ['rhand', 'Right Hand'], ['lhand', 'Left Hand'],
  ['belt', 'Belt'], ['legs', 'Legs'], ['ring1', 'Ring'], ['ring2', 'Ring'], ['feet', 'Feet'],
];

export const EFFECTS = {
  heal: { name: 'Restore Health', unit: ' health', base: 28 },
  mana: { name: 'Restore Mana', unit: ' mana', base: 26 },
  stam: { name: 'Restore Stamina', unit: ' stamina', base: 40 },
  regen: { name: 'Regeneration', unit: ' hp/s', base: 0.9, dur: 40 },
  might: { name: 'Fortify Power', unit: ' Power', base: 1.2, dur: 120, int: true },
  swift: { name: 'Swiftness', unit: '% speed', base: 18, dur: 90 },
  stone: { name: 'Stoneskin', unit: ' armor', base: 16, dur: 90 },
  night: { name: 'Night Eye', unit: '', base: 1, dur: 180, flat: true },
  feather: { name: 'Feather', unit: ' lb', base: 40, dur: 240 },
  cure: { name: 'Cure Poison', unit: '', base: 1, flat: true },
  resist: { name: 'Resist Magic', unit: '% resistance', base: 18, dur: 120 },
  water: { name: 'Waterstride', unit: '', base: 1, dur: 150, flat: true },
};

// Ingredients. Each has up to three alchemical effects; how many of them you can draw out depends on your Alchemy skill.
// Wild plants are unique to one biome.
export const INGREDIENTS = {
  // forest
  redcap: { name: 'Redcap Mushroom', fx: ['heal', 'regen', 'stam'], val: 4, w: 0.1, icon: 'mushroom', col: '#c8402c' },
  blackberry: { name: 'Blackberries', fx: ['stam', 'heal'], val: 3, w: 0.1, icon: 'berry', col: '#4a2a6a', food: 4 },
  fennroot: { name: 'Fennroot', fx: ['might', 'stam', 'stone'], val: 6, w: 0.2, icon: 'root', col: '#b08a54' },
  moonpetal: { name: 'Moonpetal', fx: ['mana', 'night', 'resist'], val: 8, w: 0.1, icon: 'flower', col: '#b8c8f8' },
  ghostfern: { name: 'Ghostfern', fx: ['night', 'resist', 'feather'], val: 9, w: 0.1, icon: 'leaf', col: '#a8e0c8' },
  honeycap: { name: 'Honeycap', fx: ['stam', 'regen', 'swift'], val: 6, w: 0.1, icon: 'mushroom', col: '#e0a830' },
  elderberry: { name: 'Elderberries', fx: ['cure', 'heal', 'resist'], val: 5, w: 0.1, icon: 'berry', col: '#b02838', food: 3 },
  // plains
  meadowsweet: { name: 'Meadowsweet', fx: ['heal', 'cure'], val: 4, w: 0.1, icon: 'flower', col: '#f4e8b8' },
  goldwheat: { name: 'Goldwheat', fx: ['stam', 'feather'], val: 3, w: 0.1, icon: 'leaf', col: '#e0b848' },
  bluebell: { name: 'Bluebell', fx: ['mana', 'swift', 'water'], val: 5, w: 0.1, icon: 'flower', col: '#5878e0' },
  sunpetal: { name: 'Sunpetal', fx: ['might', 'heal', 'regen'], val: 7, w: 0.1, icon: 'flower', col: '#f0c830' },
  prairiesage: { name: 'Prairie Sage', fx: ['mana', 'cure', 'resist'], val: 6, w: 0.1, icon: 'leaf', col: '#78a8a0' },
  redclover: { name: 'Red Clover', fx: ['regen', 'stam', 'heal'], val: 4, w: 0.1, icon: 'flower', col: '#d84858' },
  // desert
  cactusfruit: { name: 'Cactus Fruit', fx: ['stam', 'mana', 'water'], val: 5, w: 0.2, icon: 'berry', col: '#e04878', food: 5 },
  sunthorn: { name: 'Sunthorn', fx: ['might', 'stone'], val: 9, w: 0.1, icon: 'leaf', col: '#d89030' },
  dustlily: { name: 'Dust Lily', fx: ['night', 'feather'], val: 8, w: 0.1, icon: 'flower', col: '#e8d8c0' },
  firebloom: { name: 'Firebloom', fx: ['might', 'swift', 'resist'], val: 11, w: 0.1, icon: 'flower', col: '#f05828' },
  saltbush: { name: 'Saltbush', fx: ['feather', 'stam', 'cure'], val: 5, w: 0.1, icon: 'leaf', col: '#a8b890' },
  mirageorchid: { name: 'Mirage Orchid', fx: ['mana', 'night', 'swift'], val: 13, w: 0.1, icon: 'flower', col: '#a868d8' },
  // mountains
  frostcap: { name: 'Frostcap', fx: ['stone', 'mana', 'resist'], val: 9, w: 0.1, icon: 'mushroom', col: '#a8d8f0' },
  skyblossom: { name: 'Skyblossom', fx: ['swift', 'feather'], val: 10, w: 0.1, icon: 'flower', col: '#f0a8d8' },
  ironmoss: { name: 'Ironmoss', fx: ['stone', 'might'], val: 8, w: 0.1, icon: 'leaf', col: '#5a7a6a' },
  cragroot: { name: 'Cragroot', fx: ['might', 'stone', 'regen'], val: 9, w: 0.2, icon: 'root', col: '#a86848' },
  stormbell: { name: 'Stormbell', fx: ['swift', 'mana', 'resist'], val: 12, w: 0.1, icon: 'flower', col: '#8868e0' },
  snowdrop: { name: 'Snowdrop', fx: ['heal', 'cure', 'feather'], val: 8, w: 0.1, icon: 'flower', col: '#f0f4f8' },
  // swamp
  boglily: { name: 'Bog Lily', fx: ['cure', 'regen', 'water'], val: 6, w: 0.1, icon: 'flower', col: '#e8f0a0' },
  marshcap: { name: 'Marshcap', fx: ['night', 'mana'], val: 6, w: 0.1, icon: 'mushroom', col: '#7a9a48' },
  leechwort: { name: 'Leechwort', fx: ['regen', 'heal'], val: 7, w: 0.1, icon: 'root', col: '#6a3a4a' },
  witchcap: { name: 'Witchcap', fx: ['night', 'mana', 'resist'], val: 10, w: 0.1, icon: 'mushroom', col: '#8848b8' },
  bloodreed: { name: 'Bloodreed', fx: ['heal', 'might', 'water'], val: 8, w: 0.1, icon: 'leaf', col: '#b83838' },
  mirefern: { name: 'Mirefern', fx: ['cure', 'stone', 'water'], val: 7, w: 0.1, icon: 'leaf', col: '#4a8a58' },
  // monster parts
  pelt: { name: 'Beast Pelt', fx: [], val: 8, w: 2, icon: 'pelt', col: '#8a6a48' },
  venom: { name: 'Venom Gland', fx: ['swift', 'cure', 'resist'], val: 12, w: 0.2, icon: 'part', col: '#78c848' },
  bonedust: { name: 'Bone Dust', fx: ['stone', 'night'], val: 7, w: 0.2, icon: 'part', col: '#e8e0d0' },
  ectoplasm: { name: 'Ectoplasm', fx: ['mana', 'feather', 'resist'], val: 18, w: 0.1, icon: 'part', col: '#a8f0e0' },
  trollfat: { name: 'Troll Fat', fx: ['regen', 'might', 'stone'], val: 22, w: 0.5, icon: 'part', col: '#d8d088' },
  batwing: { name: 'Bat Wing', fx: ['night', 'swift'], val: 5, w: 0.1, icon: 'part', col: '#4a3a3a' },
  impheart: { name: 'Imp Heart', fx: ['mana', 'might', 'resist'], val: 26, w: 0.2, icon: 'part', col: '#e83838' },
  meat: { name: 'Raw Meat', fx: [], val: 3, w: 1, icon: 'meat', col: '#c85858', food: 8 },
};

// Wild forage nodes per biome: [ingredient, flora sprite, needs a sickle?]. Berries, fungi and fruit can be picked by hand.
export const FORAGE = {
  forest: [['redcap', 'mushroom', 0], ['blackberry', 'berrybush', 0], ['fennroot', 'herb', 1], ['moonpetal', 'flowerW', 1], ['ghostfern', 'fern', 1], ['honeycap', 'mushroomY', 0], ['elderberry', 'berryR', 0]],
  plains: [['meadowsweet', 'flowerW', 1], ['goldwheat', 'wheat', 1], ['bluebell', 'flowerB', 1], ['sunpetal', 'flowerY', 1], ['prairiesage', 'herbB', 1], ['redclover', 'flowerR', 1]],
  desert: [['cactusfruit', 'cactusfruit', 0], ['sunthorn', 'thorn', 1], ['dustlily', 'flowerW', 1], ['firebloom', 'flowerR', 1], ['saltbush', 'herbB', 1], ['mirageorchid', 'flowerV', 1]],
  mountains: [['frostcap', 'mushroomB', 0], ['skyblossom', 'flowerP', 1], ['ironmoss', 'moss', 1], ['cragroot', 'herbR', 1], ['stormbell', 'flowerV', 1], ['snowdrop', 'flowerW', 1]],
  swamp: [['boglily', 'lily', 1], ['marshcap', 'mushroomG', 0], ['leechwort', 'herb', 1], ['witchcap', 'mushroomP', 0], ['bloodreed', 'herbR', 1], ['mirefern', 'fern', 1]],
};

export const MISC = {
  lockpick: { name: 'Lockpick', type: 'tool', weight: 0.1, val: 6, stack: true, icon: 'lockpick', desc: 'For opening locks. May break.' },
  hammer: { name: 'Smith\'s Hammer', type: 'tool', weight: 3, val: 30, icon: 'hammer', desc: 'Smithing tool. Use it to make rough repairs anywhere. Forging also needs tongs and an anvil.' },
  tongs: { name: 'Smith\'s Tongs', type: 'tool', weight: 2, val: 28, icon: 'tongs', desc: 'Smithing tool. Needed with a hammer to forge, temper or smelt at a smithy.' },
  pickaxe: { name: 'Pickaxe', type: 'tool', weight: 6, val: 35, icon: 'pickaxe', desc: 'Mining tool. Needed to dig ore and coal from veins in mines, caves and mountainsides.' },
  sickle: { name: 'Herbalist\'s Sickle', type: 'tool', weight: 1, val: 14, icon: 'sickle', desc: 'Foraging tool. Needed to harvest herbs, flowers and roots. Berries and fungi can be picked by hand.' },
  knife: { name: 'Skinning Knife', type: 'tool', weight: 0.5, val: 16, icon: 'dagger', desc: 'Foraging tool. Needed to take pelts from slain beasts.' },
  mortar: { name: 'Mortar & Pestle', type: 'tool', weight: 2, val: 40, icon: 'mortar', desc: 'Alchemy tool. Use it to brew potions anywhere. The essential piece of an alchemist\'s kit.' },
  alembic: { name: 'Alembic', type: 'tool', weight: 3, val: 120, icon: 'alembic', desc: 'Alchemy tool. Potions you brew are 25% stronger while you carry it.' },
  calcinator: { name: 'Calcinator', type: 'tool', weight: 4, val: 150, icon: 'calcinator', desc: 'Alchemy tool. Lasting potions you brew keep 40% longer while you carry it.' },
  retort: { name: 'Retort', type: 'tool', weight: 2, val: 180, icon: 'retort', desc: 'Alchemy tool. Lets you blend a fourth ingredient, and gives a 25% chance of an extra potion.' },
  coal: { name: 'Coal', type: 'mat', weight: 1, val: 4, stack: true, icon: 'ore', col: '#2a2a30', desc: 'Mined fuel. One lump is burned for each ingot of steel or better you smelt.' },
  torch: { name: 'Torch', type: 'torch', slot: 'lhand', weight: 1, val: 4, stack: true, icon: 'torch', desc: 'Hold in your left hand to light dark places.' },
  arrow: { name: 'Arrow', type: 'ammo', weight: 0.1, val: 1, stack: true, icon: 'arrow', desc: 'Ammunition for bows.' },
  bread: { name: 'Bread', type: 'food', weight: 0.5, val: 3, stack: true, icon: 'bread', food: 12, desc: 'Restores a little health and stamina.' },
  cheese: { name: 'Cheese', type: 'food', weight: 0.5, val: 5, stack: true, icon: 'bread', food: 16, desc: 'Restores a little health and stamina.' },
  ale: { name: 'Ale', type: 'food', weight: 1, val: 4, stack: true, icon: 'potion', food: 8, col: '#c89030', desc: 'Restores stamina. Warms the belly.' },
  leather: { name: 'Leather', type: 'mat', weight: 1, val: 10, stack: true, icon: 'pelt', col: '#6e4a2c', desc: 'Cured hide for crafting light armor.' },
  gem: { name: 'Gemstone', type: 'mat', weight: 0.1, val: 60, stack: true, icon: 'gem', desc: 'A valuable cut stone.' },
  parcel: { name: 'Sealed Parcel', type: 'quest', weight: 2, val: 0, icon: 'parcel', desc: 'To be delivered unopened.' },
  relic: { name: 'Relic', type: 'quest', weight: 2, val: 0, icon: 'chalice', desc: 'Someone wants this returned.' },
};

export const SPELLS = {
  firebolt: { name: 'Firebolt', school: 'destruction', cost: 9, lvl: 0, val: 60, kind: 'proj', dmg: 14, col: '#ff8830', desc: 'Hurl a bolt of flame.' },
  frostshard: { name: 'Frost Shard', school: 'destruction', cost: 12, lvl: 25, val: 140, kind: 'proj', dmg: 15, slow: 4, col: '#88d8ff', desc: 'A shard of ice that chills and slows.' },
  spark: { name: 'Stormlash', school: 'destruction', cost: 16, lvl: 40, val: 260, kind: 'ray', dmg: 26, col: '#e8e0ff', desc: 'Instant lightning strikes what you look at.' },
  fireball: { name: 'Fireball', school: 'destruction', cost: 28, lvl: 60, val: 520, kind: 'proj', dmg: 30, area: 5, col: '#ff5818', desc: 'An exploding sphere of fire.' },
  glimmer: { name: 'Glimmer', school: 'illusion', cost: 6, lvl: 0, val: 50, kind: 'buff', fx: 'night', dur: 180, desc: 'A pale light lets you see in darkness.' },
  dread: { name: 'Dread', school: 'illusion', cost: 16, lvl: 25, val: 150, kind: 'fear', dur: 9, area: 12, desc: 'Nearby foes flee in terror.' },
  veil: { name: 'Veil', school: 'illusion', cost: 22, lvl: 40, val: 300, kind: 'buff', fx: 'veil', dur: 25, desc: 'Fade from sight. Attacking breaks the spell.' },
  lull: { name: 'Lull', school: 'illusion', cost: 20, lvl: 60, val: 480, kind: 'calm', dur: 25, area: 14, desc: 'Nearby foes forget their hostility for a time.' },
  mend: { name: 'Mend', school: 'alteration', cost: 12, lvl: 0, val: 70, kind: 'heal', mag: 24, desc: 'Knit your wounds closed.' },
  stoneskin: { name: 'Stoneskin', school: 'alteration', cost: 15, lvl: 20, val: 120, kind: 'buff', fx: 'stone', mag: 22, dur: 90, desc: 'Your skin hardens like rock.' },
  feather: { name: 'Feather', school: 'alteration', cost: 12, lvl: 30, val: 160, kind: 'buff', fx: 'feather', mag: 60, dur: 300, desc: 'Lightens your burden.' },
  windstride: { name: 'Windstride', school: 'alteration', cost: 16, lvl: 40, val: 280, kind: 'buff', fx: 'swift', mag: 35, dur: 120, desc: 'Run like the wind.' },
  open: { name: 'Open', school: 'alteration', cost: 20, lvl: 50, val: 380, kind: 'open', desc: 'Magically springs a lock you are facing.' },
  waterstride: { name: 'Waterstride', school: 'alteration', cost: 14, lvl: 35, val: 220, kind: 'buff', fx: 'waterwalk', dur: 120, desc: 'Walk upon water.' },
};

// ---------- Monsters ----------
// art: template + params for sprite generator. loot: [itemKey, chance, min, max]
export const MONSTERS = {
  wolf: { name: 'Wolf', lvl: 1, hp: 22, dmg: 5, ar: 0, speed: 6.2, h: 1.1, art: ['quad', { col: '#7a7a80', col2: '#c8c8c8', ears: 2, snout: 1 }], loot: [['pelt', 0.6], ['meat', 0.5]] },
  rat: { name: 'Giant Rat', lvl: 1, hp: 12, dmg: 3, ar: 0, speed: 5.2, h: 0.6, art: ['quad', { col: '#6a5a4a', col2: '#a89080', ears: 1, snout: 1, tail: 1 }], loot: [['meat', 0.3]] },
  boar: { name: 'Wild Boar', lvl: 2, hp: 34, dmg: 7, ar: 2, speed: 5.6, h: 1.0, art: ['quad', { col: '#5a4030', col2: '#3a2a20', ears: 1, snout: 2, tusks: 1, bulk: 1.2 }], loot: [['pelt', 0.5], ['meat', 0.9, 1, 2]] },
  bear: { name: 'Bear', lvl: 5, hp: 85, dmg: 14, ar: 4, speed: 5.4, h: 1.7, art: ['quad', { col: '#5a3a22', col2: '#7a5a3a', ears: 1, snout: 1, bulk: 1.5 }], loot: [['pelt', 0.9, 1, 2], ['meat', 0.9, 1, 3]] },
  jackal: { name: 'Jackal', lvl: 1, hp: 18, dmg: 4, ar: 0, speed: 6.6, h: 0.9, art: ['quad', { col: '#c8a060', col2: '#e8d0a0', ears: 3, snout: 1 }], loot: [['pelt', 0.5]] },
  icewolf: { name: 'Frost Wolf', lvl: 4, hp: 46, dmg: 10, ar: 2, speed: 6.6, h: 1.25, art: ['quad', { col: '#d8e4f0', col2: '#a8c0e0', ears: 2, snout: 1, eye: '#40c8ff' }], loot: [['pelt', 0.8], ['meat', 0.5]] },
  spider: { name: 'Giant Spider', lvl: 3, hp: 30, dmg: 6, ar: 1, speed: 5.4, h: 1.0, poison: 3, art: ['arthro', { col: '#3a2a2a', col2: '#7a3a2a', kind: 'spider' }], loot: [['venom', 0.5]] },
  scorpion: { name: 'Giant Scorpion', lvl: 3, hp: 36, dmg: 7, ar: 5, speed: 4.6, h: 0.9, poison: 4, art: ['arthro', { col: '#a87038', col2: '#5a3818', kind: 'scorpion' }], loot: [['venom', 0.6]] },
  bat: { name: 'Cave Bat', lvl: 1, hp: 10, dmg: 3, ar: 0, speed: 6.5, h: 0.7, fly: 1.4, art: ['flyer', { col: '#3a3038', col2: '#5a4050', kind: 'bat' }], loot: [['batwing', 0.6]] },
  harpy: { name: 'Harpy', lvl: 4, hp: 40, dmg: 9, ar: 1, speed: 6.4, h: 1.6, fly: 1.2, art: ['flyer', { col: '#8a7058', col2: '#d8b090', kind: 'harpy' }], loot: [['gold', 0.5, 4, 20]] },
  imp: { name: 'Imp', lvl: 4, hp: 28, dmg: 5, ar: 1, speed: 5.5, h: 1.0, fly: 0.9, ranged: { dmg: 9, range: 18, cd: 2.4, col: '#ff7028' }, art: ['flyer', { col: '#b83020', col2: '#701810', kind: 'imp' }], loot: [['impheart', 0.4]] },
  wisp: { name: 'Will-o-Wisp', lvl: 4, hp: 24, dmg: 4, ar: 0, speed: 4.5, h: 0.8, fly: 1.2, magic: 1, ranged: { dmg: 10, range: 16, cd: 2.2, col: '#88ffd0' }, art: ['wisp', { col: '#a8ffe0' }], loot: [['ectoplasm', 0.7]] },
  leech: { name: 'Mire Leech', lvl: 2, hp: 26, dmg: 6, ar: 0, speed: 3.6, h: 0.7, art: ['blob', { col: '#3a2a30', col2: '#6a3a4a', eyes: 0 }], loot: [['leechwort', 0.5]] },
  lurker: { name: 'Bog Lurker', lvl: 5, hp: 70, dmg: 13, ar: 3, speed: 4.4, h: 1.7, art: ['blob', { col: '#3a5a30', col2: '#5a7a40', eyes: 2, arms: 1 }], loot: [['boglily', 0.6, 1, 2], ['gold', 0.4, 5, 30]] },
  wurm: { name: 'Dune Wurm', lvl: 6, hp: 90, dmg: 16, ar: 6, speed: 4.2, h: 2.0, art: ['blob', { col: '#b89058', col2: '#806030', eyes: 0, wurm: 1 }], loot: [['gem', 0.3], ['meat', 0.8, 1, 3]] },
  goblin: { name: 'Goblin', lvl: 2, hp: 24, dmg: 6, ar: 1, speed: 5.2, h: 1.2, art: ['human', { skin: '#6a9a48', shirt: '#5a4a38', pants: '#3a3028', ears: 1, weapon: 'club', bald: 1 }], loot: [['gold', 0.7, 2, 12]] },
  goblinshaman: { name: 'Goblin Shaman', lvl: 5, hp: 36, dmg: 5, ar: 1, speed: 4.6, h: 1.25, ranged: { dmg: 12, range: 18, cd: 2.5, col: '#78ff58' }, art: ['human', { skin: '#6a9a48', robe: '#5a3068', ears: 1, weapon: 'staff', hood: 1 }], loot: [['gold', 0.8, 8, 30], ['potion', 0.4]] },
  bandit: { name: 'Bandit', lvl: 2, hp: 34, dmg: 7, ar: 3, speed: 5.0, h: 1.75, art: ['human', { skin: '#c89878', shirt: '#5a4030', pants: '#3a3a3a', hood: 1, mask: 1, weapon: 'sword' }], loot: [['gold', 0.9, 5, 25], ['gear', 0.25], ['lockpick', 0.3, 1, 2]] },
  banditarcher: { name: 'Bandit Archer', lvl: 3, hp: 28, dmg: 5, ar: 2, speed: 4.8, h: 1.75, ranged: { dmg: 9, range: 26, cd: 2.2, arrow: 1 }, art: ['human', { skin: '#b88868', shirt: '#4a5a38', pants: '#3a3028', hood: 1, weapon: 'bow' }], loot: [['gold', 0.9, 5, 25], ['arrow', 0.8, 4, 12]] },
  banditchief: { name: 'Bandit Chief', lvl: 8, hp: 130, dmg: 18, ar: 9, speed: 5.0, h: 1.9, boss: 1, art: ['human', { skin: '#b88868', armor: '#6a6a72', pants: '#3a2a20', helm: 1, weapon: 'axe', build: 1.2 }], loot: [['gold', 1, 60, 140], ['gear', 1], ['gear', 0.5]] },
  orc: { name: 'Orc Brute', lvl: 7, hp: 95, dmg: 16, ar: 7, speed: 4.8, h: 2.0, art: ['human', { skin: '#5a7a48', armor: '#5a4a3a', pants: '#3a3028', bald: 1, tusks: 1, weapon: 'axe', build: 1.25 }], loot: [['gold', 0.8, 10, 40], ['gear', 0.3]] },
  skeleton: { name: 'Skeleton', lvl: 3, hp: 32, dmg: 8, ar: 3, speed: 4.4, h: 1.75, undead: 1, art: ['human', { skel: 1, weapon: 'sword' }], loot: [['bonedust', 0.6], ['gold', 0.4, 2, 14]] },
  skelarcher: { name: 'Skeleton Archer', lvl: 4, hp: 28, dmg: 5, ar: 2, speed: 4.2, h: 1.75, undead: 1, ranged: { dmg: 10, range: 24, cd: 2.3, arrow: 1 }, art: ['human', { skel: 1, weapon: 'bow' }], loot: [['bonedust', 0.6], ['arrow', 0.8, 3, 10]] },
  zombie: { name: 'Shambling Dead', lvl: 3, hp: 48, dmg: 9, ar: 1, speed: 2.8, h: 1.75, undead: 1, art: ['human', { skin: '#7a9a78', shirt: '#4a4438', pants: '#3a3830', ragged: 1, bald: 1 }], loot: [['gold', 0.4, 2, 14]] },
  drowned: { name: 'Drowned One', lvl: 4, hp: 54, dmg: 10, ar: 2, speed: 3.6, h: 1.75, undead: 1, art: ['human', { skin: '#6a8a9a', shirt: '#2a4a48', pants: '#2a3a38', ragged: 1, hair: '#2a4a3a', hairStyle: 2 }], loot: [['gold', 0.5, 4, 20], ['gem', 0.08]] },
  mummy: { name: 'Mummy', lvl: 6, hp: 80, dmg: 13, ar: 5, speed: 3.2, h: 1.8, undead: 1, art: ['human', { mummy: 1 }], loot: [['gold', 0.7, 10, 40], ['gem', 0.15]] },
  ghost: { name: 'Restless Spirit', lvl: 6, hp: 50, dmg: 11, ar: 0, speed: 4.6, h: 1.8, undead: 1, magic: 1, ghost: 1, art: ['human', { ghost: 1 }], loot: [['ectoplasm', 0.8]] },
  wraith: { name: 'Barrow Wraith', lvl: 10, hp: 170, dmg: 20, ar: 6, speed: 5.0, h: 2.1, undead: 1, magic: 1, ghost: 1, boss: 1, art: ['human', { ghost: 1, dark: 1, crown: 1, weapon: 'sword', build: 1.15 }], loot: [['ectoplasm', 1, 2, 3], ['gold', 1, 80, 180], ['gear', 1], ['jewel', 0.7]] },
  cultist: { name: 'Cultist', lvl: 5, hp: 40, dmg: 6, ar: 2, speed: 4.6, h: 1.75, ranged: { dmg: 13, range: 20, cd: 2.4, col: '#ff7028' }, art: ['human', { skin: '#c8a888', robe: '#5a1818', hood: 1, weapon: 'staff' }], loot: [['gold', 0.8, 8, 35], ['potion', 0.35], ['tome', 0.06]] },
  golem: { name: 'Stone Golem', lvl: 9, hp: 150, dmg: 20, ar: 16, speed: 3.2, h: 2.3, art: ['human', { golem: 1, build: 1.4 }], loot: [['gem', 0.5, 1, 2], ['ore', 0.8, 1, 3]] },
  troll: { name: 'Mountain Troll', lvl: 8, hp: 140, dmg: 19, ar: 6, speed: 4.6, h: 2.5, regen: 2, art: ['human', { skin: '#8a9a88', pants: '#5a4a38', bald: 1, bare: 1, weapon: 'club', build: 1.45, tusks: 1 }], loot: [['trollfat', 0.8], ['gold', 0.5, 10, 50]] },
  ogre: { name: 'Ogre', lvl: 9, hp: 165, dmg: 22, ar: 8, speed: 4.2, h: 2.7, art: ['human', { skin: '#b89868', pants: '#4a3a28', bald: 1, bare: 1, weapon: 'club', build: 1.55 }], loot: [['gold', 0.8, 20, 80], ['gear', 0.3]] },
  lich: { name: 'Lich', lvl: 12, hp: 190, dmg: 12, ar: 6, speed: 4.2, h: 1.95, undead: 1, boss: 1, ranged: { dmg: 22, range: 24, cd: 2.0, col: '#b060ff' }, art: ['human', { skel: 1, robe: '#2a1a48', crown: 1, weapon: 'staff' }], loot: [['gold', 1, 120, 260], ['tome', 1], ['jewel', 1], ['gear', 0.6]] },
  archmage: { name: 'Mad Magus', lvl: 10, hp: 150, dmg: 10, ar: 4, speed: 4.6, h: 1.85, boss: 1, ranged: { dmg: 20, range: 24, cd: 1.9, col: '#60a0ff' }, art: ['human', { skin: '#d8b898', robe: '#283a78', hair: '#e8e8e8', hairStyle: 2, beard: 1, weapon: 'staff', hat: 1 }], loot: [['gold', 1, 90, 200], ['tome', 1], ['jewel', 0.8], ['potion', 1]] },
  spiderqueen: { name: 'Brood Mother', lvl: 9, hp: 180, dmg: 17, ar: 6, speed: 5.0, h: 2.0, poison: 6, boss: 1, art: ['arthro', { col: '#2a1a2a', col2: '#a82828', kind: 'spider' }], loot: [['venom', 1, 2, 4], ['gold', 1, 50, 120], ['gear', 0.8], ['jewel', 0.4]] },
  mummylord: { name: 'Entombed King', lvl: 11, hp: 200, dmg: 21, ar: 9, speed: 3.8, h: 2.0, undead: 1, boss: 1, art: ['human', { mummy: 1, crown: 1, weapon: 'sword', build: 1.15 }], loot: [['gold', 1, 120, 240], ['gem', 1, 1, 3], ['jewel', 1], ['gear', 0.7]] },
  direbear: { name: 'Dire Bear', lvl: 9, hp: 200, dmg: 22, ar: 7, speed: 5.6, h: 2.3, boss: 1, art: ['quad', { col: '#2a2020', col2: '#5a3a3a', ears: 1, snout: 1, bulk: 1.6, eye: '#ff4020' }], loot: [['pelt', 1, 2, 4], ['meat', 1, 2, 4], ['gear', 0.6]] },
  alphawolf: { name: 'Alpha Wolf', lvl: 6, hp: 110, dmg: 14, ar: 3, speed: 6.8, h: 1.5, boss: 1, art: ['quad', { col: '#3a3a40', col2: '#8a8a90', ears: 2, snout: 1, eye: '#ffd020' }], loot: [['pelt', 1, 2, 3], ['gear', 0.5], ['gold', 0.6, 20, 60]] },
  mirehorror: { name: 'Mire Horror', lvl: 10, hp: 210, dmg: 21, ar: 6, speed: 4.4, h: 2.6, boss: 1, poison: 4, art: ['blob', { col: '#2a3a28', col2: '#6a8a38', eyes: 3, arms: 1 }], loot: [['gold', 1, 70, 160], ['gear', 0.8], ['jewel', 0.5]] },
  wurmqueen: { name: 'Sand Tyrant', lvl: 11, hp: 230, dmg: 24, ar: 10, speed: 4.4, h: 3.0, boss: 1, art: ['blob', { col: '#986838', col2: '#583818', eyes: 0, wurm: 1 }], loot: [['gem', 1, 2, 4], ['gold', 1, 80, 160], ['gear', 0.8]] },
  trollking: { name: 'Troll Chieftain', lvl: 12, hp: 260, dmg: 26, ar: 9, speed: 4.8, h: 3.0, boss: 1, regen: 3, art: ['human', { skin: '#6a7a78', pants: '#3a2a28', bald: 1, bare: 1, weapon: 'club', build: 1.6, tusks: 1, crown: 1 }], loot: [['trollfat', 1, 2, 3], ['gold', 1, 100, 220], ['gear', 1]] },
};

// ---------- Biomes ----------
export const B_FOREST = 0, B_DESERT = 1, B_PLAINS = 2, B_MOUNT = 3, B_SWAMP = 4;
export const BIOMES = [
  { id: 'forest', name: 'Forest', ground: [0.23, 0.36, 0.16], ground2: [0.3, 0.28, 0.15], fog: [0.52, 0.62, 0.55], sky: [0.42, 0.58, 0.72], light: [1.0, 1.0, 0.94], fogFar: 300, civ: 0.55, map: '#35602a',
    wild: [['wolf', 5], ['boar', 4], ['spider', 3], ['bandit', 3], ['banditarcher', 2], ['bear', 2], ['goblin', 2]], night: [['wolf', 5], ['spider', 4], ['zombie', 1]],
    dungeons: [['cave', 6], ['den', 1.5], ['crypt', 1], ['ruin', 1], ['tower', 0.5], ['mine', 1.2]] },
  { id: 'desert', name: 'Desert', ground: [0.8, 0.68, 0.42], ground2: [0.72, 0.56, 0.34], fog: [0.88, 0.8, 0.62], sky: [0.5, 0.68, 0.86], light: [1.1, 1.04, 0.9], fogFar: 420, civ: 0.07, map: '#d6b76e',
    wild: [['jackal', 5], ['scorpion', 4], ['bandit', 2], ['wurm', 1.2]], night: [['scorpion', 4], ['mummy', 1.5], ['jackal', 3]],
    dungeons: [['ruin', 5], ['tower', 4], ['crypt', 1], ['mine', 1.2]] },
  { id: 'plains', name: 'Plains', ground: [0.44, 0.52, 0.2], ground2: [0.56, 0.54, 0.24], fog: [0.66, 0.76, 0.84], sky: [0.46, 0.66, 0.9], light: [1.04, 1.04, 1.0], fogFar: 400, civ: 1.0, map: '#86a03c',
    wild: [['wolf', 4], ['rat', 3], ['bandit', 3], ['banditarcher', 2], ['goblin', 3], ['boar', 2]], night: [['wolf', 4], ['skeleton', 2], ['goblin', 3]],
    dungeons: [['crypt', 5], ['tower', 4], ['ruin', 1], ['mine', 0.8]] },
  { id: 'mountains', name: 'Mountains', ground: [0.42, 0.42, 0.4], ground2: [0.36, 0.4, 0.3], fog: [0.72, 0.78, 0.86], sky: [0.5, 0.64, 0.84], light: [0.98, 1.0, 1.06], fogFar: 380, civ: 0, map: '#8c8a88',
    wild: [['icewolf', 4], ['harpy', 3], ['troll', 1.5], ['ogre', 1], ['goblin', 2]], night: [['icewolf', 4], ['troll', 2], ['harpy', 2]],
    dungeons: [['cave', 6], ['den', 1], ['tower', 0.5], ['mine', 5]] },
  { id: 'swamp', name: 'Swamp', ground: [0.22, 0.27, 0.15], ground2: [0.26, 0.22, 0.14], fog: [0.36, 0.44, 0.36], sky: [0.36, 0.46, 0.44], light: [0.8, 0.9, 0.8], fogFar: 170, civ: 0.3, map: '#48583a',
    wild: [['leech', 4], ['lurker', 2], ['wisp', 2], ['drowned', 2], ['spider', 2]], night: [['wisp', 4], ['drowned', 4], ['lurker', 2]],
    dungeons: [['den', 7], ['ruin', 1.5], ['crypt', 1.5], ['mine', 0.4]] },
];

export const DUNGEONS = {
  crypt: { name: 'Crypt', mobs: [['skeleton', 5], ['zombie', 4], ['skelarcher', 2], ['ghost', 1.5], ['rat', 1]], boss: ['wraith', 'lich'], gen: 'rooms', floors: [1, 2] },
  cave: { name: 'Cave', mobs: [['bat', 4], ['spider', 4], ['goblin', 4], ['goblinshaman', 1.5], ['rat', 2], ['orc', 1], ['bear', 0.7]], boss: ['spiderqueen', 'direbear', 'orc'], gen: 'cave', floors: [1, 2] },
  den: { name: 'Monster Den', mobs: null, boss: null, gen: 'cave', floors: [1, 1] },
  ruin: { name: 'Ruin', mobs: [['bandit', 4], ['banditarcher', 3], ['scorpion', 2], ['mummy', 2], ['skeleton', 2], ['cultist', 1.5]], boss: ['banditchief', 'mummylord'], gen: 'rooms', floors: [1, 2] },
  mine: { name: 'Mine', mobs: [['rat', 4], ['bat', 4], ['spider', 3], ['goblin', 4], ['goblinshaman', 1], ['orc', 1], ['golem', 0.5]], boss: ['orc', 'golem', 'spiderqueen'], gen: 'cave', floors: [2, 3] },
  tower: { name: 'Tower', mobs: [['cultist', 5], ['imp', 4], ['skeleton', 2], ['golem', 1], ['ghost', 1]], boss: ['archmage', 'lich'], gen: 'tower', floors: [3, 5] },
};
// Monster dens are stocked by biome
export const DEN_MOBS = [
  { mobs: [['wolf', 6], ['bear', 1]], boss: 'alphawolf' },
  { mobs: [['scorpion', 4], ['wurm', 2], ['jackal', 3]], boss: 'wurmqueen' },
  { mobs: [['goblin', 5], ['goblinshaman', 2], ['wolf', 2]], boss: 'orc' },
  { mobs: [['troll', 2], ['icewolf', 4], ['goblin', 2]], boss: 'trollking' },
  { mobs: [['lurker', 3], ['leech', 4], ['drowned', 2]], boss: 'mirehorror' },
];

export const LOC_TYPES = {
  farm: { name: 'Farm', min: 2, max: 5, civ: true },
  village: { name: 'Village', min: 5, max: 15, civ: true },
  town: { name: 'Town', min: 20, max: 50, civ: true },
  city: { name: 'City', min: 100, max: 500, civ: true },
  castle: { name: 'Castle-City', min: 500, max: 1000, civ: true },
  mine: { name: 'Mine' }, crypt: { name: 'Crypt' }, cave: { name: 'Cave' }, den: { name: 'Monster Den' }, ruin: { name: 'Ruin' }, tower: { name: 'Tower' },
};

export const BUILDINGS = {
  house: { name: 'House', rooms: [2, 4] },
  farmhouse: { name: 'Farmhouse', rooms: [3, 4] },
  barn: { name: 'Barn', rooms: [1, 1] },
  smithy: { name: 'Smithy', rooms: [8, 8], sign: 'anvil', keeper: 'Smith' },
  inn: { name: 'Inn', rooms: [12, 12], sign: 'mug', keeper: 'Innkeeper' },
  trader: { name: 'General Trader', rooms: [5, 5], sign: 'coin', keeper: 'Trader' },
  alchemist: { name: 'Apothecary', rooms: [4, 4], sign: 'flask', keeper: 'Apothecary' },
  arcanist: { name: 'Arcanist', rooms: [4, 4], sign: 'star', keeper: 'Arcanist' },
  guild: { name: 'Guild Hall', rooms: [7, 7], sign: 'shield', keeper: 'Guildmaster' },
  church: { name: 'Church', rooms: [1, 1], sign: 'cross', keeper: 'Priest' },
  castle: { name: 'Castle', rooms: [22, 22] },
};

export const MONTHS = ['Frostwane', 'Rainsong', 'Greentide', 'Sunhigh', 'Goldfall', 'Emberdusk', 'Longnight', 'Deepfrost'];
export const DAY_LEN = 48 * 60; // real seconds per game day

// ---------- Factions ----------
export const RANK_REP = [0, 15, 40, 75, 120]; // standing needed for ranks 0-4; rank 5 (master) is earned by finishing the faction's story
export const KINGDOM_RANKS = ['Outlander', 'Subject', 'Yeoman', 'Squire', 'Knight', 'Lord Protector'];
export const GUILDS = {
  blades: { col: '#8a2a2a', name: 'Free Blades', hall: 'Free Blades\' Hall', rival: 'lantern', ranks: ['Outsider', 'Hireling', 'Sellsword', 'Sergeant', 'Captain', 'Blademaster'],
    ideal: 'A contract kept is worth more than a crown. The Free Blades sell their swords to any honest purse, and have never once broken their word.',
    boon: ['allDmg', 0.04, '+4% weapon damage'], mark: 'the roads are patrolled by Free Blades' },
  page: { col: '#2a3a8a', name: 'Circle of the Seventh Page', hall: 'Hall of the Seventh Page', rival: 'scale', ranks: ['Outsider', 'Reader', 'Scribe', 'Lector', 'Magister', 'Master of Pages'],
    ideal: 'Knowledge hoarded is knowledge lost. The Circle seeks the seven scattered pages of the First Grimoire, and holds that magic belongs to those who study it, not those who can pay.',
    boon: ['costAll', 0.05, '-5% spell cost'], mark: 'the Circle teaches letters to any child who asks' },
  scale: { col: '#b8902a', name: 'Gilded Scale', hall: 'Gilded Scale Counting-House', rival: 'page', ranks: ['Outsider', 'Porter', 'Factor', 'Broker', 'Syndic', 'Master of Coin'],
    ideal: 'Every road is a river of gold for those who keep it open. The Gilded Scale binds the realm together with trade, and believes a fair price ends more wars than a sharp sword.',
    boon: ['barter', 0.04, '4% better prices'], mark: 'the markets are fat with Gilded Scale goods' },
  lantern: { col: '#3a3044', name: 'Night Lantern', hall: 'Lantern House', rival: 'blades', ranks: ['Outsider', 'Wick', 'Shade', 'Whisper', 'Keeper', 'Master of Lanterns'],
    ideal: 'Someone must keep a light in the dark places. The Night Lantern trades in secrets, and believes a quiet word in the right ear spares a hundred lives a battle would spend.',
    boon: ['stealth', 0.07, 'harder to notice'], mark: 'the Night Lantern hears everything said after dark' },
};
export const FAITHS = {
  dawn: { name: 'Church of the Dawn', temple: 'Chapel of the Dawn', ranks: ['Stranger', 'Seeker', 'Candle-bearer', 'Dawnsworn', 'Lightwarden', 'Master of the Dawn'],
    ideal: 'The Dawn teaches that every darkness ends, and that those who carry light are bound to share it.', boon: ['regenFlat', 4, 'slow health regeneration'] },
  moon: { name: 'Temple of the Silver Moon', temple: 'Temple of the Silver Moon', ranks: ['Stranger', 'Seeker', 'Tide-reader', 'Moonsworn', 'Veilkeeper', 'Master of Tides'],
    ideal: 'The Silver Moon teaches that all things wax and wane, and that wisdom is knowing which tide you stand in.', boon: ['manaRegen', 0.3, '+30% mana regeneration'] },
  hearth: { name: 'Hearth of the Mother', temple: 'Shrine of the Hearth-Mother', ranks: ['Stranger', 'Guest', 'Kindler', 'Hearthsworn', 'Warden of the Flame', 'Master of the Hearth'],
    ideal: 'The Mother teaches that no door should be barred to the hungry, and that a shared fire is the oldest law there is.', boon: ['physResist', 0.06, '6% less physical damage'] },
};

// ---------- Smithing knowledge ----------
// To forge something you must know its pattern AND the working of its metal (or hide) tier.
export const ORES = ['Iron Ore', 'Hematite', 'Silver Ore', 'Dusk Ore', 'Star Ore'];
export const PATTERNS = {
  dagger: 'Dagger', shortsword: 'Short Sword', longsword: 'Long Sword', claymore: 'Claymore', mace: 'Mace', warhammer: 'Warhammer', handaxe: 'Hand Axe', battleaxe: 'Battle Axe',
  spear: 'Spear', halberd: 'Halberd', shortbow: 'Short Bow', longbow: 'Long Bow', buckler: 'Buckler', kite: 'Kite Shield', tower: 'Tower Shield',
  'heavy:head': 'Helm', 'heavy:body': 'Cuirass', 'heavy:arms': 'Gauntlets', 'heavy:legs': 'Greaves', 'heavy:feet': 'Sabatons',
  'light:head': 'Cap', 'light:body': 'Jerkin', 'light:arms': 'Bracers', 'light:legs': 'Leggings', 'light:feet': 'Boots',
};
export const TREATISES = [null, 'Steelworking', 'Silvering', 'Duskiron Forging', 'Starmetal Forging'];
