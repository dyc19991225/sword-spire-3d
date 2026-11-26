// Data-Driven Card, Elemental Sword-Box, Relic, Hero & Enemy Definitions for 《斩妖录：剑匣问天 3D》

export type SwordElement = 'metal' | 'fire' | 'thunder' | 'ice' | 'wood';
export type CardType = 'attack' | 'skill' | 'power';
export type CardRarity = 'starter' | 'common' | 'uncommon' | 'rare';
export type TargetMode = 'single' | 'all' | 'self';
export type HeroId = 'shushan' | 'talisman' | 'asura';

export type EffectOp =
  | { op: 'damage'; amount: number; hits?: number; target?: 'single' | 'all' | 'random' }
  | { op: 'damage_by_block'; mult: number }
  | { op: 'damage_per_sword'; base: number; perSword: number }
  | { op: 'block'; amount: number }
  | { op: 'draw'; amount: number }
  | { op: 'gain_qi'; amount: number }
  | { op: 'lose_hp'; amount: number }
  | { op: 'heal'; amount: number }
  | { op: 'channel_sword'; element: SwordElement; count?: number }
  | { op: 'evoke_next'; times?: number }
  | { op: 'evoke_all'; times?: number }
  | { op: 'expand_box'; amount: number }
  | { op: 'status_enemy'; status: 'vuln' | 'weak' | 'burn'; amount: number; target?: 'single' | 'all' }
  | { op: 'double_burn' }
  | { op: 'buff_self'; buff: 'strength' | 'dexterity' | 'thorns' | 'draw_on_sword' | 'block_on_sword' | 'qi_regen'; amount: number };

export interface CardDef {
  id: string;
  name: string;
  type: CardType;
  rarity: CardRarity;
  cost: number;
  plusCost?: number;
  target: TargetMode;
  art: string;
  elementTag?: SwordElement;
  exhaust?: boolean;
  retain?: boolean;
  desc: string;
  plusDesc: string;
  ops: EffectOp[];
  plusOps: EffectOp[];
}

export interface SwordElementSpec {
  id: SwordElement;
  name: string;
  short: string;
  colorHex: number;
  cssColor: string;
  passiveDesc: string;
  evokeDesc: string;
}

export const SWORD_ELEMENTS: Record<SwordElement, SwordElementSpec> = {
  metal: {
    id: 'metal',
    name: '庚金剑',
    short: '金',
    colorHex: 0xfbbf24,
    cssColor: '#fbbf24',
    passiveDesc: '回合结束刺击最低血妖魔 4 伤',
    evokeDesc: '出鞘：刺击最低血妖魔 10 伤',
  },
  fire: {
    id: 'fire',
    name: '赤炎剑',
    short: '火',
    colorHex: 0xf43f5e,
    cssColor: '#fb7185',
    passiveDesc: '回合结束对首目标叠 3 层丹火',
    evokeDesc: '出鞘：叠 4 层丹火并立即引爆 1 次',
  },
  thunder: {
    id: 'thunder',
    name: '紫雷剑',
    short: '雷',
    colorHex: 0xc084fc,
    cssColor: '#c084fc',
    passiveDesc: '回合结束轰击全体妖魔 3 伤',
    evokeDesc: '出鞘：天雷轰击全体 9 伤并附 1 层虚弱',
  },
  ice: {
    id: 'ice',
    name: '玄冰剑',
    short: '冰',
    colorHex: 0x38bdf8,
    cssColor: '#38bdf8',
    passiveDesc: '回合结束凝结 4 点护体罡气',
    evokeDesc: '出鞘：立即凝结 10 点护体罡气',
  },
  wood: {
    id: 'wood',
    name: '青木剑',
    short: '木',
    colorHex: 0x34d399,
    cssColor: '#34d399',
    passiveDesc: '回合结束吐纳回复 2 点气血',
    evokeDesc: '出鞘：+1 灵力并抽 1 张牌',
  },
};

export interface FormationSpec {
  id: string;
  name: string;
  req: [SwordElement, SwordElement];
  colorHex: number;
  desc: string;
}

export const SWORD_FORMATIONS: FormationSpec[] = [
  {
    id: 'thunder_fire',
    name: '★ 雷火天劫阵',
    req: ['fire', 'thunder'],
    colorHex: 0xf97316,
    desc: '赤炎+紫雷共鸣：轰击全体 11 伤并施加 2 层【破绽】！',
  },
  {
    id: 'ice_metal',
    name: '★ 玄冰金罡阵',
    req: ['ice', 'metal'],
    colorHex: 0x67e8f9,
    desc: '玄冰+庚金共鸣：获得 9 点护盾并对随机敌斩出 9 伤！',
  },
  {
    id: 'wood_fire',
    name: '★ 青木生火阵',
    req: ['wood', 'fire'],
    colorHex: 0x4ade80,
    desc: '青木+赤炎共鸣：+1 灵力、抽 1 张牌，全体叠 4 层丹火！',
  },
  {
    id: 'thunder_ice',
    name: '★ 紫电青霜阵',
    req: ['thunder', 'ice'],
    colorHex: 0xa855f7,
    desc: '紫雷+玄冰共鸣：全体 8 伤并施加 2 层【虚弱】！',
  },
];

// =========================================================================
// 28 Crafted Xianxia Deckbuilder Cards (Balanced around 1 Qi = 6 Dmg / 5 Blk)
// =========================================================================
export const CARDS: Record<string, CardDef> = {
  strike: {
    id: 'strike',
    name: '御剑诀',
    type: 'attack',
    rarity: 'starter',
    cost: 1,
    target: 'single',
    art: './art/art_sword_gold.webp',
    desc: '造成 6 点剑气伤害。',
    plusDesc: '造成 9 点剑气伤害。',
    ops: [{ op: 'damage', amount: 6 }],
    plusOps: [{ op: 'damage', amount: 9 }],
  },
  defend: {
    id: 'defend',
    name: '护体剑罡',
    type: 'skill',
    rarity: 'starter',
    cost: 1,
    target: 'self',
    art: './art/art_shield_jade.webp',
    desc: '获得 5 点护体罡气。',
    plusDesc: '获得 8 点护体罡气。',
    ops: [{ op: 'block', amount: 5 }],
    plusOps: [{ op: 'block', amount: 8 }],
  },
  metal_call: {
    id: 'metal_call',
    name: '庚金引剑',
    type: 'attack',
    rarity: 'starter',
    cost: 1,
    target: 'single',
    art: './art/art_sword_gold.webp',
    elementTag: 'metal',
    desc: '造成 7 点伤害。唤出 1 柄【庚金剑】入匣。',
    plusDesc: '造成 10 点伤害。唤出 1 柄【庚金剑】入匣。',
    ops: [{ op: 'damage', amount: 7 }, { op: 'channel_sword', element: 'metal' }],
    plusOps: [{ op: 'damage', amount: 10 }, { op: 'channel_sword', element: 'metal' }],
  },
  break_army: {
    id: 'break_army',
    name: '破军剑指',
    type: 'attack',
    rarity: 'starter',
    cost: 2,
    target: 'single',
    art: './art/art_sword_crimson.webp',
    desc: '造成 9 点伤害，施加 2 层【破绽】(受伤+50%)。',
    plusDesc: '造成 12 点伤害，施加 3 层【破绽】。',
    ops: [{ op: 'damage', amount: 9 }, { op: 'status_enemy', status: 'vuln', amount: 2 }],
    plusOps: [{ op: 'damage', amount: 12 }, { op: 'status_enemy', status: 'vuln', amount: 3 }],
  },
  fire_talisman: {
    id: 'fire_talisman',
    name: '离火符剑',
    type: 'attack',
    rarity: 'common',
    cost: 1,
    target: 'single',
    art: './art/art_talisman_fire.webp',
    elementTag: 'fire',
    desc: '造成 5 点伤害，施加 4 层【丹火】，唤出【赤炎剑】。',
    plusDesc: '造成 7 点伤害，施加 6 层【丹火】，唤出【赤炎剑】。',
    ops: [
      { op: 'damage', amount: 5 },
      { op: 'status_enemy', status: 'burn', amount: 4 },
      { op: 'channel_sword', element: 'fire' },
    ],
    plusOps: [
      { op: 'damage', amount: 7 },
      { op: 'status_enemy', status: 'burn', amount: 6 },
      { op: 'channel_sword', element: 'fire' },
    ],
  },
  thunder_seal: {
    id: 'thunder_seal',
    name: '紫霄雷引',
    type: 'attack',
    rarity: 'common',
    cost: 1,
    target: 'all',
    art: './art/art_thunder_orb.webp',
    elementTag: 'thunder',
    desc: '对全体妖魔造成 6 点伤害，唤出 1 柄【紫雷剑】。',
    plusDesc: '对全体妖魔造成 9 点伤害，唤出 1 柄【紫雷剑】。',
    ops: [{ op: 'damage', amount: 6, target: 'all' }, { op: 'channel_sword', element: 'thunder' }],
    plusOps: [{ op: 'damage', amount: 9, target: 'all' }, { op: 'channel_sword', element: 'thunder' }],
  },
  ice_barrier: {
    id: 'ice_barrier',
    name: '玄冰凝障',
    type: 'skill',
    rarity: 'common',
    cost: 1,
    target: 'self',
    art: './art/art_lotus_ice.webp',
    elementTag: 'ice',
    desc: '获得 6 点罡气，唤出 1 柄【玄冰剑】入匣。',
    plusDesc: '获得 9 点罡气，唤出 1 柄【玄冰剑】入匣。',
    ops: [{ op: 'block', amount: 6 }, { op: 'channel_sword', element: 'ice' }],
    plusOps: [{ op: 'block', amount: 9 }, { op: 'channel_sword', element: 'ice' }],
  },
  wood_spring: {
    id: 'wood_spring',
    name: '青木回春诀',
    type: 'skill',
    rarity: 'common',
    cost: 1,
    target: 'self',
    art: './art/art_gourd_jade.webp',
    elementTag: 'wood',
    desc: '获得 4 点罡气，抽 1 张牌，唤出【青木剑】。',
    plusDesc: '获得 7 点罡气，抽 1 张牌，唤出【青木剑】。',
    ops: [{ op: 'block', amount: 4 }, { op: 'draw', amount: 1 }, { op: 'channel_sword', element: 'wood' }],
    plusOps: [{ op: 'block', amount: 7 }, { op: 'draw', amount: 1 }, { op: 'channel_sword', element: 'wood' }],
  },
  swift_flash: {
    id: 'swift_flash',
    name: '无影快剑',
    type: 'attack',
    rarity: 'common',
    cost: 0,
    target: 'single',
    art: './art/art_sword_gold.webp',
    desc: '0 费：造成 4 点伤害，抽 1 张牌。',
    plusDesc: '0 费：造成 7 点伤害，抽 1 张牌。',
    ops: [{ op: 'damage', amount: 4 }, { op: 'draw', amount: 1 }],
    plusOps: [{ op: 'damage', amount: 7 }, { op: 'draw', amount: 1 }],
  },
  twin_swallow: {
    id: 'twin_swallow',
    name: '双燕回风斩',
    type: 'attack',
    rarity: 'common',
    cost: 1,
    target: 'single',
    art: './art/art_sword_gold.webp',
    desc: '连续斩击 2 次，每次造成 5 点伤害（双倍吃剑意加成！）。',
    plusDesc: '连续斩击 2 次，每次造成 7 点伤害。',
    ops: [{ op: 'damage', amount: 5, hits: 2 }],
    plusOps: [{ op: 'damage', amount: 7, hits: 2 }],
  },
  sweep_clouds: {
    id: 'sweep_clouds',
    name: '横扫千军',
    type: 'attack',
    rarity: 'common',
    cost: 1,
    target: 'all',
    art: './art/art_sword_crimson.webp',
    desc: '对全体妖魔造成 8 点剑气伤害。',
    plusDesc: '对全体妖魔造成 11 点剑气伤害。',
    ops: [{ op: 'damage', amount: 8, target: 'all' }],
    plusOps: [{ op: 'damage', amount: 11, target: 'all' }],
  },
  guard_counter: {
    id: 'guard_counter',
    name: '守中带剑',
    type: 'attack',
    rarity: 'common',
    cost: 1,
    target: 'single',
    art: './art/art_shield_jade.webp',
    desc: '获得 5 点罡气，并造成 5 点伤害。',
    plusDesc: '获得 8 点罡气，并造成 7 点伤害。',
    ops: [{ op: 'block', amount: 5 }, { op: 'damage', amount: 5 }],
    plusOps: [{ op: 'block', amount: 8 }, { op: 'damage', amount: 7 }],
  },
  mist_step: {
    id: 'mist_step',
    name: '踏雪无痕',
    type: 'skill',
    rarity: 'common',
    cost: 1,
    target: 'self',
    art: './art/art_lotus_ice.webp',
    retain: true,
    desc: '【保留】获得 7 点罡气，下回合多抽 — 当前立即抽 2 张牌。',
    plusDesc: '【保留】获得 10 点罡气，立即抽 2 张牌。',
    ops: [{ op: 'block', amount: 7 }, { op: 'draw', amount: 2 }],
    plusOps: [{ op: 'block', amount: 10 }, { op: 'draw', amount: 2 }],
  },
  blood_slash: {
    id: 'blood_slash',
    name: '燃血狂斩',
    type: 'attack',
    rarity: 'common',
    cost: 0,
    target: 'single',
    art: './art/art_sword_crimson.webp',
    desc: '自损 3 点气血，造成 11 点伤害并抽 1 张牌。',
    plusDesc: '自损 3 点气血，造成 15 点伤害并抽 1 张牌。',
    ops: [{ op: 'lose_hp', amount: 3 }, { op: 'damage', amount: 11 }, { op: 'draw', amount: 1 }],
    plusOps: [{ op: 'lose_hp', amount: 3 }, { op: 'damage', amount: 15 }, { op: 'draw', amount: 1 }],
  },
  golden_bell: {
    id: 'golden_bell',
    name: '不灭金钟罩',
    type: 'skill',
    rarity: 'uncommon',
    cost: 2,
    target: 'self',
    art: './art/art_bell_gold.webp',
    desc: '获得 13 点罡气，并获得 4 层【剑棘反伤】。',
    plusDesc: '获得 17 点罡气，并获得 6 层【剑棘反伤】。',
    ops: [{ op: 'block', amount: 13 }, { op: 'buff_self', buff: 'thorns', amount: 4 }],
    plusOps: [{ op: 'block', amount: 17 }, { op: 'buff_self', buff: 'thorns', amount: 6 }],
  },
  evoke_pulse: {
    id: 'evoke_pulse',
    name: '催剑出鞘',
    type: 'skill',
    rarity: 'common',
    cost: 1,
    plusCost: 0,
    target: 'self',
    art: './art/art_sword_gold.webp',
    desc: '令剑匣首柄飞剑【双倍出鞘 (触发2次)】！',
    plusDesc: '0 费：令剑匣首柄飞剑【双倍出鞘 (触发2次)】！',
    ops: [{ op: 'evoke_next', times: 2 }],
    plusOps: [{ op: 'evoke_next', times: 2 }],
  },
  qi_surge: {
    id: 'qi_surge',
    name: '太虚聚灵丹',
    type: 'skill',
    rarity: 'uncommon',
    cost: 0,
    target: 'self',
    art: './art/art_gourd_jade.webp',
    exhaust: true,
    desc: '【消耗】立即获得 +2 点灵力，并抽 2 张牌。',
    plusDesc: '【消耗】立即获得 +2 点灵力，并抽 3 张牌。',
    ops: [{ op: 'gain_qi', amount: 2 }, { op: 'draw', amount: 2 }],
    plusOps: [{ op: 'gain_qi', amount: 2 }, { op: 'draw', amount: 3 }],
  },
  shield_slam: {
    id: 'shield_slam',
    name: '乾坤镇岳击',
    type: 'attack',
    rarity: 'uncommon',
    cost: 1,
    plusCost: 0,
    target: 'single',
    art: './art/art_bell_gold.webp',
    desc: '造成等同于你当前【护体罡气】总额的巨额伤害！',
    plusDesc: '0 费：造成等同于你当前【护体罡气】总额的伤害！',
    ops: [{ op: 'damage_by_block', mult: 1.0 }],
    plusOps: [{ op: 'damage_by_block', mult: 1.0 }],
  },
  sword_storm_count: {
    id: 'sword_storm_count',
    name: '御剑乘风',
    type: 'attack',
    rarity: 'uncommon',
    cost: 1,
    target: 'single',
    art: './art/art_sword_gold.webp',
    desc: '造成 6 点基础伤害；剑匣中每有 1 柄飞剑额外 +5 伤！',
    plusDesc: '造成 8 点基础伤害；剑匣中每有 1 柄飞剑额外 +7 伤！',
    ops: [{ op: 'damage_per_sword', base: 6, perSword: 5 }],
    plusOps: [{ op: 'damage_per_sword', base: 8, perSword: 7 }],
  },
  alchemy_detonate: {
    id: 'alchemy_detonate',
    name: '三昧真火诀',
    type: 'skill',
    rarity: 'uncommon',
    cost: 1,
    target: 'single',
    art: './art/art_talisman_fire.webp',
    exhaust: true,
    desc: '【消耗】先施加 4 层丹火，随后使目标【丹火】层数直接翻倍！',
    plusDesc: '【消耗】先施加 7 层丹火，随后使目标【丹火】层数直接翻倍！',
    ops: [{ op: 'status_enemy', status: 'burn', amount: 4 }, { op: 'double_burn' }],
    plusOps: [{ op: 'status_enemy', status: 'burn', amount: 7 }, { op: 'double_burn' }],
  },
  soul_shatter: {
    id: 'soul_shatter',
    name: '摄魂镇妖咒',
    type: 'skill',
    rarity: 'uncommon',
    cost: 1,
    target: 'all',
    art: './art/art_thunder_orb.webp',
    exhaust: true,
    desc: '【消耗】对全体妖魔施加 2 层【破绽】与 2 层【虚弱】，抽 1 牌。',
    plusDesc: '【消耗】对全体妖魔施加 3 层【破绽】与 3 层【虚弱】，抽 2 牌。',
    ops: [
      { op: 'status_enemy', status: 'vuln', amount: 2, target: 'all' },
      { op: 'status_enemy', status: 'weak', amount: 2, target: 'all' },
      { op: 'draw', amount: 1 },
    ],
    plusOps: [
      { op: 'status_enemy', status: 'vuln', amount: 3, target: 'all' },
      { op: 'status_enemy', status: 'weak', amount: 3, target: 'all' },
      { op: 'draw', amount: 2 },
    ],
  },
  blood_frenzy_pact: {
    id: 'blood_frenzy_pact',
    name: '修罗燃魂功',
    type: 'power',
    rarity: 'uncommon',
    cost: 1,
    target: 'self',
    art: './art/art_sword_crimson.webp',
    desc: '【心法】自损 2 点气血，本场永久获得 +3 点【剑意 (攻击力)】！',
    plusDesc: '【心法】自损 2 点气血，本场永久获得 +5 点【剑意 (攻击力)】！',
    ops: [{ op: 'lose_hp', amount: 2 }, { op: 'buff_self', buff: 'strength', amount: 3 }],
    plusOps: [{ op: 'lose_hp', amount: 2 }, { op: 'buff_self', buff: 'strength', amount: 5 }],
  },
  sword_heart: {
    id: 'sword_heart',
    name: '剑心通明',
    type: 'power',
    rarity: 'uncommon',
    cost: 1,
    target: 'self',
    art: './art/art_lotus_ice.webp',
    desc: '【心法】每当你唤出一柄飞剑入匣时，自动抽 1 张牌并得 2 点罡气！',
    plusDesc: '【心法】每当你唤出一柄飞剑入匣时，自动抽 1 张牌并得 4 点罡气！',
    ops: [
      { op: 'buff_self', buff: 'draw_on_sword', amount: 1 },
      { op: 'buff_self', buff: 'block_on_sword', amount: 2 },
    ],
    plusOps: [
      { op: 'buff_self', buff: 'draw_on_sword', amount: 1 },
      { op: 'buff_self', buff: 'block_on_sword', amount: 4 },
    ],
  },
  nine_heavens_slash: {
    id: 'nine_heavens_slash',
    name: '九天玄刹剑',
    type: 'attack',
    rarity: 'rare',
    cost: 2,
    target: 'single',
    art: './art/art_sword_crimson.webp',
    elementTag: 'thunder',
    desc: '连续御剑轰击 4 次，每次 5 伤，并唤出 2 柄【紫雷剑】！',
    plusDesc: '连续御剑轰击 4 次，每次 7 伤，并唤出 2 柄【紫雷剑】！',
    ops: [{ op: 'damage', amount: 5, hits: 4 }, { op: 'channel_sword', element: 'thunder', count: 2 }],
    plusOps: [{ op: 'damage', amount: 7, hits: 4 }, { op: 'channel_sword', element: 'thunder', count: 2 }],
  },
  five_element_wheel: {
    id: 'five_element_wheel',
    name: '五行混元剑匣',
    type: 'skill',
    rarity: 'rare',
    cost: 2,
    plusCost: 1,
    target: 'self',
    art: './art/art_bell_gold.webp',
    exhaust: true,
    desc: '【消耗】剑匣容量 +2，依次唤出【金·火·雷·冰】四剑齐聚引爆剑阵！',
    plusDesc: '1 费【消耗】：剑匣容量 +2，依次唤出【金·火·雷·冰】四剑齐聚！',
    ops: [
      { op: 'expand_box', amount: 2 },
      { op: 'channel_sword', element: 'metal' },
      { op: 'channel_sword', element: 'fire' },
      { op: 'channel_sword', element: 'thunder' },
      { op: 'channel_sword', element: 'ice' },
    ],
    plusOps: [
      { op: 'expand_box', amount: 2 },
      { op: 'channel_sword', element: 'metal' },
      { op: 'channel_sword', element: 'fire' },
      { op: 'channel_sword', element: 'thunder' },
      { op: 'channel_sword', element: 'ice' },
    ],
  },
  ten_thousand_swords: {
    id: 'ten_thousand_swords',
    name: '★ 万剑归宗',
    type: 'attack',
    rarity: 'rare',
    cost: 2,
    target: 'all',
    art: './art/art_ten_thousand.webp',
    desc: '对全体妖魔造成 14 点剑压，并令剑匣所有飞剑【双倍齐射出鞘】！',
    plusDesc: '对全体妖魔造成 20 点剑压，并令剑匣所有飞剑【三倍齐射出鞘】！',
    ops: [{ op: 'damage', amount: 14, target: 'all' }, { op: 'evoke_all', times: 2 }],
    plusOps: [{ op: 'damage', amount: 20, target: 'all' }, { op: 'evoke_all', times: 3 }],
  },
  immortal_ascension: {
    id: 'immortal_ascension',
    name: '太上化神诀',
    type: 'power',
    rarity: 'rare',
    cost: 2,
    plusCost: 1,
    target: 'self',
    art: './art/art_gourd_jade.webp',
    desc: '【心法】每回合灵力上限永久 +1，剑意 +2，身法 +2！',
    plusDesc: '1 费【心法】：每回合灵力上限 +1，剑意 +2，身法 +2！',
    ops: [
      { op: 'buff_self', buff: 'qi_regen', amount: 1 },
      { op: 'buff_self', buff: 'strength', amount: 2 },
      { op: 'buff_self', buff: 'dexterity', amount: 2 },
    ],
    plusOps: [
      { op: 'buff_self', buff: 'qi_regen', amount: 1 },
      { op: 'buff_self', buff: 'strength', amount: 2 },
      { op: 'buff_self', buff: 'dexterity', amount: 2 },
    ],
  },
  nirvana_lotus: {
    id: 'nirvana_lotus',
    name: '九转金莲身',
    type: 'skill',
    rarity: 'rare',
    cost: 1,
    target: 'self',
    art: './art/art_lotus_ice.webp',
    exhaust: true,
    desc: '【消耗】回复 10 点气血，获得 14 点护体罡气，唤出【青木剑】。',
    plusDesc: '【消耗】回复 15 点气血，获得 18 点护体罡气，唤出【青木剑】。',
    ops: [
      { op: 'heal', amount: 10 },
      { op: 'block', amount: 14 },
      { op: 'channel_sword', element: 'wood' },
    ],
    plusOps: [
      { op: 'heal', amount: 15 },
      { op: 'block', amount: 18 },
      { op: 'channel_sword', element: 'wood' },
    ],
  },
};

// =========================================================================
// 12 Immortal Relics (本命与秘境法宝)
// =========================================================================
export interface RelicDef {
  id: string;
  name: string;
  icon: string;
  price: number;
  starterOnly?: boolean;
  desc: string;
}

export const RELICS: Record<string, RelicDef> = {
  qingping_box: {
    id: 'qingping_box',
    name: '青萍古剑匣',
    icon: './art/art_sword_gold.webp',
    price: 0,
    starterOnly: true,
    desc: '每场战斗开始时，自动唤出 1 柄【庚金剑】入匣。',
  },
  bagua_furnace: {
    id: 'bagua_furnace',
    name: '紫金八卦炉',
    icon: './art/art_furnace.webp',
    price: 0,
    starterOnly: true,
    desc: '首回合获得 +1 灵力；每次触发【五行剑阵】时额外抽 1 张牌。',
  },
  asura_sarira: {
    id: 'asura_sarira',
    name: '修罗血舍利',
    icon: './art/art_sword_crimson.webp',
    price: 0,
    starterOnly: true,
    desc: '每当气血受损时获得 +1【剑意】；战斗胜利后回复 6 点气血。',
  },
  spirit_gourd: {
    id: 'spirit_gourd',
    name: '养剑紫金葫',
    icon: './art/art_gourd_jade.webp',
    price: 135,
    desc: '剑匣最大飞剑槽位 +2，开战首回合额外抽 1 张牌。',
  },
  thunder_drum: {
    id: 'thunder_drum',
    name: '夔牛震天鼓',
    icon: './art/art_thunder_orb.webp',
    price: 145,
    desc: '每场战斗第 1 回合，对全体妖魔施加 2 层【破绽】(受伤+50%)。',
  },
  jade_pendant: {
    id: 'jade_pendant',
    name: '昆仑温玉佩',
    icon: './art/art_shield_jade.webp',
    price: 125,
    desc: '每回合结束若未打出任何攻击牌，或护盾归零时自动凝结 6 点罡气。',
  },
  heaven_mirror: {
    id: 'heaven_mirror',
    name: '昊天照妖镜',
    icon: './art/art_bell_gold.webp',
    price: 155,
    desc: '每打出 3 张攻击牌，自动对生命最低妖魔射出一道 7 伤昊天金光！',
  },
  phoenix_feather: {
    id: 'phoenix_feather',
    name: '朱雀涅槃羽',
    icon: './art/art_talisman_fire.webp',
    price: 165,
    desc: '每当你施加【丹火】时额外 +2 层；气血归零时免死回复 35% 气血（限1次）。',
  },
  frost_lotus: {
    id: 'frost_lotus',
    name: '万载玄冰莲',
    icon: './art/art_lotus_ice.webp',
    price: 140,
    desc: '每场战斗开始时获得 10 点护体罡气与 +1【身法】。',
  },
  sword_manual: {
    id: 'sword_manual',
    name: '太白剑经残卷',
    icon: './art/art_ten_thousand.webp',
    price: 150,
    desc: '每场战斗开始时永久携带 +2 点【剑意】(全攻击与庚金剑伤害+2)。',
  },
  kunlun_cauldron: {
    id: 'kunlun_cauldron',
    name: '乾坤聚宝鼎',
    icon: './art/art_furnace.webp',
    price: 175,
    desc: '每回合灵力上限 +1！',
  },
};

// =========================================================================
// 3 Playable Xianxia Heroes
// =========================================================================
export interface HeroDef {
  id: HeroId;
  name: string;
  title: string;
  color: string;
  maxHp: number;
  starterRelic: string;
  portrait: string;
  standee: string;
  desc: string;
  starterDeck: string[];
}

export const HEROES: HeroDef[] = [
  {
    id: 'shushan',
    name: '凌霄 · 蜀山剑修',
    title: '御剑乘风 · 万剑归宗',
    color: '#fbbf24',
    maxHp: 80,
    starterRelic: 'qingping_box',
    portrait: './art/hero_shushan.webp',
    standee: './art/hero_shushan.webp',
    desc: '擅长高频唤剑入匣与【催剑出鞘】连斩，0费快剑过牌形成无限御剑风暴。',
    starterDeck: [
      'strike', 'strike', 'strike', 'strike',
      'defend', 'defend', 'defend', 'defend',
      'metal_call', 'break_army',
    ],
  },
  {
    id: 'talisman',
    name: '玄玑 · 太清符师',
    title: '五行演化 · 雷火天劫',
    color: '#c084fc',
    maxHp: 74,
    starterRelic: 'bagua_furnace',
    portrait: './art/hero_talisman.webp',
    standee: './art/hero_talisman.webp',
    desc: '精通【赤炎·紫雷·玄冰】多系符剑同驻剑匣，高频触发五行剑阵共鸣与丹火翻倍爆破。',
    starterDeck: [
      'strike', 'strike', 'strike',
      'defend', 'defend', 'defend', 'defend',
      'fire_talisman', 'thunder_seal', 'ice_barrier',
    ],
  },
  {
    id: 'asura',
    name: '破戒 · 修罗体修',
    title: '燃血狂战 · 金钟镇岳',
    color: '#fb7185',
    maxHp: 88,
    starterRelic: 'asura_sarira',
    portrait: './art/hero_asura.webp',
    standee: './art/hero_asura.webp',
    desc: '自损气血换取巨额【剑意】成长，亦可叠百层不灭金钟罩接一发【乾坤镇岳击】秒杀魔尊。',
    starterDeck: [
      'strike', 'strike', 'strike', 'strike',
      'defend', 'defend', 'defend', 'defend',
      'blood_slash', 'golden_bell',
    ],
  },
];

// =========================================================================
// Enemy Archetypes & Multi-Enemy Encounters across 3 Realms (12 Floors)
// =========================================================================
export interface EnemyMove {
  intentName: string;
  kind: 'attack' | 'multi_attack' | 'attack_block' | 'block_buff' | 'debuff' | 'nuke';
  dmg?: number;
  hits?: number;
  block?: number;
  strength?: number;
  applyVuln?: number;
  applyWeak?: number;
}

export interface EnemyArchetype {
  id: string;
  name: string;
  modelName: string;
  scale: number;
  tintHex: number;
  maxHp: number;
  isBoss?: boolean;
  isElite?: boolean;
  moves: EnemyMove[];
}

export const ENEMIES: Record<string, EnemyArchetype> = {
  wolf_demon: {
    id: 'wolf_demon',
    name: '青面嗜血妖狼',
    modelName: './art/enemy_wolf.webp',
    scale: 0.88,
    tintHex: 0x38bdf8,
    maxHp: 34,
    moves: [
      { intentName: '裂爪扑击', kind: 'attack', dmg: 8 },
      { intentName: '妖风狂嗥', kind: 'block_buff', block: 5, strength: 2 },
      { intentName: '嗜血二连撕', kind: 'multi_attack', dmg: 5, hits: 2 },
    ],
  },
  talon_ghost: {
    id: 'talon_ghost',
    name: '幽冥噬魂鬼修',
    modelName: './art/enemy_ghost.webp',
    scale: 0.90,
    tintHex: 0xc084fc,
    maxHp: 30,
    moves: [
      { intentName: '蚀骨阴风', kind: 'debuff', dmg: 6, applyWeak: 2 },
      { intentName: '夺魄鬼爪', kind: 'attack', dmg: 10 },
      { intentName: '幽冥护体', kind: 'attack_block', dmg: 7, block: 6 },
    ],
  },
  iron_puppet: {
    id: 'iron_puppet',
    name: '玄铁镇墓剑傀',
    modelName: './art/enemy_golem.webp',
    scale: 0.96,
    tintHex: 0xfbbf24,
    maxHp: 52,
    moves: [
      { intentName: '重剑横斩', kind: 'attack_block', dmg: 9, block: 7 },
      { intentName: '玄铁聚能', kind: 'block_buff', block: 10, strength: 3 },
      { intentName: '开山重劈', kind: 'attack', dmg: 15 },
    ],
  },
  elite_bull_king: {
    id: 'elite_bull_king',
    name: '凶煞·玄铁狂暴统领',
    modelName: './art/enemy_golem.webp',
    scale: 1.12,
    tintHex: 0xf43f5e,
    maxHp: 96,
    isElite: true,
    moves: [
      { intentName: '震山碎甲锤', kind: 'debuff', dmg: 11, applyVuln: 2 },
      { intentName: '魔焰狂暴', kind: 'block_buff', block: 10, strength: 3 },
      { intentName: '炼狱三连斩', kind: 'multi_attack', dmg: 6, hits: 3 },
    ],
  },
  boss_spider_queen: {
    id: 'boss_spider_queen',
    name: '镇殿妖主·千年赤练蛛母',
    modelName: './art/boss_spider.webp',
    scale: 1.18,
    tintHex: 0xe11d48,
    maxHp: 148,
    isBoss: true,
    moves: [
      { intentName: '天罗蚀骨网', kind: 'debuff', dmg: 9, applyWeak: 2, applyVuln: 1 },
      { intentName: '赤练百毒刺', kind: 'multi_attack', dmg: 6, hits: 3 },
      { intentName: '妖丹护体蓄力', kind: 'block_buff', block: 14, strength: 3 },
      { intentName: '万蛛噬心煞', kind: 'nuke', dmg: 22 },
    ],
  },
  elite_sword_wraith: {
    id: 'elite_sword_wraith',
    name: '凶煞·古冢断魂鬼王',
    modelName: './art/enemy_ghost.webp',
    scale: 1.12,
    tintHex: 0xe879f9,
    maxHp: 132,
    isElite: true,
    moves: [
      { intentName: '无情四连剑', kind: 'multi_attack', dmg: 5, hits: 4 },
      { intentName: '煞剑凝罡', kind: 'attack_block', dmg: 13, block: 12 },
      { intentName: '断魂一闪', kind: 'nuke', dmg: 23 },
    ],
  },
  boss_sword_demon: {
    id: 'boss_sword_demon',
    name: '剑冢霸主·九幽血剑魔',
    modelName: './art/boss_immortal.webp',
    scale: 1.16,
    tintHex: 0xa855f7,
    maxHp: 225,
    isBoss: true,
    moves: [
      { intentName: '血狱破罡斩', kind: 'debuff', dmg: 14, applyVuln: 2 },
      { intentName: '九幽乱刃舞', kind: 'multi_attack', dmg: 7, hits: 3 },
      { intentName: '魔剑吞灵阵', kind: 'block_buff', block: 18, strength: 4 },
      { intentName: '血河灭世斩', kind: 'nuke', dmg: 28 },
    ],
  },
  boss_fallen_immortal: {
    id: 'boss_fallen_immortal',
    name: '终局魔尊·太古戮天堕仙',
    modelName: './art/boss_immortal.webp',
    scale: 1.28,
    tintHex: 0xfbbf24,
    maxHp: 330,
    isBoss: true,
    moves: [
      { intentName: '天威镇魂印', kind: 'debuff', dmg: 15, applyWeak: 2, applyVuln: 2 },
      { intentName: '戮仙六剑齐飞', kind: 'multi_attack', dmg: 6, hits: 4 },
      { intentName: '太古魔神法相', kind: 'block_buff', block: 22, strength: 4 },
      { intentName: '★ 寂灭神雷劫', kind: 'nuke', dmg: 34 },
    ],
  },
};
