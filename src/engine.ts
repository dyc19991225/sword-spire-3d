// Pure Data-Driven Roguelike Deckbuilder & Five-Element Sword-Box Engine for 《斩妖录：剑匣问天 3D》
import {
  CARDS,
  ENEMIES,
  HEROES,
  RELICS,
  SWORD_ELEMENTS,
  SWORD_FORMATIONS,
  type CardDef,
  type EffectOp,
  type EnemyMove,
  type HeroDef,
  type HeroId,
  type SwordElement,
} from './cards.ts';
import { SeededRng } from './rng.ts';

export const HAND_CAP = 10;
export const BASE_DRAW = 5;
export const MAX_PUSHES = 100;

export interface CardInstance {
  uid: number;
  defId: string;
  upgraded: boolean;
}

export interface EnemyInstance {
  uid: number;
  archId: string;
  name: string;
  modelName: string;
  scale: number;
  tintHex: number;
  isBoss: boolean;
  isElite: boolean;
  hp: number;
  maxHp: number;
  block: number;
  strength: number;
  vuln: number;
  weak: number;
  burn: number;
  moveIndex: number;
  intent: EnemyMove;
}

export type MapNodeKind = 'battle' | 'elite' | 'rest' | 'shop' | 'event' | 'boss';

export interface MapNode {
  id: string;
  row: number; // 0..14 (3 Realms x 5 Rows)
  col: number; // 0..2
  realm: 1 | 2 | 3;
  kind: MapNodeKind;
  nextIds: string[];
  cleared: boolean;
}

export interface ShopListing {
  cards: { card: CardInstance; price: number; sold: boolean }[];
  relic: { relicId: string; price: number; sold: boolean } | null;
  removePrice: number;
  removeUsed: boolean;
  healPrice: number;
  healUsed: boolean;
}

export interface XianxiaEventSpec {
  id: string;
  title: string;
  desc: string;
  choices: {
    label: string;
    hint: string;
    outcomeId: string;
  }[];
}

export type VisualEvent =
  | { kind: 'hero_slash'; targetIdx: number; colorHex: number; heavy?: boolean }
  | { kind: 'hero_cast'; colorHex: number }
  | { kind: 'sword_fly'; element: SwordElement; targetIdx: number; isEvoke: boolean }
  | { kind: 'formation'; name: string; colorHex: number }
  | { kind: 'damage_enemy'; targetIdx: number; amount: number; blocked: number; colorHex: number }
  | { kind: 'damage_hero'; amount: number; blocked: number }
  | { kind: 'heal_hero'; amount: number }
  | { kind: 'block_hero'; amount: number }
  | { kind: 'enemy_act'; enemyIdx: number; attack: boolean }
  | { kind: 'toast'; text: string };

interface QueuedEffect {
  op: EffectOp;
  targetIdx: number;
}

export class SwordSpireEngine {
  public rng: SeededRng;
  public hero: HeroDef = HEROES[0];

  // Persistent Run State
  public hp = 80;
  public maxHp = 80;
  public gold = 99;
  public relics: string[] = [];
  public phoenixUsed = false;
  public masterDeck: CardInstance[] = [];
  private nextCardUid = 1;
  private nextEnemyUid = 1;

  // 15-Floor (3-Realm) Spire Map
  public mapRows: MapNode[][] = [];
  public currentRow = -1;
  public currentNodeId: string | null = null;
  public runPhase:
    | 'title'
    | 'map'
    | 'combat'
    | 'reward'
    | 'rest'
    | 'shop'
    | 'event'
    | 'victory'
    | 'gameover' = 'title';

  // Active Combat State
  public turn = 1;
  public qi = 3;
  public baseQiPerTurn = 3;
  public block = 0;
  public strength = 0;
  public dexterity = 0;
  public thorns = 0;
  public weak = 0;
  public vuln = 0;
  public drawOnSword = 0;
  public blockOnSword = 0;
  public bonusQiRegen = 0;
  public attacksPlayedCount = 0;
  public attacksPlayedThisTurn = 0;

  // Strict 5 Card Zones
  public drawPile: CardInstance[] = [];
  public hand: CardInstance[] = [];
  public limbo: CardInstance[] = [];
  public discardPile: CardInstance[] = [];
  public exhaustPile: CardInstance[] = [];
  private combatTotalCards = 0;

  // Floating Sword Box (悬空剑匣)
  public maxSwordSlots = 5;
  public swordBox: SwordElement[] = [];
  public triggeredFormationsThisTurn = new Set<string>();

  // Enemies & Rewards / Nodes
  public enemies: EnemyInstance[] = [];
  public selectedTargetIdx = 0;
  public rewardCards: CardInstance[] = [];
  public rewardGold = 0;
  public rewardRelicId: string | null = null;
  public currentShop: ShopListing | null = null;
  public currentEvent: XianxiaEventSpec | null = null;

  // Resolution Queue & Visual Event Buffer
  private effectQueue: QueuedEffect[] = [];
  public visualEvents: VisualEvent[] = [];
  public logs: string[] = [];

  constructor(seed = Date.now()) {
    this.rng = new SeededRng(seed);
  }

  public drainVisualEvents(): VisualEvent[] {
    const out = this.visualEvents;
    this.visualEvents = [];
    return out;
  }

  public getCardCost(card: CardInstance): number {
    const def = CARDS[card.defId];
    return card.upgraded && def.plusCost !== undefined ? def.plusCost : def.cost;
  }

  public getCardOps(card: CardInstance): EffectOp[] {
    const def = CARDS[card.defId];
    return card.upgraded ? def.plusOps : def.ops;
  }

  public getCardTitle(card: CardInstance): string {
    const def = CARDS[card.defId];
    return card.upgraded ? `${def.name}+` : def.name;
  }

  public getCardDesc(card: CardInstance): string {
    const def = CARDS[card.defId];
    return card.upgraded ? def.plusDesc : def.desc;
  }

  // Preview real damage on a card including Strength, Weak & Target Vulnerable!
  public previewCardDamage(baseAmt: number, targetIdx = this.selectedTargetIdx): number {
    let val = baseAmt + this.strength;
    if (this.weak > 0) val = Math.floor(val * 0.75);
    const enemy = this.enemies[targetIdx];
    if (enemy && enemy.hp > 0 && enemy.vuln > 0) {
      val = Math.floor(val * 1.5);
    }
    return Math.max(0, val);
  }

  public previewCardBlock(baseAmt: number): number {
    return Math.max(0, baseAmt + this.dexterity);
  }

  public previewEnemyAttackDamage(enemy: EnemyInstance): number {
    if (!enemy.intent.dmg) return 0;
    let d = enemy.intent.dmg + enemy.strength;
    if (enemy.weak > 0) d = Math.floor(d * 0.75);
    if (this.vuln > 0) d = Math.floor(d * 1.5);
    return Math.max(0, d);
  }

  // =========================================================================
  // Start New Run & Generate 15-Floor (3-Realm) Branching Spire Map
  // =========================================================================
  public startNewRun(heroId: HeroId, seed?: number): void {
    if (seed !== undefined) {
      this.rng = new SeededRng(seed);
    }
    this.hero = HEROES.find((h) => h.id === heroId) || HEROES[0];
    this.maxHp = this.hero.maxHp;
    this.hp = this.maxHp;
    this.gold = 99;
    this.relics = [this.hero.starterRelic];
    this.phoenixUsed = false;
    this.masterDeck = [];
    this.nextCardUid = 1;
    this.nextEnemyUid = 1;

    for (const cid of this.hero.starterDeck) {
      this.addCardToMasterDeck(cid, false);
    }

    this.generateSpireMap();
    this.currentRow = -1;
    this.currentNodeId = null;
    this.runPhase = 'map';
    this.visualEvents = [];
    this.logs = [`踏入仙途：${this.hero.name}`];
  }

  public addCardToMasterDeck(defId: string, upgraded = false): CardInstance {
    const inst: CardInstance = {
      uid: this.nextCardUid++,
      defId,
      upgraded,
    };
    this.masterDeck.push(inst);
    return inst;
  }

  public removeCardFromMasterDeck(uid: number): boolean {
    if (this.masterDeck.length <= 5) return false;
    const idx = this.masterDeck.findIndex((c) => c.uid === uid);
    if (idx < 0) return false;
    this.masterDeck.splice(idx, 1);
    return true;
  }

  public upgradeMasterCard(uid: number): boolean {
    const c = this.masterDeck.find((x) => x.uid === uid);
    if (!c || c.upgraded) return false;
    c.upgraded = true;
    return true;
  }

  private generateSpireMap(): void {
    this.mapRows = [];
    const totalRows = 15; // 3 realms * 5 floors

    for (let r = 0; r < totalRows; r++) {
      const realm = (Math.floor(r / 5) + 1) as 1 | 2 | 3;
      const localFloor = r % 5;
      const isBossRow = localFloor === 4;
      const cols = isBossRow ? [1] : [0, 1, 2];
      const rowNodes: MapNode[] = [];

      for (const c of cols) {
        let kind: MapNodeKind = 'battle';
        if (isBossRow) {
          kind = 'boss';
        } else if (localFloor === 0) {
          kind = 'battle';
        } else if (localFloor === 1) {
          const pool: MapNodeKind[] = ['battle', 'event', 'shop'];
          kind = pool[(c + realm + this.rng.intInclusive(0, 2)) % pool.length];
        } else if (localFloor === 2) {
          // Guaranteed Elite choice on col 1, Battle/Event on flanks
          kind = c === 1 ? 'elite' : c === 0 ? 'battle' : 'event';
        } else if (localFloor === 3) {
          // Pre-Boss Preparation Floor: Rest/Forge & Shop!
          kind = c === 1 ? 'rest' : c === 2 ? 'shop' : 'rest';
        }

        rowNodes.push({
          id: `r${r}_c${c}`,
          row: r,
          col: c,
          realm,
          kind,
          nextIds: [],
          cleared: false,
        });
      }
      this.mapRows.push(rowNodes);
    }

    // Wire clean non-crossing Slay-the-Spire forward edges
    for (let r = 0; r < totalRows - 1; r++) {
      const cur = this.mapRows[r];
      const nxt = this.mapRows[r + 1];
      if (nxt.length === 1) {
        for (const n of cur) n.nextIds = [nxt[0].id];
      } else if (cur.length === 1) {
        cur[0].nextIds = nxt.map((x) => x.id);
      } else {
        for (let i = 0; i < cur.length; i++) {
          cur[i].nextIds.push(nxt[i].id);
          const neighbor = i === 0 ? 1 : i === 2 ? 1 : this.rng.nextFloat() < 0.5 ? 0 : 2;
          if (!cur[i].nextIds.includes(nxt[neighbor].id)) {
            cur[i].nextIds.push(nxt[neighbor].id);
          }
        }
      }
    }
  }

  public getSelectableNodeIds(): Set<string> {
    if (this.currentRow === -1) {
      return new Set(this.mapRows[0].map((n) => n.id));
    }
    const curNode = this.mapRows[this.currentRow]?.find((n) => n.id === this.currentNodeId);
    return new Set(curNode ? curNode.nextIds : []);
  }

  public enterMapNode(nodeId: string): boolean {
    if (this.runPhase !== 'map') return false;
    const legal = this.getSelectableNodeIds();
    if (!legal.has(nodeId)) return false;

    let targetNode: MapNode | undefined;
    for (const row of this.mapRows) {
      const f = row.find((n) => n.id === nodeId);
      if (f) {
        targetNode = f;
        break;
      }
    }
    if (!targetNode) return false;

    this.currentRow = targetNode.row;
    this.currentNodeId = targetNode.id;
    targetNode.cleared = true;

    if (targetNode.kind === 'battle' || targetNode.kind === 'elite' || targetNode.kind === 'boss') {
      const enc = this.pickEncounterForNode(targetNode);
      this.startCombat(enc, targetNode.realm);
    } else if (targetNode.kind === 'rest') {
      this.runPhase = 'rest';
    } else if (targetNode.kind === 'shop') {
      this.openShop(targetNode.realm);
    } else if (targetNode.kind === 'event') {
      this.openRandomEvent();
    }
    return true;
  }

  private pickEncounterForNode(node: MapNode): string[] {
    if (node.kind === 'boss') {
      if (node.realm === 1) return ['boss_spider_queen'];
      if (node.realm === 2) return ['boss_sword_demon'];
      return ['boss_fallen_immortal'];
    }
    if (node.kind === 'elite') {
      if (node.realm === 1) return ['elite_bull_king'];
      if (node.realm === 2) return ['elite_sword_wraith', 'wolf_demon'];
      return ['elite_bull_king', 'elite_sword_wraith'];
    }
    // Normal battles scaled smoothly by floor & realm!
    if (node.row === 0) {
      return this.rng.nextFloat() < 0.5 ? ['wolf_demon'] : ['talon_ghost'];
    }
    if (node.realm === 1) {
      const opts = [
        ['wolf_demon', 'talon_ghost'],
        ['iron_puppet'],
        ['wolf_demon', 'wolf_demon'],
      ];
      return this.rng.pick(opts);
    }
    if (node.realm === 2) {
      const opts = [
        ['iron_puppet', 'talon_ghost'],
        ['wolf_demon', 'talon_ghost', 'wolf_demon'],
        ['iron_puppet', 'wolf_demon'],
      ];
      return this.rng.pick(opts);
    }
    const opts = [
      ['iron_puppet', 'iron_puppet'],
      ['iron_puppet', 'talon_ghost', 'wolf_demon'],
    ];
    return this.rng.pick(opts);
  }

  // =========================================================================
  // Combat Lifecycle & Strict 5-Zone Card Management
  // =========================================================================
  public startCombat(enemyArchIds: string[], realm: 1 | 2 | 3 = 1): void {
    this.runPhase = 'combat';
    this.turn = 0;
    this.block = 0;
    this.strength = this.hasRelic('sword_manual') ? 2 : 0;
    this.dexterity = this.hasRelic('frost_lotus') ? 1 : 0;
    this.thorns = 0;
    this.weak = 0;
    this.vuln = 0;
    this.drawOnSword = 0;
    this.blockOnSword = 0;
    this.bonusQiRegen = this.hasRelic('kunlun_cauldron') ? 1 : 0;
    this.attacksPlayedCount = 0;
    this.attacksPlayedThisTurn = 0;

    this.maxSwordSlots = 5 + (this.hasRelic('spirit_gourd') ? 2 : 0);
    this.swordBox = [];
    this.triggeredFormationsThisTurn.clear();
    this.effectQueue = [];

    // Populate drawPile with fresh clones of masterDeck instances
    this.drawPile = this.masterDeck.map((c) => ({ ...c }));
    this.hand = [];
    this.limbo = [];
    this.discardPile = [];
    this.exhaustPile = [];
    this.combatTotalCards = this.drawPile.length;
    this.rng.shuffleInPlace(this.drawPile);

    // Spawn Enemies with gentle realm HP scaling on normal mobs
    const hpScale = realm === 1 ? 1.0 : realm === 2 ? 1.24 : 1.48;
    this.enemies = enemyArchIds.map((id) => {
      const arch = ENEMIES[id];
      const scaledHp = arch.isBoss || arch.isElite ? arch.maxHp : Math.round(arch.maxHp * hpScale);
      const startMoveIdx = 0;
      return {
        uid: this.nextEnemyUid++,
        archId: id,
        name: arch.name,
        modelName: arch.modelName,
        scale: arch.scale,
        tintHex: arch.tintHex,
        isBoss: !!arch.isBoss,
        isElite: !!arch.isElite,
        hp: scaledHp,
        maxHp: scaledHp,
        block: 0,
        strength: realm === 3 && !arch.isBoss ? 2 : 0,
        vuln: 0,
        weak: 0,
        burn: 0,
        moveIndex: startMoveIdx,
        intent: arch.moves[startMoveIdx],
      };
    });
    this.selectedTargetIdx = 0;

    // Combat-start Relic Triggers
    if (this.hasRelic('qingping_box')) {
      this.channelSword('metal');
    }
    if (this.hasRelic('thunder_drum')) {
      for (const e of this.enemies) e.vuln += 2;
      this.visualEvents.push({ kind: 'toast', text: '⚡【夔牛震天鼓】轰鸣！群妖陷入破绽！' });
    }

    this.beginPlayerTurn();
    if (this.hasRelic('frost_lotus')) {
      this.gainBlock(10);
    }
    this.assertZoneInvariant();
  }

  public hasRelic(id: string): boolean {
    return this.relics.includes(id);
  }

  public assertZoneInvariant(): void {
    const seen = new Set<number>();
    const zones = [this.drawPile, this.hand, this.limbo, this.discardPile, this.exhaustPile];
    let total = 0;
    for (const z of zones) {
      for (const c of z) {
        if (seen.has(c.uid)) {
          throw new Error(`Card zone invariant violated: duplicate uid=${c.uid}`);
        }
        seen.add(c.uid);
        total++;
      }
    }
    if (total !== this.combatTotalCards) {
      throw new Error(
        `Card zone count mismatch: expected ${this.combatTotalCards}, got ${total}`
      );
    }
  }

  public beginPlayerTurn(): void {
    this.turn++;
    this.block = 0;
    this.attacksPlayedThisTurn = 0;
    this.triggeredFormationsThisTurn.clear();

    this.qi =
      this.baseQiPerTurn +
      this.bonusQiRegen +
      (this.turn === 1 && this.hasRelic('bagua_furnace') ? 1 : 0);

    const drawCount =
      BASE_DRAW + (this.turn === 1 && this.hasRelic('spirit_gourd') ? 1 : 0);
    this.drawCards(drawCount);
    this.ensureValidSelectedTarget();
    this.assertZoneInvariant();
  }

  public drawCards(count: number): void {
    for (let i = 0; i < count; i++) {
      if (this.drawPile.length === 0) {
        if (this.discardPile.length === 0) break;
        this.drawPile = this.discardPile;
        this.discardPile = [];
        this.rng.shuffleInPlace(this.drawPile);
      }
      const card = this.drawPile.pop()!;
      if (this.hand.length >= HAND_CAP) {
        this.discardPile.push(card);
        this.logs.push(`手牌已满，${this.getCardTitle(card)} 落入弃牌堆`);
      } else {
        this.hand.push(card);
      }
    }
  }

  // Atomic Play from Hand -> Limbo -> Resolve Queue -> Discard / Exhaust!
  public playCard(cardUid: number, targetIdx = this.selectedTargetIdx): boolean {
    if (this.runPhase !== 'combat') return false;
    const handIdx = this.hand.findIndex((c) => c.uid === cardUid);
    if (handIdx < 0) return false;

    const card = this.hand[handIdx];
    const def = CARDS[card.defId];
    const cost = this.getCardCost(card);
    if (this.qi < cost) return false;

    let resolvedTarget = targetIdx;
    if (def.target === 'single') {
      if (!this.enemies[resolvedTarget] || this.enemies[resolvedTarget].hp <= 0) {
        resolvedTarget = this.firstLivingEnemyIdx();
      }
      if (resolvedTarget < 0) return false;
    }

    // Commit cost & move Hand -> Limbo
    this.qi -= cost;
    this.hand.splice(handIdx, 1);
    this.limbo.push(card);

    if (def.type === 'attack') {
      this.attacksPlayedCount++;
      this.attacksPlayedThisTurn++;
      this.visualEvents.push({
        kind: 'hero_slash',
        targetIdx: Math.max(0, resolvedTarget),
        colorHex: def.elementTag ? SWORD_ELEMENTS[def.elementTag].colorHex : 0xfbbf24,
        heavy: cost >= 2,
      });
    } else {
      this.visualEvents.push({
        kind: 'hero_cast',
        colorHex: def.elementTag ? SWORD_ELEMENTS[def.elementTag].colorHex : 0x38bdf8,
      });
    }

    const ops = this.getCardOps(card);
    for (const op of ops) {
      this.pushEffect(op, resolvedTarget);
    }

    // Heaven Mirror Relic: every 3rd attack deals 7 bonus damage to weakest enemy
    if (def.type === 'attack' && this.hasRelic('heaven_mirror') && this.attacksPlayedCount % 3 === 0) {
      const lowIdx = this.lowestHpEnemyIdx();
      if (lowIdx >= 0) {
        this.pushEffect({ op: 'damage', amount: 7 }, lowIdx);
        this.visualEvents.push({ kind: 'toast', text: '✨【昊天照妖镜】射出金光追击！' });
      }
    }

    this.resolveQueue();

    // Move Limbo -> Destination
    const limboIdx = this.limbo.findIndex((c) => c.uid === card.uid);
    if (limboIdx >= 0) {
      this.limbo.splice(limboIdx, 1);
      if (def.exhaust || def.type === 'power') {
        this.exhaustPile.push(card);
      } else {
        this.discardPile.push(card);
      }
    }

    this.assertZoneInvariant();
    this.checkCombatOutcome();
    return true;
  }

  public pushEffect(op: EffectOp, targetIdx: number): void {
    this.effectQueue.push({ op, targetIdx });
  }

  private resolveQueue(): void {
    let pushes = 0;
    while (this.effectQueue.length > 0) {
      if (pushes++ >= MAX_PUSHES) {
        this.effectQueue = [];
        this.logs.push('trigger loop stopped');
        break;
      }
      const { op, targetIdx } = this.effectQueue.shift()!;
      this.executeOp(op, targetIdx);
      if (this.hp <= 0 || this.allEnemiesDead()) {
        // Still allow non-enemy self buffs? Stopping if dead keeps resolution crisp
        if (this.hp <= 0) {
          this.effectQueue = [];
          break;
        }
      }
    }
  }

  private executeOp(op: EffectOp, targetIdx: number): void {
    switch (op.op) {
      case 'damage': {
        const hits = op.hits || 1;
        for (let h = 0; h < hits; h++) {
          if (op.target === 'all') {
            for (let ei = 0; ei < this.enemies.length; ei++) {
              if (this.enemies[ei].hp > 0) {
                this.dealCardDamageToEnemy(ei, op.amount, 0xfbbf24);
              }
            }
          } else if (op.target === 'random') {
            const rIdx = this.randomLivingEnemyIdx();
            if (rIdx >= 0) this.dealCardDamageToEnemy(rIdx, op.amount, 0xfbbf24);
          } else {
            const tIdx =
              this.enemies[targetIdx] && this.enemies[targetIdx].hp > 0
                ? targetIdx
                : this.firstLivingEnemyIdx();
            if (tIdx >= 0) this.dealCardDamageToEnemy(tIdx, op.amount, 0xfbbf24);
          }
        }
        break;
      }
      case 'damage_by_block': {
        const tIdx =
          this.enemies[targetIdx] && this.enemies[targetIdx].hp > 0
            ? targetIdx
            : this.firstLivingEnemyIdx();
        if (tIdx >= 0) {
          const raw = Math.round(this.block * op.mult);
          this.dealCardDamageToEnemy(tIdx, raw, 0xfef08a);
        }
        break;
      }
      case 'damage_per_sword': {
        const tIdx =
          this.enemies[targetIdx] && this.enemies[targetIdx].hp > 0
            ? targetIdx
            : this.firstLivingEnemyIdx();
        if (tIdx >= 0) {
          const raw = op.base + this.swordBox.length * op.perSword;
          this.dealCardDamageToEnemy(tIdx, raw, 0x67e8f9);
        }
        break;
      }
      case 'block': {
        this.gainBlock(this.previewCardBlock(op.amount));
        break;
      }
      case 'draw': {
        this.drawCards(op.amount);
        break;
      }
      case 'gain_qi': {
        this.qi += op.amount;
        break;
      }
      case 'lose_hp': {
        this.applyHeroSelfHpLoss(op.amount);
        break;
      }
      case 'heal': {
        this.healHero(op.amount);
        break;
      }
      case 'channel_sword': {
        const n = op.count || 1;
        for (let k = 0; k < n; k++) {
          this.channelSword(op.element);
        }
        break;
      }
      case 'evoke_next': {
        if (this.swordBox.length > 0) {
          const el = this.swordBox.shift()!;
          const times = op.times || 1;
          for (let k = 0; k < times; k++) {
            this.evokeSword(el);
          }
        }
        break;
      }
      case 'evoke_all': {
        const times = op.times || 1;
        const copy = [...this.swordBox];
        this.swordBox = [];
        for (const el of copy) {
          for (let k = 0; k < times; k++) {
            this.evokeSword(el);
          }
        }
        break;
      }
      case 'expand_box': {
        this.maxSwordSlots = Math.min(8, this.maxSwordSlots + op.amount);
        break;
      }
      case 'status_enemy': {
        const indices =
          op.target === 'all'
            ? this.enemies.map((_, idx) => idx)
            : [
                this.enemies[targetIdx] && this.enemies[targetIdx].hp > 0
                  ? targetIdx
                  : this.firstLivingEnemyIdx(),
              ];
        for (const ei of indices) {
          const e = this.enemies[ei];
          if (!e || e.hp <= 0) continue;
          if (op.status === 'vuln') e.vuln += op.amount;
          else if (op.status === 'weak') e.weak += op.amount;
          else if (op.status === 'burn') {
            const extra = this.hasRelic('phoenix_feather') ? 2 : 0;
            e.burn += op.amount + extra;
          }
        }
        break;
      }
      case 'double_burn': {
        const tIdx =
          this.enemies[targetIdx] && this.enemies[targetIdx].hp > 0
            ? targetIdx
            : this.firstLivingEnemyIdx();
        if (tIdx >= 0 && this.enemies[tIdx].burn > 0) {
          this.enemies[tIdx].burn *= 2;
          this.visualEvents.push({
            kind: 'toast',
            text: `🔥 三昧真火催动！【丹火】翻倍至 ${this.enemies[tIdx].burn} 层！`,
          });
        }
        break;
      }
      case 'buff_self': {
        if (op.buff === 'strength') this.strength += op.amount;
        else if (op.buff === 'dexterity') this.dexterity += op.amount;
        else if (op.buff === 'thorns') this.thorns += op.amount;
        else if (op.buff === 'draw_on_sword') this.drawOnSword += op.amount;
        else if (op.buff === 'block_on_sword') this.blockOnSword += op.amount;
        else if (op.buff === 'qi_regen') this.bonusQiRegen += op.amount;
        break;
      }
    }
  }

  // =========================================================================
  // Floating Sword Box (悬空剑匣) & Five-Element Sword Formations!
  // =========================================================================
  public channelSword(el: SwordElement): void {
    if (this.swordBox.length >= this.maxSwordSlots) {
      const oldest = this.swordBox.shift()!;
      this.evokeSword(oldest);
    }
    this.swordBox.push(el);

    if (this.blockOnSword > 0) {
      this.gainBlock(this.blockOnSword);
    }
    if (this.drawOnSword > 0) {
      this.drawCards(this.drawOnSword);
    }

    // Check Five-Element Sword Formation Resonance!
    const present = new Set(this.swordBox);
    for (const fm of SWORD_FORMATIONS) {
      if (
        !this.triggeredFormationsThisTurn.has(fm.id) &&
        present.has(fm.req[0]) &&
        present.has(fm.req[1])
      ) {
        this.triggeredFormationsThisTurn.add(fm.id);
        this.triggerSwordFormation(fm.id, fm.name, fm.colorHex);
      }
    }

    if (present.size >= 4 && !this.triggeredFormationsThisTurn.has('supreme_4')) {
      this.triggeredFormationsThisTurn.add('supreme_4');
      this.visualEvents.push({
        kind: 'formation',
        name: '★ 四象诛仙剑阵',
        colorHex: 0xfde047,
      });
      this.gainBlock(12);
      for (let ei = 0; ei < this.enemies.length; ei++) {
        if (this.enemies[ei].hp > 0) {
          this.applyRawDamageToEnemy(ei, 16, 0xfde047);
        }
      }
    }
  }

  private triggerSwordFormation(id: string, name: string, colorHex: number): void {
    this.visualEvents.push({ kind: 'formation', name, colorHex });
    if (this.hasRelic('bagua_furnace')) {
      this.drawCards(1);
    }

    if (id === 'thunder_fire') {
      for (let ei = 0; ei < this.enemies.length; ei++) {
        const e = this.enemies[ei];
        if (e.hp > 0) {
          e.vuln += 2;
          this.applyRawDamageToEnemy(ei, 11, colorHex);
        }
      }
    } else if (id === 'ice_metal') {
      this.gainBlock(9);
      const tIdx = this.lowestHpEnemyIdx();
      if (tIdx >= 0) this.applyRawDamageToEnemy(tIdx, 9 + this.strength, colorHex);
    } else if (id === 'wood_fire') {
      this.qi += 1;
      this.drawCards(1);
      for (const e of this.enemies) {
        if (e.hp > 0) e.burn += 4;
      }
    } else if (id === 'thunder_ice') {
      for (let ei = 0; ei < this.enemies.length; ei++) {
        const e = this.enemies[ei];
        if (e.hp > 0) {
          e.weak += 2;
          this.applyRawDamageToEnemy(ei, 8, colorHex);
        }
      }
    }
  }

  private evokeSword(el: SwordElement): void {
    const spec = SWORD_ELEMENTS[el];
    if (el === 'metal') {
      const tIdx = this.lowestHpEnemyIdx();
      if (tIdx >= 0) {
        this.visualEvents.push({ kind: 'sword_fly', element: el, targetIdx: tIdx, isEvoke: true });
        this.applyRawDamageToEnemy(tIdx, 10 + this.strength, spec.colorHex);
      }
    } else if (el === 'fire') {
      const tIdx = this.firstLivingEnemyIdx();
      if (tIdx >= 0) {
        this.visualEvents.push({ kind: 'sword_fly', element: el, targetIdx: tIdx, isEvoke: true });
        this.enemies[tIdx].burn += 4 + (this.hasRelic('phoenix_feather') ? 2 : 0);
        this.applyRawDamageToEnemy(tIdx, this.enemies[tIdx].burn, spec.colorHex);
      }
    } else if (el === 'thunder') {
      const tIdx = Math.max(0, this.firstLivingEnemyIdx());
      this.visualEvents.push({ kind: 'sword_fly', element: el, targetIdx: tIdx, isEvoke: true });
      for (let ei = 0; ei < this.enemies.length; ei++) {
        if (this.enemies[ei].hp > 0) {
          this.enemies[ei].weak += 1;
          this.applyRawDamageToEnemy(ei, 9, spec.colorHex);
        }
      }
    } else if (el === 'ice') {
      this.visualEvents.push({ kind: 'sword_fly', element: el, targetIdx: 0, isEvoke: true });
      this.gainBlock(10 + this.dexterity);
    } else if (el === 'wood') {
      this.visualEvents.push({ kind: 'sword_fly', element: el, targetIdx: 0, isEvoke: true });
      this.qi += 1;
      this.drawCards(1);
    }
  }

  private stepEndTurnPassiveSwords(): void {
    for (const el of this.swordBox) {
      const spec = SWORD_ELEMENTS[el];
      if (el === 'metal') {
        const tIdx = this.lowestHpEnemyIdx();
        if (tIdx >= 0) {
          this.visualEvents.push({ kind: 'sword_fly', element: el, targetIdx: tIdx, isEvoke: false });
          this.applyRawDamageToEnemy(tIdx, 4 + this.strength, spec.colorHex);
        }
      } else if (el === 'fire') {
        const tIdx = this.firstLivingEnemyIdx();
        if (tIdx >= 0) {
          this.visualEvents.push({ kind: 'sword_fly', element: el, targetIdx: tIdx, isEvoke: false });
          this.enemies[tIdx].burn += 3 + (this.hasRelic('phoenix_feather') ? 2 : 0);
        }
      } else if (el === 'thunder') {
        if (!this.allEnemiesDead()) {
          this.visualEvents.push({ kind: 'sword_fly', element: el, targetIdx: 0, isEvoke: false });
          for (let ei = 0; ei < this.enemies.length; ei++) {
            if (this.enemies[ei].hp > 0) {
              this.applyRawDamageToEnemy(ei, 3, spec.colorHex);
            }
          }
        }
      } else if (el === 'ice') {
        this.gainBlock(4);
      } else if (el === 'wood') {
        this.healHero(2);
      }
    }
  }

  // =========================================================================
  // End Turn -> Passive Swords -> Enemy Intents -> Next Turn!
  // =========================================================================
  public endPlayerTurn(): void {
    if (this.runPhase !== 'combat') return;

    // 1. Discard non-retain cards in hand
    const kept: CardInstance[] = [];
    for (const c of this.hand) {
      if (CARDS[c.defId].retain) {
        kept.push(c);
      } else {
        this.discardPile.push(c);
      }
    }
    this.hand = kept;
    this.assertZoneInvariant();

    // 2. Jade Pendant Relic
    if (this.hasRelic('jade_pendant') && (this.attacksPlayedThisTurn === 0 || this.block === 0)) {
      this.gainBlock(6);
    }

    // 3. Passive Floating Swords Act
    this.stepEndTurnPassiveSwords();
    if (this.checkCombatOutcome()) return;

    // 4. Enemy Turn: Burn DoT ticks first, then living enemies execute Intents!
    for (let ei = 0; ei < this.enemies.length; ei++) {
      const e = this.enemies[ei];
      if (e.hp <= 0) continue;

      if (e.burn > 0) {
        this.applyRawDamageToEnemy(ei, e.burn, 0xf97316, true);
        e.burn = Math.max(0, e.burn - 1);
        if (e.hp <= 0) continue;
      }

      e.block = 0;
      const mv = e.intent;
      const isAtk = !!mv.dmg && mv.dmg > 0;
      this.visualEvents.push({ kind: 'enemy_act', enemyIdx: ei, attack: isAtk });

      if (mv.block) {
        e.block += mv.block;
      }
      if (mv.dmg) {
        const hits = mv.hits || 1;
        const perHit = this.previewEnemyAttackDamage(e);
        for (let h = 0; h < hits; h++) {
          this.damageHeroFromEnemy(perHit, ei);
          if (this.hp <= 0) break;
        }
      }
      if (mv.strength) e.strength += mv.strength;
      if (mv.applyVuln) this.vuln += mv.applyVuln;
      if (mv.applyWeak) this.weak += mv.applyWeak;

      if (this.hp <= 0) break;

      // Decay enemy debuffs & advance deterministic cycle move!
      if (e.vuln > 0) e.vuln--;
      if (e.weak > 0) e.weak--;
      const arch = ENEMIES[e.archId];
      e.moveIndex = (e.moveIndex + 1) % arch.moves.length;
      e.intent = arch.moves[e.moveIndex];
    }

    if (this.weak > 0) this.weak--;
    if (this.vuln > 0) this.vuln--;

    if (this.checkCombatOutcome()) return;
    this.beginPlayerTurn();
  }

  // =========================================================================
  // Damage, Block, Healing & Post-Combat Rewards
  // =========================================================================
  private gainBlock(amount: number): void {
    if (amount <= 0) return;
    this.block += amount;
    this.visualEvents.push({ kind: 'block_hero', amount });
  }

  private healHero(amount: number): void {
    if (amount <= 0 || this.hp <= 0) return;
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    const gained = this.hp - before;
    if (gained > 0) {
      this.visualEvents.push({ kind: 'heal_hero', amount: gained });
    }
  }

  private applyHeroSelfHpLoss(amount: number): void {
    if (amount <= 0) return;
    this.hp = Math.max(1, this.hp - amount);
    if (this.hasRelic('asura_sarira')) {
      this.strength += 1;
    }
    this.visualEvents.push({ kind: 'damage_hero', amount, blocked: 0 });
  }

  private damageHeroFromEnemy(dmg: number, attackerIdx: number): void {
    const blocked = Math.min(this.block, dmg);
    const unblocked = Math.max(0, dmg - blocked);
    this.block -= blocked;
    if (unblocked > 0) {
      this.hp = Math.max(0, this.hp - unblocked);
      if (this.hasRelic('asura_sarira')) {
        this.strength += 1;
      }
      if (this.hp <= 0 && this.hasRelic('phoenix_feather') && !this.phoenixUsed) {
        this.phoenixUsed = true;
        this.hp = Math.max(1, Math.round(this.maxHp * 0.35));
        this.visualEvents.push({
          kind: 'toast',
          text: '🔥【朱雀涅槃羽】浴火护主！回复 35% 气血！',
        });
      }
    }
    this.visualEvents.push({ kind: 'damage_hero', amount: unblocked, blocked });

    if (this.thorns > 0 && this.enemies[attackerIdx]?.hp > 0) {
      this.applyRawDamageToEnemy(attackerIdx, this.thorns, 0xfbbf24, true);
    }
  }

  private dealCardDamageToEnemy(idx: number, baseAmt: number, colorHex: number): void {
    const finalDmg = this.previewCardDamage(baseAmt, idx);
    this.applyRawDamageToEnemy(idx, finalDmg, colorHex, true);
  }

  private applyRawDamageToEnemy(
    idx: number,
    dmg: number,
    colorHex: number,
    alreadyScaled = false
  ): void {
    const e = this.enemies[idx];
    if (!e || e.hp <= 0) return;
    let total = dmg;
    if (!alreadyScaled && e.vuln > 0) {
      total = Math.floor(total * 1.5);
    }
    const blocked = Math.min(e.block, total);
    const hpLoss = Math.max(0, total - blocked);
    e.block -= blocked;
    e.hp = Math.max(0, e.hp - hpLoss);
    this.visualEvents.push({
      kind: 'damage_enemy',
      targetIdx: idx,
      amount: hpLoss,
      blocked,
      colorHex,
    });
    if (e.hp <= 0) {
      this.ensureValidSelectedTarget();
    }
  }

  private checkCombatOutcome(): boolean {
    if (this.hp <= 0) {
      this.runPhase = 'gameover';
      return true;
    }
    if (this.allEnemiesDead()) {
      if (this.hasRelic('asura_sarira')) {
        this.hp = Math.min(this.maxHp, this.hp + 6);
      }
      // Check if Final Floor 14 Boss defeated!
      if (this.currentRow >= 14) {
        this.runPhase = 'victory';
        return true;
      }
      // Realm Boss full-ish recovery + generous rewards
      const anyBoss = this.enemies.some((e) => e.isBoss);
      const anyElite = this.enemies.some((e) => e.isElite);
      if (anyBoss) {
        this.hp = Math.min(this.maxHp, this.hp + Math.round(this.maxHp * 0.5));
      }
      this.generateCombatRewards(anyBoss, anyElite);
      this.runPhase = 'reward';
      return true;
    }
    return false;
  }

  private generateCombatRewards(isBoss: boolean, isElite: boolean): void {
    this.rewardGold = isBoss
      ? this.rng.intInclusive(85, 110)
      : isElite
      ? this.rng.intInclusive(48, 65)
      : this.rng.intInclusive(24, 36);
    this.gold += this.rewardGold;

    this.rewardRelicId = null;
    if (isBoss || isElite) {
      const relicPool = Object.values(RELICS).filter(
        (r) => !r.starterOnly && !this.hasRelic(r.id)
      );
      if (relicPool.length > 0) {
        const picked = this.rng.pick(relicPool);
        this.rewardRelicId = picked.id;
        this.relics.push(picked.id);
      }
    }

    // Roll 3 distinct draftable cards weighted by rarity
    const draftPool = Object.values(CARDS).filter((c) => c.rarity !== 'starter');
    const chosenIds = new Set<string>();
    this.rewardCards = [];

    while (this.rewardCards.length < 3 && chosenIds.size < draftPool.length) {
      const roll = this.rng.nextFloat();
      const wantRarity = isBoss
        ? 'rare'
        : isElite
        ? roll < 0.28
          ? 'rare'
          : roll < 0.72
          ? 'uncommon'
          : 'common'
        : roll < 0.10
        ? 'rare'
        : roll < 0.44
        ? 'uncommon'
        : 'common';

      const candidates = draftPool.filter(
        (c) => c.rarity === wantRarity && !chosenIds.has(c.id)
      );
      const cDef: CardDef =
        candidates.length > 0
          ? this.rng.pick(candidates)
          : this.rng.pick(draftPool.filter((c) => !chosenIds.has(c.id)));
      chosenIds.add(cDef.id);
      const upg = !isBoss && this.currentRow >= 5 && this.rng.nextFloat() < 0.22;
      this.rewardCards.push({
        uid: this.nextCardUid++,
        defId: cDef.id,
        upgraded: upg,
      });
    }
  }

  public claimRewardCard(uid: number | null): void {
    if (this.runPhase !== 'reward') return;
    if (uid !== null) {
      const picked = this.rewardCards.find((c) => c.uid === uid);
      if (picked) {
        this.masterDeck.push({ ...picked });
      }
    }
    this.rewardCards = [];
    this.runPhase = 'map';
  }

  // =========================================================================
  // Rest Site (打坐调息 / 剑炉淬炼+), Merchant Shop & Mystery Events
  // =========================================================================
  public restMeditate(): void {
    if (this.runPhase !== 'rest') return;
    const healAmt = Math.max(15, Math.round(this.maxHp * 0.35));
    this.hp = Math.min(this.maxHp, this.hp + healAmt);
    this.runPhase = 'map';
  }

  public restForgeCard(cardUid: number): boolean {
    if (this.runPhase !== 'rest') return false;
    if (!this.upgradeMasterCard(cardUid)) return false;
    this.runPhase = 'map';
    return true;
  }

  private openShop(realm: 1 | 2 | 3): void {
    this.runPhase = 'shop';
    const pool = Object.values(CARDS).filter((c) => c.rarity !== 'starter');
    this.rng.shuffleInPlace(pool);
    const cards = pool.slice(0, 5).map((c) => {
      const baseP = c.rarity === 'rare' ? 115 : c.rarity === 'uncommon' ? 72 : 46;
      return {
        card: { uid: this.nextCardUid++, defId: c.id, upgraded: realm >= 2 && this.rng.nextFloat() < 0.25 },
        price: baseP + this.rng.intInclusive(-6, 8),
        sold: false,
      };
    });

    const relicPool = Object.values(RELICS).filter((r) => !r.starterOnly && !this.hasRelic(r.id));
    const relic =
      relicPool.length > 0
        ? (() => {
            const r = this.rng.pick(relicPool);
            return { relicId: r.id, price: r.price, sold: false };
          })()
        : null;

    this.currentShop = {
      cards,
      relic,
      removePrice: 55,
      removeUsed: false,
      healPrice: 40,
      healUsed: false,
    };
  }

  public buyShopCard(idx: number): boolean {
    if (this.runPhase !== 'shop' || !this.currentShop) return false;
    const item = this.currentShop.cards[idx];
    if (!item || item.sold || this.gold < item.price) return false;
    this.gold -= item.price;
    item.sold = true;
    this.masterDeck.push({ ...item.card });
    return true;
  }

  public buyShopRelic(): boolean {
    if (this.runPhase !== 'shop' || !this.currentShop?.relic) return false;
    const r = this.currentShop.relic;
    if (r.sold || this.gold < r.price) return false;
    this.gold -= r.price;
    r.sold = true;
    this.relics.push(r.relicId);
    return true;
  }

  public buyShopHeal(): boolean {
    if (this.runPhase !== 'shop' || !this.currentShop || this.currentShop.healUsed) return false;
    if (this.gold < this.currentShop.healPrice) return false;
    this.gold -= this.currentShop.healPrice;
    this.currentShop.healUsed = true;
    this.hp = Math.min(this.maxHp, this.hp + Math.round(this.maxHp * 0.3));
    return true;
  }

  public buyShopRemoveCard(uid: number): boolean {
    if (this.runPhase !== 'shop' || !this.currentShop || this.currentShop.removeUsed) return false;
    if (this.gold < this.currentShop.removePrice) return false;
    if (!this.removeCardFromMasterDeck(uid)) return false;
    this.gold -= this.currentShop.removePrice;
    this.currentShop.removeUsed = true;
    return true;
  }

  public leaveSubScreen(): void {
    if (this.runPhase === 'shop' || this.runPhase === 'event') {
      this.runPhase = 'map';
    }
  }

  private openRandomEvent(): void {
    this.runPhase = 'event';
    const events: XianxiaEventSpec[] = [
      {
        id: 'ancient_stele',
        title: '☯️ 太古残剑碑',
        desc: '云雾深处矗立着一座布满剑痕的玄石古碑，隐约透出凌厉无匹的上古剑意。',
        choices: [
          { label: '以血祭碑 · 领悟绝学', hint: '失去 8 点气血，随机获得 1 张【稀有神通/飞剑牌】！', outcomeId: 'blood_rare' },
          { label: '静心拓印 · 淬炼双剑', hint: '随机使牌库中 2 张卡牌免费升阶为【+】！', outcomeId: 'upgrade_two' },
          { label: '搜寻碑底灵石', hint: '稳健获得 +55 枚灵石', outcomeId: 'gain_gold' },
        ],
      },
      {
        id: 'cleansing_spring',
        title: '🌊 忘尘洗剑池',
        desc: '一汪澄澈寒潭映照本心，投入俗世冗杂剑招可涤荡道基，令出剑更为纯粹凌厉。',
        choices: [
          { label: '洗髓忘尘 · 斩除杂念', hint: '自动移除牌库中 1 张基础【御剑诀】或【护体剑罡】！', outcomeId: 'purge_basic' },
          { label: '饮泉筑基 · 固本培元', hint: '最大气血上限 +8，并回复 16 点气血！', outcomeId: 'max_hp_up' },
        ],
      },
      {
        id: 'cursed_peddler',
        title: '🏮 鬼市神秘剑客',
        desc: '黑斗篷老者摊开一方紫檀布卷，上面摆着尚未认主的仙家法宝与丹药。',
        choices: [
          { label: '倾囊换宝', hint: '消耗 50 灵石（不足则扣10血），直接获得 1 件随机【秘境法宝】！', outcomeId: 'buy_relic_cheap' },
          { label: '切磋剑道', hint: '回复 12 点气血，随机升级 1 张牌', outcomeId: 'spar_upgrade' },
        ],
      },
    ];
    this.currentEvent = this.rng.pick(events);
  }

  public chooseEventOption(outcomeId: string): string {
    if (this.runPhase !== 'event') return '';
    let summary = '';
    if (outcomeId === 'blood_rare') {
      this.hp = Math.max(1, this.hp - 8);
      const rares = Object.values(CARDS).filter((c) => c.rarity === 'rare');
      const picked = this.rng.pick(rares);
      this.addCardToMasterDeck(picked.id, false);
      summary = `以血祭碑！获得了稀有绝学【${picked.name}】！`;
    } else if (outcomeId === 'upgrade_two') {
      const candidates = this.masterDeck.filter((c) => !c.upgraded);
      this.rng.shuffleInPlace(candidates);
      const count = Math.min(2, candidates.length);
      for (let i = 0; i < count; i++) candidates[i].upgraded = true;
      summary = `剑意贯通！已将 ${count} 张卡牌淬炼升阶为【+】！`;
    } else if (outcomeId === 'gain_gold') {
      this.gold += 55;
      summary = '在古碑下寻得 +55 枚灵石！';
    } else if (outcomeId === 'purge_basic') {
      const basic = this.masterDeck.find((c) => c.defId === 'strike' || c.defId === 'defend');
      if (basic && this.removeCardFromMasterDeck(basic.uid)) {
        summary = `道心澄明！已移除冗杂基础牌【${this.getCardTitle(basic)}】！`;
      } else {
        this.gold += 40;
        summary = '牌库已极其精纯，改为获得 +40 灵石！';
      }
    } else if (outcomeId === 'max_hp_up') {
      this.maxHp += 8;
      this.hp = Math.min(this.maxHp, this.hp + 16);
      summary = '灵泉筑基！气血上限 +8 并恢复 16 点气血！';
    } else if (outcomeId === 'buy_relic_cheap') {
      if (this.gold >= 50) this.gold -= 50;
      else this.hp = Math.max(1, this.hp - 10);
      const pool = Object.values(RELICS).filter((r) => !r.starterOnly && !this.hasRelic(r.id));
      if (pool.length > 0) {
        const rel = this.rng.pick(pool);
        this.relics.push(rel.id);
        summary = `获得秘境法宝【${rel.name}】！`;
      } else {
        this.gold += 90;
        summary = '法宝已尽数集齐，获赠 +90 灵石！';
      }
    } else if (outcomeId === 'spar_upgrade') {
      this.hp = Math.min(this.maxHp, this.hp + 12);
      const cand = this.masterDeck.filter((c) => !c.upgraded);
      if (cand.length > 0) this.rng.pick(cand).upgraded = true;
      summary = '切磋尽兴！恢复 12 点气血并升级 1 张卡牌！';
    }
    this.runPhase = 'map';
    return summary;
  }

  // =========================================================================
  // Helpers & State Hash (for Deterministic Replay Verification)
  // =========================================================================
  public allEnemiesDead(): boolean {
    return this.enemies.every((e) => e.hp <= 0);
  }

  public firstLivingEnemyIdx(): number {
    return this.enemies.findIndex((e) => e.hp > 0);
  }

  public lowestHpEnemyIdx(): number {
    let best = -1;
    let minHp = Infinity;
    for (let i = 0; i < this.enemies.length; i++) {
      if (this.enemies[i].hp > 0 && this.enemies[i].hp < minHp) {
        minHp = this.enemies[i].hp;
        best = i;
      }
    }
    return best;
  }

  private randomLivingEnemyIdx(): number {
    const living: number[] = [];
    for (let i = 0; i < this.enemies.length; i++) {
      if (this.enemies[i].hp > 0) living.push(i);
    }
    return living.length > 0 ? this.rng.pick(living) : -1;
  }

  private ensureValidSelectedTarget(): void {
    if (!this.enemies[this.selectedTargetIdx] || this.enemies[this.selectedTargetIdx].hp <= 0) {
      const nxt = this.firstLivingEnemyIdx();
      this.selectedTargetIdx = Math.max(0, nxt);
    }
  }

  public computeStateHash(): string {
    return JSON.stringify({
      rng: this.rng.state,
      hp: this.hp,
      qi: this.qi,
      blk: this.block,
      str: this.strength,
      swords: this.swordBox,
      hand: this.hand.map((c) => c.uid),
      draw: this.drawPile.map((c) => c.uid),
      disc: this.discardPile.map((c) => c.uid),
      exh: this.exhaustPile.map((c) => c.uid),
      enemies: this.enemies.map((e) => [e.hp, e.block, e.burn, e.vuln, e.weak]),
    });
  }
}
