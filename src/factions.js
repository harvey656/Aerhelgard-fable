// Factions and their main mission chains: kingdoms (one per castle), guilds and churches.
import { RNG, hash2, clamp } from './rng.js';
import { GUILDS, FAITHS, KINGDOM_RANKS, RANK_REP, BIOMES, MONSTERS, INGREDIENTS, FORAGE } from './data.js';
import { G } from './state.js';
import { getLayout, clearLayout, citizensOf, clearCitizensOf, guildOf, faithOf, realmName } from './settlement.js';
import { personName } from './names.js';
import * as Q from './quests.js';
import { mkJewel, randomGear } from './items.js';
import * as I from './items.js';
import { SPELLS } from './data.js';

// ---------------------------------------------------------------------------------------------
// Mission scripts. Each is [title, briefing, steps, closing words].
// Steps: ['talk', who, words] ['deliver', who, item, words] ['fetch', tierLo, tierHi, item]
//        ['bounty', tierLo, tierHi, name] ['slay', count, monster?] ['gather', count, who?, words]
//        ['supply', stackPrefix, count, label, who?, words]
// {placeholders} are filled from the faction's surroundings: people, towns, rivals, dungeons.
// ---------------------------------------------------------------------------------------------
const KINGDOM = [
  ['The King\'s Writ', 'So you would serve the {realm}? Words are cheap. Carry this writ to {reeve} in {reeveT} and return with their mark. Do that much without losing it and we shall speak again.',
    [['deliver', 'reeve', 'King\'s Writ', 'The steward\'s seal... so the crown still remembers us. Tell {steward} the levy will be paid, though the roads have made it hard.']], 'The writ is marked. Good. You follow instructions, which is rarer than you would think.'],
  ['Teeth on the Royal Road', '{reeve} spoke true: the royal road is no longer safe, and a crown that cannot keep its own road is no crown at all. Thin the {mon} that hunt along it.',
    [['slay', 5]], 'The carters are moving again. {king} has been told a name - yours.'],
  ['The Marshal\'s Eyes', 'Our marshal, {marshal}, wants a pair of eyes that do not wear the king\'s colours. Speak with the marshal here in the castle, then go where you are sent.',
    [['talk', 'marshal', 'You are the one the steward found. Listen. Riders out of the {rival} have been seen near {borderT}. Go to {border} there and learn what they wanted. Quietly.'], ['talk', 'border', 'They came at dusk, a dozen, asking after the old boundary stones. They paid in {rival} silver and they were not merchants. Tell the marshal we are afraid.']],
    'Boundary stones. Then it begins the way these things always begin - with a map and a lie.'],
  ['A Matter of Fences', 'While we watch the border, our own people quarrel behind us. {elder1T} and {elder2T} both claim the same meadow and are a week from bloodshed. Hear both elders, then bring me the truth of it.',
    [['talk', 'elder1', 'That meadow was my grandmother\'s grazing. {elder2T} folk moved the fence in the wet season and think we did not notice.'], ['talk', 'elder2', 'Their grandmother SOLD it, for two cows and a kettle. I have the kettle still. Ask them what became of the cows.']],
    'A kettle. Kingdoms have fallen over less. The meadow will be common land, and both will hate me equally - which is how you know a ruling is fair.'],
  ['The Stolen Seal', 'The Royal Seal of the realm has been taken from the chancery. With it, a forger could cede half our border on paper. Our hunters tracked the thieves to {dun1}. Bring the seal back before it is used.',
    [['fetch', 1, 2, 'Royal Seal']], 'The seal, and unbroken. You may have just stopped a war with a walk in the dark.'],
  ['The Queen\'s Mercy', '{queen} has asked for you by name. A fever is burning through {elder1T}, and she will not see it ignored for the sake of border games. Attend her.',
    [['talk', 'queen', 'They tell me you get things done. The healers of {elder1T} need {herb}, and need it now. Gather it and take it to {elder1} yourself. I will remember who went.'], ['gather', 6, 'elder1', 'From the queen\'s own hand? Then we are not forgotten. The children will have it tonight.']],
    '{queen} speaks well of you, and she speaks well of very few. You have a friend at court now. Guard that.'],
  ['Envoy to a Rival', 'I am told you can be trusted, so I will trust you. I am {king}. The {rival} presses our border and I would rather buy peace than bury sons. Carry my terms to {rking} - and watch his face when he reads them.',
    [['deliver', 'rking', 'Sealed Terms', 'So {king} sends a wanderer instead of a lord. Clever - nobody to hang. Tell your king I never sent riders to his stones. Someone wishes us at each other\'s throats, and it is not I.']],
    'He denies the riders? And you believed him. ...So do I, damn it. Then there is a third hand in this.'],
  ['The Knife in the Court', 'A third hand, and it reaches from inside my own hall. {marshal} has found letters. Go to the marshal, then finish what the letters began.',
    [['talk', 'marshal', 'One of our own lords hired those riders and stole that seal, meaning to sell the border to whoever paid. He has fled to {dun2} with his sworn men. The king wants no trial.'], ['bounty', 2, 3, 'Lord {n} the Forsworn']],
    'It is done, then. I knew him thirty years. Leave me a moment.'],
  ['Muster at the Border', 'The traitor is dead but his poison is not: he promised the wild places to things that should not have been bargained with, and now they come to collect. Break them at the border and steady {border}.',
    [['slay', 7], ['talk', 'border', 'We saw you from the wall. Folk here will tell that story to their grandchildren. Tell the king {borderT} holds.']], 'The border holds. Both kingdoms watched you hold it, and that matters more than you know.'],
  ['The Crownless Dark', 'What the traitor woke has a master, and it has taken {dun3} for its hall. Neither my army nor {rking}\'s can reach it - but one blade might. End it, and name your reward.',
    [['bounty', 3, 4, '{n}, the Crownless']], 'Kneel. ...No. Stand. The {realm} has had lords enough who knelt. Rise, Lord Protector, and know that every door in my kingdom is open to you.'],
];

const BLADES = [
  ['Earnest Coin', 'Everyone who walks in here says they can fight. The Free Blades say: show us a finished contract. {reeve} of {reeveT} has posted coin for {mon} thinned out. Do it, and do exactly what was asked - no more.', [['slay', 4], ['talk', 'reeve', 'Done already? And you did not burn anything down. The last lot were not so tidy.']], 'A clean contract. That is all we are, when it comes to it.'],
  ['The Weight of a Word', 'A Blade who cannot be trusted with a purse cannot be trusted with a wall. Take the company\'s dues to {gm2} at our hall in {gm2T}. Every coin.', [['deliver', 'gm2', 'Company Dues', 'Every coin, and the seal unbroken. You would be surprised how many fail this one.']], 'You carried gold past every tavern between here and there. Welcome to the rolls.'],
  ['Steel for the Company', 'We are short of blades that are not notched to ruin. Bring iron for the armourer - the company remembers who equips it.', [['supply', 'ingot:0', 3, 'Iron Ingot', null, 'Good iron. This will be on someone\'s hip by week\'s end.']], 'A company marches on its stores. You understand that. Many do not.'],
  ['A Client Gone Quiet', 'A merchant who hired us for escort never came to collect his guards. He was last seen heading for {dun1} after something he had lost. Find what he was after - it may tell us what became of him.', [['fetch', 1, 2, 'Merchant\'s Strongbox']], 'His strongbox, and inside... a single black candle-stub. That is a Night Lantern mark. They killed our client.'],
  ['The Black Wick', 'A Lantern mark on a dead client. That is not theft - that is a message. Ask {inn} what has been said in the taproom. Innkeepers hear everything.', [['talk', 'inn', 'Lantern folk? Aye. Two of them sat right there, cheerful as you like, saying no one would hire the Blades once their clients kept turning up dead.']], 'So that is the game. They cannot outfight us, so they will make our word worthless. Then it is war, of a kind.'],
  ['Under Guard', 'If they are killing our clients, we guard our clients. {trader} has a consignment the Lantern wants gone. See it safely into the hands of {reeve2} in {reeve2T}.', [['talk', 'trader', 'You are the Blade? Thank the stars. Take it and go, and do not tell me which road.'], ['deliver', 'reeve2', 'Guarded Consignment', 'It arrived? Then the Blades\' word still holds. I had begun to doubt.']], 'Delivered, and the client alive to pay. Let the Lantern choke on that.'],
  ['The Hired Knives', 'The Lantern does not dirty its own hands. It has been paying cut-throats out of {dun2} to do its killing. Empty that nest and bring down whoever leads it.', [['bounty', 1, 2, '{n} Red-Hand']], 'One less knife for hire. They will find others. But they will pay more for them now.'],
  ['Words with the Enemy', 'I want to look at them. Go to the Lantern House in {rgmT} and tell {rgm} the Free Blades know. Say it to their face. Then walk out - they will not touch a Blade under their own roof.', [['talk', 'rgm', 'The Blades send a messenger to threaten me? How direct. Tell your master we did not kill his merchant. Ask yourself who gains when Blade and Lantern bleed each other.']], 'They deny it. Of course they deny it. ...But {rgm} has never bothered to lie to me before.'],
  ['Blood on the Ledger', 'Our own paymaster has been asking strange questions about where the patrols ride. I do not like it. Fetch the old contract ledgers from the vault we keep at {dun3} - I want to see what has been altered.', [['fetch', 2, 3, 'Company Ledgers']], 'Pages cut out. Contracts we never took, signed in our name. Someone inside is selling the Blades\' word.'],
  ['The Paymaster', 'The ledgers name him. Our paymaster ran when he heard you had gone for them, and he has gone to ground with the men he bought. He took the company\'s oath. Collect on it.', [['bounty', 2, 3, 'Paymaster {n}']], 'He was Lantern-bought? No... look at this. These payments are not Lantern coin. Somebody else has been buying my company.'],
  ['The Founder\'s Oath', 'When the company was founded, the first captain swore the oath on a blade and buried it so it could never be carried in a broken contract. We need it now. It lies in {dun4}.', [['fetch', 2, 3, 'Oath-Blade of the First Captain']], 'The Oath-Blade. Every Blade will see this and remember what we are. You have given the company its spine back.'],
  ['Reforging the Roll', 'I am striking every bought name from the roll and I need the other halls with me. Carry the Oath-Blade\'s rubbing to {gm2} and {gm3}, and bring back their answer.', [['talk', 'gm2', 'The Oath-Blade, found? Then I am with you. Strike the names.'], ['talk', 'gm3', 'I had three of them in my own hall. They are already gone. Tell the captain: {gm3T} stands.']], 'Both halls. Then the Free Blades are one company again.'],
  ['The Price of Roads', 'A company needs work, and the crown has it. Speak with {steward} at the castle - a royal charter to keep the roads would put the Blades beyond anyone\'s power to buy.', [['talk', 'steward', 'A charter for sellswords? The king will ask what the Blades have done lately that was not for coin. Clear the royal road and I will carry your petition.'], ['slay', 6]], 'The steward will carry it. A royal charter. My old captain would have wept.'],
  ['An Unlikely Lantern', 'A message, under our door, sealed with a black wick: the Lantern wants to talk, and they asked for you. I do not trust it. Go anyway.', [['talk', 'rgm', 'You came. Good. We have been hunted by the same hand that bought your paymaster. A broker of contracts who calls himself the Quartermaster. He wants one company of killers in this land - his. Here is where his gold is counted.']], 'The Quartermaster. I have heard that name whispered since I was a hireling. I thought he was a tale.'],
  ['The Counting Room', 'The Lantern gave us a place: {dun5}. If the Quartermaster\'s books are there, we will know every man he owns. Bring them out.', [['fetch', 3, 4, 'Quartermaster\'s Books']], 'Captains. Reeves. A lord or two. He has been building an army out of other people\'s oaths.'],
  ['Calling the Banners', 'We cannot fight an army with a hall. Go to {reeve} and {reeve2} - towns that owe the Blades their roads. Ask them plainly whether they stand with us.', [['talk', 'reeve', 'You kept our roads when no one else would. {reeveT} stands with the Blades.'], ['talk', 'reeve2', 'The Quartermaster\'s men offered us protection too. Their kind of protection. We will stand with you.']], 'They stood. That is what a kept word buys you, in the end.'],
  ['The Bought Company', 'His hired host is gathering in the wilds, and they are not waiting. Break them before they march - every one you put down is one who cannot reach our walls.', [['slay', 8, 'bandit']], 'Broken and scattered. Sellswords fight for pay, and you have made the pay look very poor.'],
  ['The Captain\'s Wound', 'They got to me. A blade in the dark, on my own stair - no, do not fuss. I need a healer\'s draughts and I need the company not to know how bad it is.', [['supply', 'p:heal', 2, 'Potion of Restore Health', null, 'That takes the edge off. ...You could have let me die and taken the hall. It did not even occur to you, did it.']], 'I will live. And I have decided who leads the last contract.'],
  ['The Long Contract', 'One contract left, and it is the oldest kind: someone has wronged us and we are owed. The Lantern has found his hall in {dun6}. Take the Oath-Blade\'s blessing and end the Quartermaster.', [['bounty', 3, 5, 'The Quartermaster']], 'It is finished. Every oath he bought is void.'],
  ['Blademaster', 'There is one thing left. Carry word to {rgm} that the debt between Blade and Lantern is settled - and then come back, because the company has voted.', [['talk', 'rgm', 'Settled, then. Tell your company that the Night Lantern remembers who came when we asked. We will not undercut a Blade\'s contract again.']], 'The roll was unanimous. You kept every contract you ever took for us. Take the hall\'s blade - Blademaster.'],
];

const PAGE = [
  ['The First Lesson', 'You wish to join the Circle? Then learn its first lesson: nothing is known until it is checked. {alch} claims a herb the books say does not grow here. Go and ask to see it.', [['talk', 'alch', 'The Circle doubts me? Ha. Here - smell that. Your books are two hundred years stale. Tell them so.']], 'The books were wrong? Splendid! Now we know one more true thing than we did this morning. That is the whole of our creed.'],
  ['Ink and Vellum', 'We copy every text we find so that no fire can unmake it, and copying eats supplies. Bring {herb} for the ink-makers.', [['gather', 5, null, 'Fresh, too. The scriptorium will be at it till dawn.']], 'A copied book is a book that cannot be lost. You have helped us save a few today.'],
  ['The Seven Pages', 'Now you should know what we are for. The First Grimoire was torn into seven pages and scattered, so that no one mage could hold it. We mean to gather it and copy it for all. The first page was traced to {dun1}.', [['fetch', 1, 2, 'First Page of the Grimoire']], 'The first page. Look how the ink moves when you are not quite looking. Six remain.'],
  ['A Second Hand', 'Our sister hall in {gm2T} has a fragment of the index - it tells which page lies where. Carry our greetings to {gm2} and bring back what they have learned.', [['talk', 'gm2', 'The index speaks of a page kept "where the dead keep their own counsel". And beware - we are not the only ones reading it.']], 'Not the only ones. I had feared as much.'],
  ['Where the Dead Keep Counsel', 'The index points to {dun2}. Bring the second page out before whoever else is reading over our shoulder.', [['fetch', 1, 2, 'Second Page of the Grimoire']], 'Two. And you were followed? By someone with a merchant\'s badge. The Gilded Scale.'],
  ['The Price of a Page', 'The Gilded Scale would sell a page of the Grimoire to the highest bidder and call it commerce. Ask {trader} what the Scale has been offering for old vellum.', [['talk', 'trader', 'For old spell-pages? A fortune. The Scale has a buyer who wants all seven and does not care who is selling.']], 'One buyer, for all seven. That is not commerce. That is someone assembling the Grimoire in private.'],
  ['A Page for Sale', 'A third page has surfaced in the Scale\'s hands, and they will auction it. We do not steal - but its courier was robbed on the road and the page lies in a den at {dun3}. Finders are keepers.', [['fetch', 2, 3, 'Third Page of the Grimoire']], 'Three pages. The Scale will say we stole it. Let them prove we were not simply quicker.'],
  ['An Embargo of Letters', 'They have answered: no Scale trader will sell the Circle so much as a candle. Go to their counting-house in {rgmT} and remind {rgm} that the Circle teaches half their clerks to read.', [['talk', 'rgm', 'The Circle sends a threat dressed as a courtesy. We have a contract for seven pages and the Scale honours its contracts. Stand aside, scholar.']], 'They will not stand down. Then we must simply reach the other four first.'],
  ['The Unlettered', 'While we chase pages, remember why. {reeve2} of {reeve2T} asked for a teacher and we had none to send. Carry these primers there yourself.', [['deliver', 'reeve2', 'Crate of Primers', 'Books? For our children? No one has ever... tell the Circle that {reeve2T} will not forget this.']], 'That is the Circle\'s real work. The Grimoire is only the largest book we mean to share.'],
  ['The Drowned Stacks', 'The fourth page was in a library that the earth swallowed. What is left of it is called {dun4} now. Mind the things that have moved in.', [['fetch', 2, 3, 'Fourth Page of the Grimoire']], 'Four. More than half. The pages have begun to whisper to each other at night - do not tell the apprentices.'],
  ['The Buyer\'s Hound', 'The Scale\'s buyer has stopped bidding and started hunting. A sorcerer in their pay has been burning our messengers out of {dun5}. Stop him.', [['bounty', 2, 3, '{n} the Page-Burner']], 'He carried a letter. It is signed only "the Reader". And it lists the three pages we do not have.'],
  ['What the Reader Knows', 'The Reader knows where the last pages are. So should we. {arcan} dealt in such things before joining us in spirit, if not in name. Ask what they know of the Reader.', [['talk', 'arcan', 'The Reader? I sold to him once. He never touched the books - he had them read aloud, and wept. He was Circle, long ago. Before your master\'s time.']], 'One of ours. An old member, trying to do alone what we swore to do together.'],
  ['The Fifth Page', 'The Reader\'s own notes place the fifth page in {dun6}. He has not gone for it himself. I wonder what he is afraid of.', [['fetch', 3, 4, 'Fifth Page of the Grimoire']], 'Five. And now I understand his fear - read this margin. "Whoever holds the seventh, holds the others."'],
  ['A Truce of Convenience', 'If the seventh page commands the rest, the Scale is being used as surely as we are. Go to {rgm} again. This time, bring them the Reader\'s letter.', [['deliver', 'rgm', 'The Reader\'s Letter', 'He means to cheat us of... no. He means to cheat everyone. The Scale does not like being a tool. Our sixth page is yours - it sits in our vault and frightens the clerks.']], 'They gave you the sixth page? Freely? Mark the day: the Gilded Scale has given something away.'],
  ['The Sixth Page', 'The Scale\'s vault was emptied in the night. The Reader has taken the sixth page to {dun7} and left his servants to guard the way.', [['fetch', 3, 4, 'Sixth Page of the Grimoire']], 'Six, in our hands. Then he holds only the seventh. And if the margin is true, that is enough.'],
  ['Wards and Wax', 'When he calls, the pages will try to go to him. We need warding-wax and a great deal of it. Bring what the alchemists call {herb} - quickly.', [['gather', 7, null, 'It will have to be enough. Seal the reading-room.']], 'The wards are set. The pages rattle in their case like teeth.'],
  ['The Circle Entire', 'Every hall must hold its pages at the same hour or the wards fail. Carry the hour to {gm2} and {gm3}. Do not write it down.', [['talk', 'gm2', 'The hour is known. {gm2T} will hold.'], ['talk', 'gm3', 'So it comes to this. We will hold. Tell them an old magister is proud to have seen it.']], 'All three halls. The Circle has not acted as one in a century.'],
  ['The Reader\'s Servants', 'He is drawing things to him to break our wards from outside. They gather thick in the wilds. Thin them, or the halls will not last the night.', [['slay', 8]], 'The wards held. Barely. He will not try that again - he will come for the pages himself, or call us to him.'],
  ['The Seventh Page', 'He has called. The Reader waits in {dun8} with the seventh page, and he has asked for the one who gathered the others. He was one of us. Remember that - and do not let it stay your hand.', [['bounty', 4, 5, 'The Reader']], 'He is gone, and the seventh page... is blank. It was always blank. It is the page the reader writes.'],
  ['Master of Pages', 'Seven pages, and a choice the Circle has waited three hundred years to make. We will copy them - all of them - and send a copy to every hall and every school that asks. Carry the first copy to {reeve2}\'s school yourself.', [['deliver', 'reeve2', 'First Copy of the Grimoire', 'For the school? The whole of it? ...The children will not know what this cost. I will make sure they are told.']], 'Then it is done, and cannot be undone: the Grimoire belongs to everyone. The Circle names you Master of Pages.'],
];

const SCALE = [
  ['A Fair Weight', 'The Gilded Scale asks only one thing of a new porter: that what leaves our hands arrives. Take this consignment to {reeve2} in {reeve2T}.', [['deliver', 'reeve2', 'Sealed Consignment', 'All here, and the seals whole. The Scale\'s weight is fair, as they say.']], 'Delivered. Nothing lost, nothing skimmed. You would be amazed how rare that is.'],
  ['Short Measure', 'Our iron comes up short every month and the smiths are grumbling. Bring ingots to cover the shortfall while I find out who is thieving.', [['supply', 'ingot:0', 3, 'Iron Ingot', null, 'That closes the gap. Now, who opened it?']], 'The contracts are met. A broken contract costs more than any ingot.'],
  ['The Open Road', 'A road is only worth what can travel it. {mon} have closed ours. Open it.', [['slay', 5]], 'The carts are rolling. Every coin they carry, the Scale touches twice.'],
  ['A Word with the Smith', 'I want the smith\'s whole output under contract. Speak to {smith}; tell them the Scale pays on the day, every day.', [['talk', 'smith', 'Paid on the day? The last buyers paid when they felt like it. Aye, tell the Scale they have my forge.']], 'The forge is ours - fairly bought. That is how influence is built: one honest contract at a time.'],
  ['The Missing Caravan', 'A whole caravan gone, and no ransom asked. Thieves ask for ransom. Its strongbox was traced to {dun1} - fetch it and let us see what was worth more than gold.', [['fetch', 1, 2, 'Caravan Strongbox']], 'The coin is untouched. Only the enchanted goods are gone. Someone wanted those, and only those.'],
  ['The Circle\'s Shadow', 'Enchanted goods vanish, and the Circle of the Seventh Page preaches that magic should not be sold. Go to their hall in {rgmT} and ask {rgm} to their face.', [['talk', 'rgm', 'You accuse the Circle of robbing caravans? We object to your prices, merchant, not to your existence. Look to whoever is buying what was taken.']], 'They deny it, and loudly. Scholars are poor liars. Perhaps it is not them.'],
  ['Follow the Coin', 'Stolen goods must be sold. {trader} hears every offer in the district - ask who has been selling charms cheap.', [['talk', 'trader', 'Cheap charms? Aye, a fellow with a counterfeit Scale badge. Good counterfeit, too. Said he worked for "the true Scale".']], 'A counterfeit badge. Someone is trading under our name.'],
  ['False Weights', 'If there are false badges there are false ledgers. Our old records are kept at {dun2}, out of reach of fire. Bring them, and I will find the first forged entry.', [['fetch', 2, 3, 'Founding Ledgers']], 'Here. Eleven years of false entries, all in one hand. We have had a second Scale living inside the first.'],
  ['The Charter', 'A forged Scale is only dangerous while ours has no charter. Go to {steward}. Offer the crown a tenth of our tolls for a royal seal.', [['talk', 'steward', 'A tenth of the tolls? The king will want the roads kept as well. Show us you can keep them and the charter is yours.'], ['slay', 6]], 'A royal charter. Now anyone trading under a false badge is a criminal, not a rival.'],
  ['The Bought Road', 'They have answered by buying a town. {reeve} is being offered three times our rate. Go and remind them what the Scale has done for {reeveT}.', [['talk', 'reeve', 'Three times your rate, yes. And I asked them where the goods come from, and they smiled. I will stay with the Scale. I know where your goods come from.']], 'Kept, and by trust rather than price. Remember that. Price can always be beaten.'],
  ['The Counterfeiter', 'Their badges are struck by one man, and we have found his shop in {dun3}. Shut it.', [['bounty', 2, 3, '{n} the Coiner']], 'His dies are broken. And his orders came on fine paper, signed with a crown drawn in gilt. "The Counterfeit King".'],
  ['Friends in Low Places', 'To find a smuggler, ask the people who watch smugglers. The Circle hates us, but they hate the black-market trade in spells more. Bring this offer to {rgm}.', [['deliver', 'rgm', 'Offer of Truce', 'The Scale offers to open its books to us? ...Very well. A man styling himself a king buys forbidden pages by the cartload. We know where his agents meet.']], 'Scale and Circle on the same side. The realm must truly be in danger.'],
  ['The Hungry Winter', 'While we chase shadows, {elder1T} has had a failed harvest and the false Scale is selling them grain at ruin\'s price. Bring them bread at ours - at cost.', [['supply', 'm:bread', 6, 'Bread', 'elder1', 'At cost? The other traders wanted our seed-corn. The Scale has {elder1T}\'s custom for a generation.']], 'We lost coin today and bought a village\'s loyalty for life. That is the best trade I have made all year.'],
  ['The Agents\' Meet', 'The Circle named a place: {dun4}. The Counterfeit King\'s agents keep their accounts there. I want those accounts.', [['fetch', 3, 4, 'Smugglers\' Accounts']], 'Every route. Every bribed gatekeeper. He has built a whole shadow of our network, stitch for stitch.'],
  ['Closing the Gates', 'His network runs on bribed gates. Ours runs on honest reeves. Carry his accounts to {reeve2} and {reeve3} and let them see their own gatekeepers\' names.', [['talk', 'reeve2', 'My own gate-sergeant. On this list. He will be in irons before you reach the road.'], ['talk', 'reeve3', 'So that is why the tolls never added up. The gates are shut to them.']], 'Two towns closed to him in a day. He will feel that.'],
  ['The Smugglers\' Road', 'Shut out of the towns, his people have taken to the wilds with their goods. Catch them on the road.', [['slay', 8, 'bandit']], 'His caravans are scattered. A merchant without a road is only a man with a full warehouse.'],
  ['A King\'s Ransom', 'He has sent an offer: a fortune, for us to look away. I should like to send an answer in person. Take it to his envoy - they are lodged with {inn}.', [['talk', 'inn', 'The envoy? Left before dawn, white as milk, when he heard who was coming. Left this behind, though - a map, with a tower marked.']], 'He runs. And he has left us a map. I do believe he is frightened of you.'],
  ['The Last Shipment', 'Before we go for him: he has one last cargo, enchanted goods enough to arm a war. It sits in {dun5}. Take the proof of it.', [['fetch', 3, 4, 'Manifest of the Last Shipment']], 'Enough to arm a war. So that was the plan - not to rob the realm, but to sell it one.'],
  ['The Counterfeit King', 'It ends in {dun6}. He has no charter, no roads and no gates left - only his hall. Close the account.', [['bounty', 4, 5, 'The Counterfeit King']], 'The account is closed. In full.'],
  ['Master of Coin', 'One last piece of business. The goods we recovered belong to people who were robbed. We are giving them back, and you will carry the first to {elder1}.', [['deliver', 'elder1', 'Restored Goods', 'Returned? By a merchant? I thought I knew how the world worked. Tell the Scale that {elder1T} toasts its name.']], 'Given back, not sold. The syndics voted, and not one hand was against you. The Gilded Scale names you Master of Coin.'],
];

const LANTERN = [
  ['A Listening Ear', 'You found the door, which is the first test. The second: go to {inn} and come back with something worth knowing. Not gossip. Something that matters.', [['talk', 'inn', 'Something that matters? ...The reeve\'s clerk has been drinking with strangers and paying in new-minted coin. Is that the sort of thing?']], 'A clerk with new coin. Yes, that is exactly the sort of thing. You have the ear for it.'],
  ['The Dead Drop', 'We do not send letters. We leave them. Carry this to {gm2} in {gm2T} and hand it over without a word about what it is.', [['deliver', 'gm2', 'Unmarked Packet', 'You were not followed? Good. And you did not open it, or you would be dead. Welcome to the Lantern.']], 'It arrived unopened. You would be surprised how few can stand to carry a secret they do not know.'],
  ['Quiet Hands', 'A light is no use to those who cannot open the door behind it. We are short of picks. Bring them.', [['supply', 'm:lockpick', 4, 'Lockpick', null, 'These will open a few doors that were better left open in the first place.']], 'Good. A locked door is just a secret somebody is embarrassed by.'],
  ['The Clerk\'s New Coin', 'Your clerk has been selling the patrol routes. The buyer keeps his letters in {dun1}. We do not want the buyer - yet. We want the letters.', [['fetch', 1, 2, 'Bundle of Letters']], 'Patrol routes, sold by the week. Somebody is planning to move something large down a road nobody is watching.'],
  ['A Word in the Right Ear', 'This is what we are for. Take what we have learned to {reeve}. No names, no price. Simply see that the right person knows.', [['talk', 'reeve', 'Who sent you? ...No. I will not ask. The patrols change tonight. Whoever you serve, thank them.']], 'A raid that will now never happen, and no one will ever know why. That is a good night\'s work.'],
  ['The Blades\' Accusation', 'The Free Blades are telling the taverns that we murdered their client. We did not. Go to their hall in {rgmT} and tell {rgm} so - they respect people who walk in the front door.', [['talk', 'rgm', 'A Lantern, under my roof, by daylight. You have nerve. If you did not kill him, then prove who did, and I will call off my company.']], 'Prove who did. Fair. Sellswords are simple that way - it is almost restful.'],
  ['The Hand That Snuffs', 'Three of our own have vanished, each on the night of a new moon, each lamp left burning. Someone is hunting us from inside. The last of them was watching {dun2}.', [['fetch', 2, 3, 'Watcher\'s Journal']], 'Her journal. The last line: "It is one of the Keepers. I saw the lantern." One of our own masters.'],
  ['Counting Keepers', 'There are three Keepers besides me. Go to {gm2} and {gm3}. Do not accuse. Simply tell each that the others are dead, and watch.', [['talk', 'gm2', 'Dead? All of them? ...No. You are testing me. Good. I would have done the same. It is not I.'], ['talk', 'gm3', 'Then I am next, and I am too old to run. Tell whoever sent you to hurry.']], 'Neither flinched the wrong way. Then it is the third Keeper - the one who trained me.'],
  ['The Snuffer\'s Friends', 'He has not been working alone. The cut-throats who killed the Blades\' client answer to him. They lair in {dun3}. End their captain and bring me his purse.', [['bounty', 2, 3, '{n} Quiet-Knife']], 'His purse, and inside it, our own coin - Lantern silver. He paid them with the guild\'s money to start a war with the Blades.'],
  ['Proof for the Blades', 'This is what {rgm} asked for. Take the purse to the Blades and let them count our silver in a murderer\'s pay.', [['deliver', 'rgm', 'Purse of Lantern Silver', 'Your own Keeper. To set us on each other and pick the bones. ...The Free Blades withdraw the accusation. And if you need swords for what comes next, ask.']], 'The Blades stand down. He wanted us at war so no one would be listening when he made his move.'],
  ['What He Was Hiding', 'Every secret the Lantern ever kept is written once, in one book, and he has taken it. With that book he could own every lord in the realm. It was carried to {dun4}.', [['fetch', 3, 4, 'The Black Ledger']], 'The Black Ledger. Do not open it. I never have.'],
  ['Light the Lamps', 'He will come for the ledger with everything he has. The wilds are full of his hirelings tonight. Put out as many as you can.', [['slay', 8]], 'Quiet again. He has spent his hirelings. Now he has only himself.'],
  ['The Snuffer', 'He taught me that a secret is a debt. Go to {dun5} and collect. Do not listen to anything he says - he is very good at being listened to.', [['bounty', 3, 5, 'The Snuffer']], 'It is over. He told you things, did he not? Keep them. That is the trade.'],
  ['Master of Lanterns', 'The Black Ledger is too dangerous to keep and too dangerous to burn in secret. So it burns in public. Take word to {reeve} that the Lantern is ending its oldest debts - and let them watch.', [['talk', 'reeve', 'Burned? Every secret? Then half the realm will sleep tonight for the first time in years. Who are you people?']], 'Ashes. We will go on keeping watch, but we will hold no one\'s leash. The Keepers have chosen: you carry the first lamp now, Master of Lanterns.'],
];

const DAWN = [
  ['First Light', 'You wish to walk with the Dawn? Then begin where every seeker begins - with a question. Ask {acolyte} what the First Candle was, and listen to the answer.', [['talk', 'acolyte', 'In the longest night, one woman lit a candle and would not let it go out, and carried it from house to house till morning. We are what she started.']], 'A candle carried from house to house. Everything else we teach is a footnote to that.'],
  ['The Dawn-Speaker', 'Our faith is led from {highT}. Go and receive the blessing of {high} - and bring this candle, lit from ours, as every seeker does.', [['deliver', 'high', 'Lit Candle', 'A new flame from an old one. Be welcome. I will tell you what I tell everyone: the Dawn does not need believers. It needs people who carry light.']], 'You have met the Dawn-Speaker. Few forget it.'],
  ['Candles for the Poor', 'Light is to be shared. The sick-house needs tallow and healing draughts and the church has neither. Bring what you can.', [['supply', 'p:heal', 2, 'Potion of Restore Health', null, 'These will be in use within the hour. The Dawn sees it, whether or not anyone else does.']], 'Given without asking what you would get. You are beginning to understand.'],
  ['The First Candlestick', 'The candle is long burned, but the stick that held it survives - or did. It was hidden in {dun1} when the old chapels fell. Bring it home.', [['fetch', 1, 2, 'The First Candlestick']], 'Plain iron. People always expect gold. She was a tallow-maker\'s daughter.'],
  ['The Saint of Ashes', 'There is a tale we do not tell seekers. One of our saints carried his light into {dun2} to burn out a darkness, and never returned. His reliquary lies there. It is time it was recovered.', [['fetch', 2, 3, 'Reliquary of Saint {n}']], 'It is empty. The reliquary is empty. Then he did not die there.'],
  ['A Light That Burns', 'Pilgrims are coming back from the old roads scorched and raving of a "second dawn". Speak with {priest2} in {priest2T} - they have been tending them.', [['talk', 'priest2', 'They say a shining man told them the Dawn has grown soft, that light should burn the unworthy. He had our saint\'s face. I have seen the icons.']], 'Our own saint. Not fallen to darkness - fallen to light, without mercy. That is worse.'],
  ['The Scorched', 'He has followers now, and they are burning the "unworthy" out of the wilds - beast and traveller alike. Stop them. Gently, if any can be saved; if not, quickly.', [['slay', 7]], 'It is grim work. But a faith must answer for what grows from it.'],
  ['The Second Dawn', 'He waits in {dun3}, and he believes he is right. That is the whole horror of it. Carry the First Candlestick with you - and remember that mercy was the point.', [['bounty', 3, 5, 'The Ashen Saint']], 'He is at rest. We made him, with a doctrine that forgot to mention kindness, and you have unmade our error. Rise, Master of the Dawn - and help us teach it better.'],
];
const MOON = [
  ['The Turning Tide', 'The Moon asks nothing of you tonight but attention. Sit with {acolyte} and learn the four tides: the waxing, the full, the waning and the dark.', [['talk', 'acolyte', 'Waxing is for beginning. Full is for doing. Waning is for letting go. And the dark is for rest - never for fear. Remember the last one. People forget it.']], 'Four tides. Most who come to us only wanted three.'],
  ['The Veiled One', 'Our Veiled One keeps the great temple at {highT}. Go and be seen - carry this bowl of tide-water as the offering.', [['deliver', 'high', 'Bowl of Tide-Water', 'Not a drop spilled. You are patient. That is the only virtue the Moon truly requires.']], 'You have stood before the Veil. Good.'],
  ['Night-Blooming', 'Our rites need a flower that opens only by moonlight. Gather {herb} for the next full tide.', [['gather', 6, null, 'Picked at the right hour, too. Someone taught you well, or you listened well.']], 'The rite will be kept. One more month in which the tides are honoured.'],
  ['The Mirror of Tides', 'We once kept a silver mirror that showed the moon\'s true face on any night. It was lost in {dun1} when the temple there was abandoned. Bring it back to us.', [['fetch', 1, 2, 'Mirror of Tides']], 'The Mirror. Look - no. Do not look tonight. The moon is nearly dark.'],
  ['The Crescent Blade', 'The Mirror shows something we did not expect: a second relic, a sickle of moon-silver, in {dun2}. And it shows hands already reaching for it.', [['fetch', 2, 3, 'Crescent Sickle']], 'You reached it first. Those others wore our veils, turned inside out. A heresy we thought was dead.'],
  ['The Eclipse Cult', 'They call themselves the Eclipsed. They teach that the dark tide should never end - that the moon should be put out. {priest2} in {priest2T} has been hiding those who fled them. Hear what they know.', [['talk', 'priest2', 'They need both relics, and a moonless night. With mirror and sickle they mean to cut the moon\'s reflection out of the world. I do not know if it can be done. I do not want to find out.']], 'An enemy that rose against our faith by wearing its clothes. The dark tide is for rest. They have made it a grave.'],
  ['The Dark of the Moon', 'They have gathered in {dun3} under their Hierophant, and the moon is dark tonight. Take the sickle. It was made for exactly one harvest.', [['bounty', 3, 5, 'The Eclipsed Hierophant']], 'The moon is rising. Thin as a thread - but rising. The tides turn because of you. Rise, Master of Tides.'],
];
const HEARTH = [
  ['A Place at the Fire', 'You are welcome here. That is the whole of the first teaching. Sit with {acolyte}, eat, and let them tell you why our door has no lock.', [['talk', 'acolyte', 'The Mother turned no one from her fire - not the thief, not the leper, not the man who had wronged her. So we have no lock. It has cost us, some years. We keep it anyway.']], 'A door with no lock. It is the hardest teaching we have.'],
  ['The Flamewarden', 'The eldest fire of our faith burns at {highT}, kept by {high}. Carry an ember from our hearth to theirs, as guests have always done.', [['deliver', 'high', 'Banked Ember', 'Still warm. Every hearth of the Mother is one fire, carried. Now you have carried it too.']], 'You have fed the eldest fire. You are no longer a guest. You are kin.'],
  ['Bread for the Door', 'We feed whoever knocks, and this winter many are knocking. Bring bread. As much as you can carry.', [['supply', 'm:bread', 6, 'Bread', null, 'It will be gone by nightfall. That is as it should be.']], 'No one was turned away today. That is the only measure we keep.'],
  ['The Mother\'s Kettle', 'Our oldest relic is a cooking pot. Do not laugh - it fed a village through a siege. It was carried into {dun1} to keep it from raiders, and never brought back.', [['fetch', 1, 2, 'The Mother\'s Kettle']], 'Dented, and black as sin. It is the holiest thing we own.'],
  ['The Empty Villages', '{elder1} of {elder1T} sends word that the fields are failing though the weather is fair. Go and see.', [['talk', 'elder1', 'It is not blight. The grain grows and is hollow. The bread rises and does not fill. And folk have started barring their doors at night - against a woman who knocks, asking to come in.']], 'A woman who knocks. Hollow bread. There is an old, old story about what the Mother cast out of her house.'],
  ['The Hearthstone', 'What was cast out can only be faced with what cast it out: the Mother\'s own hearthstone, buried in {dun2}. We need it.', [['fetch', 2, 3, 'Hearthstone']], 'Still warm, after a thousand years. Then the story is true - all of it.'],
  ['The Hollow Ones', 'Those who let her in become like her: always hungry, never filled. They wander the wilds now. Give them rest, and keep them from the villages.', [['slay', 7]], 'Rest, at last, for them. The Mother grant we were quick enough.'],
  ['The Unwelcome Guest', 'She is the one guest the Mother ever turned away: hunger itself, that takes and is never grateful. She has made {dun3} her house. Carry the hearthstone in, and close the door on her.', [['bounty', 3, 5, 'The Hollow Mother']], 'The bread fills again. You did what the Mother did, and it cost you as it cost her. Rise, Master of the Hearth - and come in. There is a place kept for you.'],
];
const SCRIPTS = { blades: BLADES, page: PAGE, scale: SCALE, lantern: LANTERN, dawn: DAWN, moon: MOON, hearth: HEARTH };

// ---------------------------------------------------------------------------------------------
export function factionDef(fid) {
  if (fid.startsWith('k:')) { const C = G.world.locs[+fid.slice(2)], name = realmName(G.world, C); return { id: fid, type: 'kingdom', name, ranks: KINGDOM_RANKS, missions: KINGDOM, seat: C, boon: ['questGold', 0.15, '+15% quest gold'], ideal: 'The ' + name + ' is ruled from ' + C.name + '. Its crown keeps the roads, settles the quarrels of its people and guards its borders against its neighbours.' }; }
  if (GUILDS[fid]) return Object.assign({ id: fid, type: 'guild', missions: SCRIPTS[fid] }, GUILDS[fid]);
  return Object.assign({ id: fid, type: 'church', missions: SCRIPTS[fid] }, FAITHS[fid]);
}
export function fstate(fid) { const f = G.save.factions; return f[fid] || (f[fid] = { rep: 0, done: 0 }); }
export function rankOf(fid) { const st = fstate(fid), def = factionDef(fid); if (st.done >= def.missions.length) return 5; let r = 0; for (let i = 1; i < RANK_REP.length; i++) if (st.rep >= RANK_REP[i]) r = i; return r; }
export const rankReq = (def, idx) => Math.min(4, Math.floor(idx * 5 / def.missions.length));
export function knownFactions() { return Object.keys(G.save.factions).filter((f) => { const s = G.save.factions[f]; return s.rep > 0 || s.done > 0 || s.met; }); }
// Which faction, if any, this citizen speaks for
export function leads(c, L) {
  if (L.type === 'castle' && (c.role === 'steward' || c.role === 'king')) return 'k:' + L.id;
  if (c.role === 'Guildmaster') return guildOf(L);
  if (c.role === 'Priest') return faithOf(L);
  return null;
}
export function activeMain(fid) { return G.save.quests.find((q) => q.main && q.faction === fid && q.state === 'active'); }

const BIG = (l) => l.type === 'town' || l.type === 'city' || l.type === 'castle';
function tgt(L, b, c, title) { return { id: c.id, name: c.name, loc: L.id, b: b.i, title }; }
function keeper(L, type, i = 0) { const b = getLayout(G.world, L).buildings.find((x) => x.type === type); if (!b) return null; const cs = citizensOf(L, b); return cs[i] ? tgt(L, b, cs[i]) : null; }
function headOf(L) { const lay = getLayout(G.world, L), b = lay.buildings.find((x) => x.type === 'house' || x.type === 'farmhouse') || lay.buildings[0], c = citizensOf(L, b)[0]; return tgt(L, b, c, (L.type === 'village' || L.type === 'farm' ? 'Elder' : L.type === 'town' ? 'Reeve' : 'Mayor') + ' of ' + L.name); }
function court(C, role, title) { const b = getLayout(G.world, C).buildings.find((x) => x.type === 'castle'), c = citizensOf(C, b).find((x) => x.role === role); return tgt(C, b, c, title); }

function person(ctx, key) {
  if (ctx.people[key]) return ctx.people[key];
  const W = G.world, H = ctx.home, near = (pred, n) => W.nearest(H.x, H.z, pred, n), C = W.locs[H.realm];
  let p = null;
  const other = (pred, i) => { const l = near((x) => x !== H && pred(x), i + 1)[i]; return l; };
  switch (key) {
    case 'reeve': p = headOf(BIG(H) ? H : near(BIG, 1)[0]); break;
    case 'reeve2': case 'reeve3': p = headOf(other(BIG, key === 'reeve2' ? 0 : 1)); break;
    case 'elder1': case 'elder2': { const B = ctx.border || H, l = W.nearest(B.x, B.z, (x) => x.type === 'village' && x !== H, 2)[key === 'elder1' ? 0 : 1]; p = headOf(l); break; }
    case 'border': p = headOf(ctx.border || other(BIG, 0)); break;
    case 'smith': p = keeper(BIG(H) ? H : near(BIG, 1)[0], 'smithy'); break;
    case 'trader': p = keeper(BIG(H) ? H : near(BIG, 1)[0], 'trader'); break;
    case 'inn': p = keeper(BIG(H) ? H : near(BIG, 1)[0], 'inn'); break;
    case 'alch': case 'arcan': { const t = key === 'alch' ? 'alchemist' : 'arcanist'; p = keeper(H, t) || keeper(near((x) => x.type === 'city' || x.type === 'castle', 1)[0], t); break; }
    case 'priest': p = keeper(BIG(H) ? H : near(BIG, 1)[0], 'church'); break;
    case 'priest2': case 'priest3': { const l = other((x) => BIG(x) && faithOf(x) === ctx.fid, key === 'priest2' ? 0 : 1) || other(BIG, 0); p = keeper(l, 'church'); break; }
    case 'high': { let best = seatOf(ctx.fid); if (!best || best === H) { best = null; for (const l of W.locs) if (BIG(l) && l !== H && faithOf(l) === ctx.fid && (!best || l.count > best.count)) best = l; } best = best || other(BIG, 0); p = keeper(best, 'church'); break; }
    case 'acolyte': p = keeper(H, 'church', 1) || keeper(H, 'church'); break;
    case 'king': p = court(C, 'king'); break; case 'queen': p = court(C, 'queen'); break; case 'steward': p = court(C, 'steward'); break;
    case 'marshal': p = court(C, 'guard', 'Marshal of the Realm'); break;
    case 'rking': p = court(ctx.rival, 'king'); break; case 'rsteward': p = court(ctx.rival, 'steward'); break;
    case 'gm2': case 'gm3': { const l = other((x) => BIG(x) && guildOf(x) === ctx.fid, key === 'gm2' ? 0 : 1); p = l ? keeper(l, 'guild') : headOf(other(BIG, key === 'gm2' ? 0 : 1)); break; }
    case 'rgm': { const l = other((x) => BIG(x) && guildOf(x) === ctx.def.rival, 0) || other(BIG, 2); p = keeper(l, 'guild'); break; }
    default: p = headOf(BIG(H) ? H : near(BIG, 1)[0]);
  }
  ctx.people[key] = p; return p;
}
function dungeon(ctx, lo, hi) {
  const W = G.world, H = ctx.home, busy = new Set(); for (const q of G.save.quests) if (q.state === 'active') for (const s of q.steps || [q]) if (s.dungeon !== undefined) busy.add(s.dungeon);
  let c = W.nearest(H.x, H.z, (l) => !l.civ && l.tier >= lo && l.tier <= hi && !ctx.used.has(l.id) && !busy.has(l.id), 3);
  if (!c.length) c = W.nearest(H.x, H.z, (l) => !l.civ && !ctx.used.has(l.id), 3);
  const D = ctx.rng.pick(c); ctx.used.add(D.id); ctx.duns.push(D); return D;
}
function fill(ctx, str) {
  if (!str) return str;
  return str.replace(/\{(\w+)\}/g, (m, k) => {
    if (ctx.vars[k] !== undefined) return ctx.vars[k];
    const dm = /^dun(\d)$/.exec(k); if (dm) { const D = ctx.duns[+dm[1] - 1]; return D ? D.name : 'the deep places'; }
    if (k.endsWith('T')) { const p = person(ctx, k.slice(0, -1)); return G.world.locs[p.loc].name; }
    return person(ctx, k).name;
  });
}

// Build the next mission of a faction as a quest object (not yet accepted).
export function buildMission(fid, giver, L) {
  const W = G.world, def = factionDef(fid), idx = fstate(fid).done, M = def.missions[idx];
  const home = def.type === 'kingdom' ? def.seat : L, rng = new RNG(hash2(idx, 77, hash2(home.id, W.seed, 5)));
  const ctx = { fid, def, home, rng, people: {}, used: new Set(), duns: [], vars: {} };
  const C = W.locs[home.realm];
  ctx.rival = W.nearest(C.x, C.z, (l) => l.type === 'castle' && l !== C, 1)[0] || C;
  ctx.border = W.nearest(ctx.rival.x, ctx.rival.z, (l) => BIG(l) && l.realm === C.id && l !== C, 1)[0] || W.nearest(C.x, C.z, (l) => BIG(l) && l !== C, 1)[0];
  const forage = rng.pick(FORAGE[BIOMES[home.biome].id]);
  const cap = 2.5 + idx / def.missions.length * 7, table = BIOMES[home.biome].wild.filter((m) => MONSTERS[m[0]].lvl <= cap).sort((a, b) => MONSTERS[b[0]].lvl - MONSTERS[a[0]].lvl);
  const mon = (table[rng.int(0, Math.min(1, table.length - 1))] || BIOMES[home.biome].wild[0])[0];
  Object.assign(ctx.vars, { realm: realmName(W, C), rival: realmName(W, ctx.rival), g: def.name, rg: def.rival ? GUILDS[def.rival].name : '', home: home.name, herb: INGREDIENTS[forage[0]].name, mon: Q.plural(MONSTERS[mon].name), n: personName(rng, rng.chance(0.3)).split(' ')[0] });
  // steps first (they reserve dungeons in order), then the words
  const raw = M[2].map((s) => {
    const k = s[0];
    if (k === 'fetch') { const D = dungeon(ctx, s[1], s[2]); return { kind: 'fetch', dungeon: D.id, item: s[3] }; }
    if (k === 'bounty') { const D = dungeon(ctx, s[1], s[2]); return { kind: 'bounty', dungeon: D.id, boss: Q.bossOf(D), bossName: s[3] }; }
    if (k === 'slay') return { kind: 'slay', monster: s[2] || mon, need: s[1], count: 0 };
    if (k === 'talk') return { kind: 'talk', who: s[1], say: s[2] };
    if (k === 'deliver') return { kind: 'delivery', who: s[1], itemName: s[2], say: s[3] };
    if (k === 'gather') return { kind: 'gather', sk: 'i:' + forage[0], label: INGREDIENTS[forage[0]].name, need: s[1], who: s[2], say: s[3] };
    return { kind: 'supply', skPrefix: s[1], need: s[2], label: s[3], who: s[4], say: s[5] };
  });
  // dungeons were numbered per-faction in the scripts (dun1..dun8); within one mission they are simply in order
  ctx.vars.dun1 = ctx.vars.dun2 = ctx.vars.dun3 = ctx.vars.dun4 = ctx.vars.dun5 = ctx.vars.dun6 = ctx.vars.dun7 = ctx.vars.dun8 = ctx.duns[0] ? ctx.duns[0].name : 'the wilds';
  const steps = raw.map((o) => {
    if (o.who) { o.target = person(ctx, o.who); } delete o.who;
    if (o.say) o.say = fill(ctx, o.say); if (o.item) o.item = fill(ctx, o.item); if (o.bossName) o.bossName = fill(ctx, o.bossName);
    return o;
  });
  const gold = Math.round(({ kingdom: 80 + idx * 45, guild: 45 + idx * 17, church: 60 + idx * 42 }[def.type]) * (idx === def.missions.length - 1 ? 2 : 1) * (1 + G.player.perk('questGold')));
  return { main: true, faction: fid, idx, type: 'main', title: fill(ctx, M[0]), desc: fill(ctx, M[1]), doneText: fill(ctx, M[3]), steps, step: 0, gold, rep: Math.round(100 / def.missions.length),
    giver: { id: giver.id, name: giver.name, loc: L.id }, state: 'offer' };
}

// What a faction leader says when asked about the faction's business. Returns text or {text, topics}.
export function business(fid, c, L) {
  const def = factionDef(fid), st = fstate(fid); st.met = 1;
  const rank = rankOf(fid), n = def.missions.length;
  if (st.done >= n) return `You are our ${def.ranks[5]}. There is no higher honour we can give, and no task I would set you that you have not already surpassed.`;
  if (def.type === 'kingdom') { // the steward handles the early service, the king the later
    const who = st.done < 6 ? 'steward' : 'king';
    if (c.role !== who) return who === 'king' ? 'You have outgrown my errands. His Majesty will speak with you himself now - and he does not like to be kept waiting.' : 'A king does not hire strangers. Prove yourself to my steward first, and perhaps we shall speak.';
  }
  const act = activeMain(fid);
  if (act) return act.giver.id === c.id ? 'You have your orders. ' + Q.progressText(act) : 'You are already about our business. ' + Q.progressText(act);
  const need = rankReq(def, st.done);
  if (rank < need) return `There is more to be done, but not by a ${def.ranks[rank]}. Earn the rank of ${def.ranks[need]} first - take ${def.type === 'kingdom' ? 'the crown\'s commissions' : def.type === 'guild' ? 'contracts from our board' : 'tasks for the faithful'} and prove your worth. (Standing ${st.rep}/${RANK_REP[need]})`;
  const q = buildMission(fid, c, L);
  const intro = st.done === 0 ? def.ideal + '\n\n' : '';
  return { text: intro + q.desc + `\n\n(${def.name} - mission ${st.done + 1} of ${n} - ${q.gold} gold)`, topics: [{ label: 'I will see it done', run: () => { Q.accept(q); return def.type === 'church' ? 'Go with our blessing.' : 'Good. Do not keep me waiting.'; } }, { label: 'Not yet', run: () => 'It will keep. It has no choice.' }] };
}

// Standing gained from a finished quest; main missions also advance the story.
export function credit(q) {
  const fid = q.faction, def = factionDef(fid), st = fstate(fid), before = rankOf(fid);
  st.rep += q.rep || 5; st.met = 1;
  addInfluence(G.world.locs[q.giver.loc], fid, q.main ? 10 : 6);
  if (q.main) {
    st.done++;
    const n = def.missions.length, P = G.player;
    if (def.type === 'guild' && st.done % Math.ceil(n / 4) === 0 && st.done < n + 1) spreadInfluence(fid, G.world.locs[q.giver.loc]);
    if (st.done % 5 === 0 || st.done === n) { const it = randomGear(new RNG(hash2(st.done, 3, q.id)), 1 + st.done / n * 3, 0.9); it.cond = 100; P.addItem(it); G.fn.msg('You are rewarded with ' + it.name + '.', 'good'); }
    if (st.done === n) {
      const it = mkJewel(def.type === 'church' ? 'amulet' : 'ring', new RNG(hash2(n, 9, q.id)), 1.3);
      it.name = { kingdom: 'Signet of the Lord Protector', guild: def.ranks[5] + '\'s Seal', church: 'Amulet of the ' + def.name.replace(/^.* of the /, '') }[def.type]; it.val *= 3; P.addItem(it);
      G.fn.banner(def.ranks[5]); G.fn.msg('You have completed the story of the ' + def.name + ' and are named ' + def.ranks[5] + '. You receive the ' + it.name + '.', 'perk');
    }
  }
  const after = rankOf(fid);
  if (after > before && after < 5) { G.fn.msg(def.name + ': you rise to the rank of ' + def.ranks[after] + '.', 'perk'); G.fn.sfx('level'); }
  boons();
}
// ---------------------------------------------------------------------------------------------
// Influence. Every town has a standing for each guild, and every settlement for each faith.
// Whoever stands highest keeps the hall (or the temple). Work done for a faction in a place raises it there.
// ---------------------------------------------------------------------------------------------
const kindIds = (kind) => Object.keys(kind === 'guild' ? GUILDS : FAITHS);
const holderOf = (L, kind) => (kind === 'guild' ? guildOf(L) : faithOf(L));
export function influenceAt(L, kind) {
  const S = G.save, store = kind === 'guild' ? S.infl : S.inflF, rec = store[L.id], hold = holderOf(L, kind), out = {};
  for (const id of kindIds(kind)) out[id] = rec && rec[id] !== undefined ? rec[id] : id === hold ? 60 : hash2(L.id, id.length * 7 + id.charCodeAt(0), 91) % 18;
  return out;
}
export function addInfluence(L, fid, amt) {
  const def = factionDef(fid); if (def.type === 'kingdom' || !L || !L.civ || (def.type === 'guild' && !BIG(L))) return;
  const kind = def.type === 'guild' ? 'guild' : 'church', S = G.save, store = kind === 'guild' ? S.infl : S.inflF, cur = influenceAt(L, kind), hold = holderOf(L, kind);
  cur[fid] = clamp(cur[fid] + amt, 0, 100);
  if (hold !== fid && amt > 0) cur[hold] = clamp(cur[hold] - amt / 4, 0, 100);
  store[L.id] = cur;
  if (hold !== fid && cur[fid] > cur[hold]) { // the place changes hands - unless it is the old holder's last
    let left = 0; for (const l of G.world.locs) if (l.civ && (kind === 'church' || BIG(l)) && holderOf(l, kind) === hold) left++;
    if (left <= 1) { cur[fid] = cur[hold]; return; }
    (kind === 'guild' ? S.guildOf : S.faithOf)[L.id] = fid; cur[fid] = Math.max(cur[fid], 60);
    clearLayout(L.id); clearCitizensOf(L); hqCache = {};
    if (G.terrain && !G.space) G.terrain.rebuildNear(L.x, L.z, L.r + 80);
    if (!S.discovered[L.id]) S.known[L.id] = 1;
    G.fn.banner(def.name + ' takes ' + L.name);
    G.fn.msg(kind === 'guild' ? 'The ' + def.name + ' has won ' + L.name + ' from the ' + GUILDS[hold].name + ': its hall and banners are theirs now, and ' + def.mark + '. (' + def.boon[2] + ')' : 'The people of ' + L.name + ' have turned to the ' + def.name + '. Its temple has been reconsecrated.', 'perk');
    boons();
  }
}
// called once per game day: influence settles back toward what the holder can sustain
export function dailyDrift() {
  const S = G.save;
  for (const [store, kind] of [[S.infl, 'guild'], [S.inflF, 'church']]) for (const id in store) {
    const L = G.world.locs[id], rec = store[id], hold = holderOf(L, kind);
    for (const f in rec) { const base = f === hold ? 60 : hash2(L.id, f.length * 7 + f.charCodeAt(0), 91) % 18; if (rec[f] > base) rec[f] = Math.max(base, rec[f] - 1); else if (rec[f] < base) rec[f] = Math.min(base, rec[f] + 1.5); }
  }
}
function spreadInfluence(fid, from) { // a story milestone: a hard push on the nearest rival-held town
  const W = G.world, def = factionDef(fid);
  const T = W.nearest(from.x, from.z, (l) => BIG(l) && guildOf(l) === def.rival, 1)[0] || W.nearest(from.x, from.z, (l) => BIG(l) && guildOf(l) !== fid, 1)[0];
  if (T) addInfluence(T, fid, 55);
}
export function influence(fid) { let n = 0; const o = GUILDS[fid] ? G.save.guildOf : G.save.faithOf; for (const k in o) if (o[k] === fid) n++; return n; }
export function holdings(fid) { const def = factionDef(fid); let n = 0; if (def.type === 'kingdom') { for (const l of G.world.locs) if (l.civ && l.realm === def.seat.id) n++; return n; } for (const l of G.world.locs) if (l.civ && (def.type === 'church' ? faithOf(l) === fid : BIG(l) && guildOf(l) === fid)) n++; return n; }
// Permanent bonuses earned from factions; read through player.perk()
export function boons() {
  const b = G.boons = {};
  for (const fid in G.save.factions) {
    const def = factionDef(fid), st = G.save.factions[fid], add = (k, v) => { b[k] = (b[k] || 0) + v; };
    if (def.type === 'guild') add(def.boon[0], def.boon[1] * Math.min(6, influence(fid)));
    if (st.done >= def.missions.length) add(def.boon[0], def.boon[1]);
  }
  return b;
}

// ---------------------------------------------------------------------------------------------
// Leadership and members: who holds which office, and what they are called.
// ---------------------------------------------------------------------------------------------
let hqCache = {};
// the seat of a guild or faith: the largest settlement it holds
export function seatOf(fid) {
  const def = factionDef(fid); if (def.type === 'kingdom') return def.seat;
  const key = fid + G.world.seed; if (hqCache[key]) return hqCache[key];
  let best = null; for (const l of G.world.locs) if (BIG(l) && holderOf(l, def.type === 'guild' ? 'guild' : 'church') === fid && (!best || l.count > best.count)) best = l;
  return (hqCache[key] = best);
}
const HIGH = { dawn: 'Dawn-Speaker', moon: 'the Veiled One', hearth: 'Flamewarden' };
const COURT = ['Chancellor', 'Lord Treasurer', 'Court Wizard', 'Master of Hounds', 'Lady of the Robes'];
export function titleOf(c, L, b) {
  if (G.save.titles[c.id]) return G.save.titles[c.id];
  if (!b) return c.role === 'guard' ? 'Guard' : null;
  const cs = citizensOf(L, b);
  if (b.type === 'castle') {
    if (c.role === 'king') return 'King of ' + realmName(G.world, L).slice(11); if (c.role === 'queen') return 'Queen of ' + realmName(G.world, L).slice(11); if (c.role === 'steward') return 'Steward of ' + L.name;
    if (c.role === 'guard') return cs.find((x) => x.role === 'guard') === c ? 'Marshal of the Realm' : 'Royal Guard';
    if (c.role === 'noble') return COURT[cs.filter((x) => x.role === 'noble').indexOf(c) % COURT.length];
    return 'Servant of the Court';
  }
  if (b.type === 'guild') {
    const g = guildOf(L), def = GUILDS[g], seat = seatOf(g) === L;
    if (c.role === 'Guildmaster') return seat ? 'Grandmaster of the ' + def.name : 'Guildmaster, ' + def.name;
    if (c.role === 'quartermaster') return 'Quartermaster, ' + def.name;
    return def.ranks[1 + (c.seed % 4)] + ' of the ' + def.name;
  }
  if (b.type === 'church') {
    const f = faithOf(L), def = FAITHS[f];
    if (c.role === 'Priest') return seatOf(f) === L ? HIGH[f] + ' of the ' + def.name.replace(/^.* of the /, '') : 'Priest, ' + def.name;
    return (c.role === 'cleric' ? def.ranks[3] : def.ranks[2]) + ', ' + def.name;
  }
  if ((b.type === 'house' || b.type === 'farmhouse') && c.n === 0 && getLayout(G.world, L).buildings.find((x) => x.type === 'house' || x.type === 'farmhouse') === b) return (L.type === 'village' || L.type === 'farm' ? 'Elder' : L.type === 'town' ? 'Reeve' : 'Mayor') + ' of ' + L.name;
  return null;
}
// the named leadership of a faction, for the journal
export function leadership(fid) {
  const def = factionDef(fid), seat = seatOf(fid), out = []; if (!seat) return out;
  const lay = getLayout(G.world, seat), b = lay.buildings.find((x) => x.type === (def.type === 'kingdom' ? 'castle' : def.type === 'guild' ? 'guild' : 'church')); if (!b) return out;
  const cs = citizensOf(seat, b), put = (c) => { if (c) out.push({ title: titleOf(c, seat, b), name: c.name, where: seat.name }); };
  if (def.type === 'kingdom') { put(cs.find((c) => c.role === 'king')); put(cs.find((c) => c.role === 'queen')); put(cs.find((c) => c.role === 'steward')); put(cs.find((c) => c.role === 'guard')); for (const c of cs.filter((x) => x.role === 'noble').slice(0, 3)) put(c); }
  else { put(cs[0]); put(cs[1]); if (cs[2]) put(cs[2]); }
  return out;
}
// which faction a citizen belongs to (leaders, officers and ordinary members alike)
export function memberOf(c, L, b) {
  if (!b) return L.civ && c.role === 'guard' ? 'k:' + L.realm : null;
  if (b.type === 'castle') return 'k:' + L.id; if (b.type === 'guild') return guildOf(L); if (b.type === 'church') return faithOf(L);
  return null;
}

// ---------------------------------------------------------------------------------------------
// Privileges: what each rank entitles you to.
// ---------------------------------------------------------------------------------------------
const GUILD_SPECIAL = {
  blades: ['repair', 'Company Armourer', 'The guildmaster or quartermaster of any Free Blades hall repairs all your gear for free.'],
  page: ['library', 'Circle Library', 'Quartermasters of the Circle sell every spell tome you are able to learn.'],
  scale: ['prices', 'Member\'s Rate', 'Prices are 10% better in every town where the Gilded Scale holds the hall.'],
  lantern: ['whispers', 'Whispers', 'Once a day a Lantern officer will mark three places you have not yet found on your map.'],
};
export function privileges(fid) {
  const def = factionDef(fid);
  if (def.type === 'guild') { const sp = GUILD_SPECIAL[fid]; return [
    [1, 'bed', 'A Bunk in the Hall', 'Sleep for free in any ' + def.hall + '.'], [1, 'store', 'Guild Stores', 'Buy from the quartermaster\'s private stock at member prices.'],
    [2, sp[0], sp[1], sp[2]], [3, 'stash', 'Strongbox', 'A personal strongbox, reachable from the quartermaster of every hall.'], [3, 'train', 'Master Instruction', 'Members train you for 30% less, and to a higher level.'],
    [4, 'stipend', 'Officer\'s Pay', 'Draw 30 gold a day from any guildmaster.'], [5, 'stipend2', 'Master\'s Share', 'Your daily pay rises to 80 gold, plus 10 for every town the guild has won.']]; }
  if (def.type === 'kingdom') return [
    [1, 'bed', 'Barracks Bed', 'Sleep for free in the castle.'], [2, 'commission', 'Royal Warrant', 'Royal commissions pay you 25% more.'],
    [3, 'store', 'Royal Armoury', 'The steward will sell you arms from the royal armoury.'], [4, 'stash', 'Chamber in the Keep', 'A strongbox of your own, kept by the steward.'], [4, 'stipend', 'Knight\'s Pension', 'Draw 45 gold a day from the steward.'],
    [5, 'stipend2', 'Protector\'s Tithe', 'Your daily income rises to 130 gold from the realm\'s taxes.']];
  return [
    [1, 'heal', 'Sanctuary', 'Priests of the faith heal and cure you for free.'], [2, 'bless', 'Daily Blessing', 'Once a day, a priest will lay a 20-minute blessing of your choice on you.'],
    [3, 'store', 'Temple Stores', 'Buy healing draughts and remedies from the temple at cost.'], [4, 'relic', 'Greater Blessing', 'Your daily blessing is doubled in strength and lasts an hour.'], [5, 'stipend', 'Tithes', 'Draw 60 gold a day from any priest of the faith.']];
}
export function hasPriv(fid, key) { if (!fid) return false; const r = rankOf(fid); return privileges(fid).some((p) => p[1] === key && r >= p[0]); }
export function stipendDue(fid) {
  const st = fstate(fid), r = rankOf(fid), def = factionDef(fid); let rate = 0;
  if (hasPriv(fid, 'stipend2')) rate = def.type === 'kingdom' ? 130 : 80 + 10 * influence(fid); else if (hasPriv(fid, 'stipend')) rate = def.type === 'kingdom' ? 45 : def.type === 'guild' ? 30 : 60;
  const day = Math.floor(G.time / 86400), days = Math.min(7, day - (st.paid === undefined ? day - 1 : st.paid));
  return { rate, days, gold: rate * Math.max(0, days), r };
}
export function collectStipend(fid) { const d = stipendDue(fid); fstate(fid).paid = Math.floor(G.time / 86400); G.player.gold += d.gold; return d; }
// private stock a faction keeps for its members
export function factionStock(fid) {
  const def = factionDef(fid), S = G.save, ep = Math.floor(G.time / 86400 / 3), key = 'f:' + fid, r = rankOf(fid);
  if (S.shops[key] && S.shops[key].ep === ep && S.shops[key].r === r) return S.shops[key];
  const rng = new RNG(hash2(ep, r, hash2(fid.length, fid.charCodeAt(fid.length - 1), G.world.seed))), items = [], add = (it) => { const ex = it.stack && items.find((o) => o.sk === it.sk); if (ex) ex.qty += it.qty; else items.push(it); };
  const tier = clamp(r - 1, 0, 3);
  if (def.type === 'kingdom') { for (let i = 0; i < 8; i++) add(randomGear(rng, 1.5 + r * 0.4, 0.25)); add(I.mkMisc('arrow', 80)); add(I.mkBlueprint('met:' + clamp(r - 2, 1, 3))); for (let i = 0; i < 2; i++) add(I.randomBlueprint(rng, 2)); }
  else if (def.type === 'church') { add(I.mkPotion('heal', 34, 6)); add(I.mkPotion('cure', 1, 4)); add(I.mkPotion('regen', 1.2, 3)); add(I.mkPotion('resist', 22, 3)); add(I.mkPotion('mana', 30, 3)); add(I.mkMisc('bread', 10)); if (r >= 4) add(I.mkJewel('amulet', rng, 0.8)); }
  else if (fid === 'blades') { for (let i = 0; i < 9; i++) { const it = rng.chance(0.5) ? I.randomWeapon(rng, tier) : I.randomArmor(rng, tier); add(it); } add(I.mkMisc('arrow', 100)); add(I.mkPotion('heal', 30, 4)); add(I.mkMisc('hammer')); }
  else if (fid === 'page') { const ids = Object.keys(SPELLS).filter((s) => hasPriv(fid, 'library') ? true : SPELLS[s].lvl <= 30); for (const id of ids) add(I.mkTome(id)); add(I.mkPotion('mana', 30, 6)); add(I.mkMisc('alembic')); add(I.mkJewel('ring', rng, 0.3 + r * 0.12)); }
  else if (fid === 'scale') { for (let t = 0; t <= Math.min(2, tier); t++) add(I.mkIngot(t, 6)); add(I.mkMisc('coal', 12)); add(I.mkMisc('leather', 10)); add(I.mkMisc('gem', 2)); for (let i = 0; i < 3; i++) add(I.randomBlueprint(rng, 1 + tier)); for (let i = 0; i < 4; i++) add(randomGear(rng, tier, 0.3)); add(I.mkMisc('pickaxe')); add(I.mkMisc('tongs')); }
  else { add(I.mkMisc('lockpick', 20)); add(I.mkPotion('night', 1, 4)); add(I.mkPotion('swift', 22, 4)); add(I.mkWeapon('dagger', tier)); add(I.mkWeapon('shortsword', tier)); add(I.mkWeapon('shortbow', Math.min(tier, 2))); for (const sl of ['head', 'body', 'arms', 'legs', 'feet']) add(I.mkArmor('light', sl, tier)); add(I.mkMisc('torch', 6)); add(I.mkJewel('ring', rng, 0.3 + r * 0.12)); }
  return (S.shops[key] = { ep, r, items, gold: 400 + r * 300 });
}

export function summary(fid) {
  const def = factionDef(fid), st = fstate(fid), r = rankOf(fid), n = def.missions.length, seat = seatOf(fid);
  let s = def.ideal + '\n\nRank: ' + def.ranks[r] + '   (' + def.ranks.join(' › ') + ')\nStanding: ' + st.rep + (r < 4 ? '  (next rank at ' + RANK_REP[r + 1] + ')' : '') + '\nMain missions: ' + st.done + ' of ' + n;
  s += '\nHolds: ' + holdings(fid) + (def.type === 'kingdom' ? ' settlements' : def.type === 'guild' ? ' halls' : ' temples') + (seat ? ', seat at ' + seat.name : '');
  if (def.type === 'guild') s += '\nRival: ' + GUILDS[def.rival].name + '\nHalls won with your help: ' + influence(fid) + '  (each grants ' + def.boon[2] + ')';
  if (def.type === 'church' && influence(fid)) s += '\nTemples turned with your help: ' + influence(fid);
  if (st.done >= n) s += '\nStory complete: ' + def.boon[2] + '.';
  else if (r < rankReq(def, st.done)) s += '\nThe next mission needs the rank of ' + def.ranks[rankReq(def, st.done)] + '.';
  s += '\n\nPRIVILEGES\n' + privileges(fid).map((p) => (r >= p[0] ? '✔ ' : '· ') + p[2] + ' (' + def.ranks[p[0]] + ') - ' + p[3]).join('\n');
  const lead = leadership(fid); if (lead.length) s += '\n\nLEADERSHIP\n' + lead.map((l) => l.title + ': ' + l.name).join('\n');
  s += '\n\nHOW TO RISE\nComplete main missions, ' + (def.type === 'kingdom' ? 'take the crown\'s commissions' : def.type === 'guild' ? 'take contracts from the guild\'s boards' : 'do tasks for its priests') + ', and do not abandon work you have accepted.' + (def.type !== 'kingdom' ? ' Work done in a town also raises the ' + def.name + '\'s influence there - enough of it, and the ' + (def.type === 'guild' ? 'hall' : 'temple') + ' changes hands.' : '');
  return s;
}
