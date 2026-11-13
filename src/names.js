// Procedural names for people, places, shops and dungeons.
const PRE = ['Aer', 'Hel', 'Bryn', 'Kald', 'Wyrm', 'Thorn', 'Raven', 'Storm', 'Elder', 'Grim', 'Ash', 'Oak', 'Stone', 'Frost', 'Dun', 'Glen', 'Mor', 'Fen', 'Vald', 'Ulf', 'Hald', 'Sig', 'Eld', 'Wend', 'Cael', 'Har', 'Lind', 'Skar', 'Tor', 'Wyn', 'Black', 'White', 'Red', 'Gold', 'Iron', 'Amber', 'Mist', 'Wolf', 'Hart', 'Brae', 'Cor', 'Dra', 'Eis', 'Fal', 'Gar', 'Isen', 'Jor', 'Kes', 'Lor', 'Nor', 'Ost', 'Rim', 'Sel', 'Tarn', 'Ulm', 'Var', 'Yar'];
const SUF = ['helm', 'gard', 'stead', 'wick', 'ford', 'holm', 'mere', 'vale', 'haven', 'burg', 'hollow', 'fell', 'crest', 'watch', 'moor', 'dale', 'by', 'thorpe', 'mark', 'reach', 'wood', 'bridge', 'field', 'gate', 'mouth', 'cliff', 'run', 'shire', 'ton', 'well'];
const M1 = ['Al', 'Bran', 'Ced', 'Dar', 'Ed', 'Fen', 'Gar', 'Hal', 'Ing', 'Jor', 'Kel', 'Leo', 'Mar', 'Nor', 'Os', 'Per', 'Rag', 'Sig', 'Tor', 'Ul', 'Val', 'Wil', 'Yor', 'Bal', 'Cor', 'Dun', 'Er', 'God', 'Har', 'Rod', 'Theo', 'Wulf', 'Gun', 'Hrol', 'Bjor', 'Ald', 'Os', 'Ber'];
const M2 = ['ric', 'mund', 'win', 'gar', 'mar', 'bert', 'fred', 'ald', 'vin', 'dan', 'ion', 'ar', 'en', 'or', 'ulf', 'stan', 'wyn', 'rik', 'vald', 'grim', 'tan', 'den', 'ley', 'ward', 'helm', 'ren', 'us', 'ic'];
const F1 = ['Ael', 'Bri', 'Cath', 'Dag', 'El', 'Fre', 'Gwen', 'Hil', 'Is', 'Jo', 'Kar', 'Lin', 'Mir', 'Nes', 'Ol', 'Ro', 'Sig', 'Thea', 'Ur', 'Wyn', 'Yl', 'Ast', 'Ber', 'Ed', 'Ing', 'Mar', 'Syl', 'Tam', 'Val', 'Ys', 'Liv', 'Hel', 'Run', 'Eir'];
const F2 = ['a', 'wyn', 'eth', 'ia', 'ene', 'ith', 'rid', 'da', 'la', 'na', 'lyn', 'ra', 'hild', 'gard', 'wen', 'sa', 'ye', 'ora', 'ina', 'elle', 'is', 'ana', 'issa', 'une', 'frid', 'dis', 'ka', 'the'];
const SUR1 = ['Ash', 'Black', 'Bright', 'Brook', 'Cold', 'Dawn', 'Deep', 'Elder', 'Fair', 'Far', 'Gold', 'Good', 'Gray', 'Green', 'Hard', 'High', 'Iron', 'Long', 'Marsh', 'Moon', 'Oak', 'Old', 'Red', 'River', 'Rock', 'Silver', 'Stone', 'Storm', 'Strong', 'Swift', 'Thorn', 'Under', 'White', 'Wild', 'Winter', 'Wolf', 'Barley', 'Copper', 'Hay', 'Mill'];
const SUR2 = ['wood', 'field', 'ford', 'hill', 'brook', 'smith', 'ward', 'man', 'well', 'stone', 'water', 'born', 'more', 'ridge', 'foot', 'hand', 'heart', 'bane', 'shield', 'song', 'worth', 'wright', 'thatch', 'cloak', 'beard', 'mane', 'fall', 'brand', 'helm', 'wick', 'crook', 'burn'];
const ADJ = ['Rusty', 'Golden', 'Prancing', 'Drunken', 'Silver', 'Weary', 'Laughing', 'Sleeping', 'Crooked', 'Merry', 'Black', 'Red', 'Wandering', 'Old', 'Lucky', 'Broken', 'Gilded', 'Hungry', 'Jolly', 'Lonely', 'Howling', 'Blue', 'Green', 'Thirsty', 'Three-Legged', 'Winking'];
const NOUN = ['Stag', 'Boar', 'Dragon', 'Tankard', 'Crown', 'Wolf', 'Lantern', 'Griffin', 'Barrel', 'Pony', 'Raven', 'Hound', 'Maiden', 'Knight', 'Oak', 'Kettle', 'Goose', 'Shield', 'Anchor', 'Bear', 'Rooster', 'Candle', 'Pilgrim', 'Fox', 'Minstrel', 'Hearth'];
const DADJ = ['Forsaken', 'Sunken', 'Whispering', 'Bleak', 'Howling', 'Shattered', 'Forgotten', 'Weeping', 'Blighted', 'Silent', 'Ashen', 'Hollow', 'Drowned', 'Cursed', 'Gloom', 'Withered', 'Sundered', 'Lost', 'Dread', 'Moonlit', 'Bitter', 'Black', 'Frozen', 'Smoldering'];
const DNOUN = {
  crypt: ['Crypt', 'Barrow', 'Tomb', 'Catacombs', 'Mausoleum', 'Ossuary'],
  mine: ['Mine', 'Diggings', 'Workings', 'Pit', 'Shaft', 'Lode'],
  cave: ['Cavern', 'Grotto', 'Hollow', 'Caves', 'Delve', 'Burrows'],
  den: ['Den', 'Lair', 'Nest', 'Warren', 'Pit', 'Haunt'],
  ruin: ['Ruins', 'Halls', 'Sanctum', 'Bastion', 'Remnant', 'Citadel'],
  tower: ['Tower', 'Spire', 'Watch', 'Pinnacle', 'Needle', 'Beacon'],
};

export function personName(rng, female) {
  const first = female ? rng.pick(F1) + rng.pick(F2) : rng.pick(M1) + rng.pick(M2);
  return first + ' ' + surname(rng);
}
export function surname(rng) {
  const a = rng.pick(SUR1); let b = rng.pick(SUR2);
  if (a.toLowerCase().endsWith(b[0])) b = rng.pick(SUR2);
  return a + b;
}
export function placeName(rng) {
  const a = rng.pick(PRE); let b = rng.pick(SUF);
  if (a.toLowerCase() === b || a[a.length - 1] === b[0]) b = rng.pick(SUF);
  return a + b;
}
export function locName(rng, type) {
  if (type === 'farm') return surname(rng) + ' ' + rng.pick(['Farm', 'Steading', 'Homestead', 'Croft', 'Acres']);
  if (type === 'castle') return rng.pick(['Castle ', 'Fort ', 'Hold of ', '', '']) + placeName(rng);
  if (DNOUN[type]) {
    const n = rng.pick(DNOUN[type]);
    const r = rng.next();
    if (r < 0.4) return 'The ' + rng.pick(DADJ) + ' ' + n;
    if (r < 0.7) return placeName(rng) + ' ' + n;
    return n + ' of ' + (rng.chance(0.5) ? rng.pick(M1) + rng.pick(M2) : rng.pick(F1) + rng.pick(F2));
  }
  return placeName(rng);
}
export function shopName(rng, type, owner) {
  const sur = owner.split(' ')[1];
  switch (type) {
    case 'inn': return 'The ' + rng.pick(ADJ) + ' ' + rng.pick(NOUN);
    case 'smithy': return rng.pick([sur + '\'s Smithy', 'The ' + rng.pick(['Ringing', 'Black', 'Red', 'Iron', 'Singing']) + ' Anvil', sur + ' Forgeworks']);
    case 'trader': return rng.pick([sur + '\'s Goods', sur + ' & Sons', 'The ' + rng.pick(ADJ) + ' Peddler', sur + '\'s Sundries']);
    case 'alchemist': return rng.pick([sur + '\'s Remedies', 'The ' + rng.pick(['Bubbling', 'Green', 'Bitter', 'Gilded']) + ' Flask', 'Herbs & Tinctures']);
    case 'arcanist': return rng.pick(['The ' + rng.pick(['Seventh', 'Silver', 'Hidden', 'Starry']) + ' Page', sur + '\'s Curios', 'The Wand & Scroll']);
    case 'guild': return rng.pick(['Adventurers\'', 'Wayfarers\'', 'Free Blades\'', 'Pathfinders\'']) + ' Guild';
    case 'church': return rng.pick(['Chapel', 'Church', 'Temple', 'Shrine']) + ' of the ' + rng.pick(['Dawn', 'Hearth', 'Nine Stars', 'Wanderer', 'Harvest', 'Silver Moon', 'Mother']);
    default: return null;
  }
}
