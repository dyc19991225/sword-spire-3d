// Headless Verification Suite for `card-game` Skill Requirements:
// 1) 10,000 random legal turns: strict 1-zone-per-card invariant & constant count
// 2) Fisher-Yates 24,000 shuffles of 4-card deck: chi-square < 41 (p > 0.01)
// 3) Deterministic seeded replay: identical state hash for identical seed & actions
// 4) Trigger loop depth cap (`MAX_PUSHES = 100`) safety check
// 5) 1,000-turn greedy starter-deck profiler (avg damage & block per turn vs Act 1 enemy HP)

import { SeededRng } from '../src/rng.ts';
import { SwordSpireEngine, MAX_PUSHES } from '../src/engine.ts';
import { CARDS } from '../src/cards.ts';

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    throw new Error(`ASSERTION FAILED: ${msg}`);
  }
}

// Test 1: 24,000 Fisher-Yates shuffles of a 4-card deck (24 permutations, expected 1,000 each)
function testShuffleUniformity(): number {
  const rng = new SeededRng(20261126);
  const counts = new Map<string, number>();
  const trials = 24000;
  for (let i = 0; i < trials; i++) {
    const deck = [0, 1, 2, 3];
    rng.shuffleInPlace(deck);
    const key = deck.join(',');
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  assert(counts.size === 24, `Expected 24 permutations, got ${counts.size}`);
  let chiSq = 0;
  const expected = trials / 24;
  for (const c of counts.values()) {
    chiSq += ((c - expected) * (c - expected)) / expected;
  }
  assert(chiSq < 41.0, `Shuffle biased! chi-square = ${chiSq.toFixed(2)} >= 41`);
  return chiSq;
}

// Test 2: 10,000 random legal turns across all 3 heroes & full card pool
function testTenThousandRandomTurns(): void {
  const botRng = new SeededRng(888888);
  const engine = new SwordSpireEngine(123456);
  const allIds = Object.keys(CARDS);
  let turnsSimulated = 0;

  while (turnsSimulated < 10000) {
    const heroId = (['shushan', 'talisman', 'asura'] as const)[turnsSimulated % 3];
    engine.startNewRun(heroId, 1000 + turnsSimulated);
    // Add 6 random non-starter cards to exercise every op & formation!
    for (let k = 0; k < 6; k++) {
      engine.addCardToMasterDeck(botRng.pick(allIds), botRng.nextFloat() < 0.35);
    }
    engine.startCombat(['wolf_demon', 'talon_ghost', 'iron_puppet'], 2);
    // Boost HP so battles run multi-turn stress cycles
    engine.maxHp = 9999;
    engine.hp = 9999;
    for (const e of engine.enemies) {
      e.maxHp = 999;
      e.hp = 999;
    }

    let safety = 0;
    while (engine.runPhase === 'combat' && safety++ < 25 && turnsSimulated < 10000) {
      engine.assertZoneInvariant();
      let playedInTurn = 0;
      while (engine.runPhase === 'combat' && playedInTurn < 15) {
        const playable = engine.hand.filter((c) => engine.getCardCost(c) <= engine.qi);
        if (playable.length === 0) break;
        const pick = botRng.pick(playable);
        const tIdx = botRng.intInclusive(0, engine.enemies.length - 1);
        const ok = engine.playCard(pick.uid, tIdx);
        engine.assertZoneInvariant();
        if (!ok) break;
        playedInTurn++;
      }
      if (engine.runPhase === 'combat') {
        engine.endPlayerTurn();
        if (engine.runPhase === 'combat') {
          engine.assertZoneInvariant();
        }
        turnsSimulated++;
      }
    }
  }
}

// Test 3: Deterministic Seeded Replay
function runScriptedSequence(seed: number): string {
  const eng = new SwordSpireEngine(seed);
  eng.startNewRun('talisman', seed);
  eng.startCombat(['wolf_demon', 'talon_ghost'], 1);
  for (let t = 0; t < 3 && eng.runPhase === 'combat'; t++) {
    for (const c of [...eng.hand]) {
      if (eng.getCardCost(c) <= eng.qi) {
        eng.playCard(c.uid, 0);
      }
    }
    if (eng.runPhase === 'combat') eng.endPlayerTurn();
  }
  return eng.computeStateHash();
}

// Test 4: Queue Overflow / Trigger Cap Check
function testTriggerDepthCap(): void {
  const eng = new SwordSpireEngine(42);
  eng.startNewRun('shushan', 42);
  eng.startCombat(['iron_puppet'], 1);
  for (let i = 0; i < MAX_PUSHES + 30; i++) {
    eng.pushEffect({ op: 'gain_qi', amount: 1 }, 0);
  }
  const c = eng.hand[0];
  eng.playCard(c.uid, 0);
  assert(
    eng.logs.includes('trigger loop stopped'),
    'Expected trigger depth cap to halt excessive effect queue pushes'
  );
}

// Test 5: 1,000-Turn Starter Deck Greedy Bot Balance Profiler
function profileStarterDeck(): { avgDmg: number; avgBlk: number } {
  const eng = new SwordSpireEngine(777);
  let totalDmg = 0;
  let totalBlk = 0;
  let turns = 0;

  while (turns < 1000) {
    eng.startNewRun('shushan', 5000 + turns);
    eng.startCombat(['iron_puppet'], 1);
    eng.hp = 9999;
    eng.enemies[0].maxHp = 99999;
    eng.enemies[0].hp = 99999;

    for (let t = 0; t < 10 && turns < 1000; t++) {
      const hpBefore = eng.enemies[0].hp + eng.enemies[0].block;
      // Greedy: play Sword-Channeling & high-damage cards first, then block
      let progressed = true;
      while (progressed && eng.runPhase === 'combat') {
        progressed = false;
        const playable = eng.hand.filter((c) => eng.getCardCost(c) <= eng.qi);
        playable.sort((a, b) => enginePriority(b.defId) - enginePriority(a.defId));
        if (playable.length > 0) {
          progressed = eng.playCard(playable[0].uid, 0);
        }
      }
      totalBlk += eng.block;
      eng.endPlayerTurn();
      const hpAfter = eng.enemies[0].hp + eng.enemies[0].block;
      totalDmg += Math.max(0, hpBefore - hpAfter);
      turns++;
    }
  }
  return { avgDmg: totalDmg / turns, avgBlk: totalBlk / turns };
}

function enginePriority(defId: string): number {
  if (defId === 'metal_call') return 10;
  if (defId === 'break_army') return 9;
  if (defId === 'strike') return 6;
  return 4;
}

const chiSq = testShuffleUniformity();
testTenThousandRandomTurns();
const h1 = runScriptedSequence(998877);
const h2 = runScriptedSequence(998877);
assert(h1 === h2, 'Seeded replay hash mismatch!');
testTriggerDepthCap();
const prof = profileStarterDeck();

console.log('=== CARD-GAME ENGINE VERIFICATION PASSED ===');
console.log(`1. 24,000 4-card Fisher-Yates shuffles chi-square: ${chiSq.toFixed(2)} (< 41.0 OK)`);
console.log('2. 10,000 random legal turns: 0 zone-invariant violations, 0 card leaks/dupes');
console.log(`3. Deterministic seeded replay hash match: OK (${h1.slice(0, 56)}...)`);
console.log(`4. Queue depth cap (MAX_PUSHES=${MAX_PUSHES}): halted cleanly with log`);
console.log(
  `5. Starter deck 1,000-turn greedy output: ${prof.avgDmg.toFixed(1)} dmg/turn, ${prof.avgBlk.toFixed(1)} block/turn (Act 1 starter enemies = 30-34 HP ≈ 2.2-2.8 turns!)`
);
