// 2.5D Dark-Gold Guofeng Illustrated Battlefield, Calligraphic Sword-Qi VFX & Gilded Card Hand Engine
import './style.css';
import {
  CARDS,
  HEROES,
  RELICS,
  SWORD_ELEMENTS,
  type HeroId,
  type SwordElement,
} from './cards.ts';
import {
  SwordSpireEngine,
  type CardInstance,
  type EnemyInstance,
  type MapNode,
} from './engine.ts';
import { XianxiaAudio } from './audio.ts';
import { XIANXIA_ICONS, renderFrameCorners } from './icons.ts';

interface StandeeActor {
  uid: number;
  wrapEl: HTMLDivElement;
  imgEl: HTMLImageElement;
  plateEl: HTMLDivElement;
  xPct: number;
  yPct: number;
  lungePx: number;
  wobble: number;
  flashTimer: number;
}

interface FlyingSwordStreak {
  x0: number;
  y0: number;
  cx: number;
  cy: number;
  x1: number;
  y1: number;
  color: string;
  element: SwordElement;
  delay: number;
  age: number;
  dur: number;
  scale: number;
  heavy: boolean;
}

interface TaperedCrescentSlash {
  x: number;
  y: number;
  angle: number;
  radius: number;
  thickness: number;
  sweepRad: number;
  color: string;
  delay: number;
  age: number;
  dur: number;
  claw?: boolean;
  inkDrops: { ang: number; dist: number; r: number }[];
}

interface LightningBoltVfx {
  chains: { x: number; y: number }[][];
  hitX: number;
  hitY: number;
  color: string;
  delay: number;
  age: number;
  dur: number;
}

interface ImpactSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  delay: number;
  age: number;
  dur: number;
  kind: 'spark' | 'ember' | 'shard';
}

interface ShockwaveRing {
  x: number;
  y: number;
  r0: number;
  r1: number;
  scaleY: number;
  color: string;
  bagua: boolean;
  delay: number;
  age: number;
  dur: number;
}

interface CrossStarFlare {
  x: number;
  y: number;
  size: number;
  angle: number;
  color: string;
  delay: number;
  age: number;
  dur: number;
}

interface AfterimageGhost {
  img: HTMLImageElement;
  x: number;
  y: number;
  h: number;
  age: number;
  dur: number;
}

interface FormationPillarVfx {
  x: number;
  y: number;
  color: string;
  age: number;
  dur: number;
}

interface FloatingPopup {
  x: number;
  y: number;
  vx: number;
  vy: number;
  text: string;
  color: string;
  age: number;
  dur: number;
  big: boolean;
}

interface SpiritMote {
  x: number;
  y: number;
  vy: number;
  vx: number;
  r: number;
  alpha: number;
  gold: boolean;
}

class SwordSpireIllustratedApp {
  public engine = new SwordSpireEngine();
  private audio = new XianxiaAudio();

  private stageRoot: HTMLElement;
  private stageBg: HTMLElement;
  private standeesLayer: HTMLElement;
  private backCanvas: HTMLCanvasElement;
  private backCtx: CanvasRenderingContext2D;
  private fxCanvas: HTMLCanvasElement;
  private fxCtx: CanvasRenderingContext2D;

  private selectedHeroIdx = 0;
  private heroStandee!: StandeeActor;
  private enemyStandees: StandeeActor[] = [];

  private streaks: FlyingSwordStreak[] = [];
  private slashes: TaperedCrescentSlash[] = [];
  private bolts: LightningBoltVfx[] = [];
  private sparks: ImpactSpark[] = [];
  private rings: ShockwaveRing[] = [];
  private flares: CrossStarFlare[] = [];
  private ghosts: AfterimageGhost[] = [];
  private pillars: FormationPillarVfx[] = [];
  private popups: FloatingPopup[] = [];
  private motes: SpiritMote[] = [];

  private clockSec = 0;
  private lastTs = performance.now();
  private trauma = 0;
  private hitstopTimer = 0;
  private toastTimer = 0;
  private hoveredCardEl: HTMLElement | null = null;
  private hoveredSingleTarget = false;

  constructor() {
    this.stageRoot = document.getElementById('stage-root')!;
    this.stageBg = document.getElementById('stage-bg')!;
    this.standeesLayer = document.getElementById('stage-standees')!;
    this.backCanvas = document.getElementById('back-fx-canvas') as HTMLCanvasElement;
    this.backCtx = this.backCanvas.getContext('2d')!;
    this.fxCanvas = document.getElementById('fx-canvas') as HTMLCanvasElement;
    this.fxCtx = this.fxCanvas.getContext('2d')!;

    this.initMotes();
    this.stageBg.style.backgroundImage = `url('./art/bg_realm1.webp')`;
    this.hydrateStaticIcons();
    this.setupHeroStandee();
    this.bindUiEvents();
    this.renderTitleHeroes();
    this.onResize();

    requestAnimationFrame((ts) => this.tick(ts));
  }

  private hydrateStaticIcons(): void {
    document.getElementById('btn-open-deck')!.innerHTML =
      `${XIANXIA_ICONS.scroll}<span>剑谱</span><strong id="deck-count">10</strong>`;
    document.getElementById('btn-Audio-mute')!.innerHTML =
      `${XIANXIA_ICONS.chime}<span>古乐</span>`;
    const startInner = document.querySelector('#btn-start-run .cta-inner');
    if (startInner) {
      startInner.innerHTML = `${XIANXIA_ICONS.swords}<span>御剑入劫 · 踏破第一重天</span><small>[Space]</small>`;
    }
  }

  private initMotes(): void {
    for (let i = 0; i < 65; i++) {
      this.motes.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vy: -14 - Math.random() * 26,
        vx: (Math.random() - 0.5) * 14,
        r: 1.4 + Math.random() * 2.6,
        alpha: 0.25 + Math.random() * 0.55,
        gold: Math.random() < 0.62,
      });
    }
  }

  private setupHeroStandee(): void {
    const wrap = document.createElement('div');
    wrap.className = 'standee-wrap hero hidden';
    const shadow = document.createElement('div');
    shadow.className = 'standee-shadow';
    const img = document.createElement('img');
    img.className = 'standee-img';
    img.src = HEROES[0].standee;
    img.alt = HEROES[0].name;
    wrap.append(shadow, img);
    this.standeesLayer.appendChild(wrap);

    const plate = document.createElement('div');
    plate.className = 'actor-plate hero-plate';
    document.getElementById('actor-overlays')!.appendChild(plate);

    this.heroStandee = {
      uid: 0,
      wrapEl: wrap,
      imgEl: img,
      plateEl: plate,
      xPct: 24,
      yPct: 67,
      lungePx: 0,
      wobble: 0,
      flashTimer: 0,
    };
  }

  private updateRealmBackdrop(): void {
    const row = Math.max(0, this.engine.currentRow);
    const realm = Math.min(3, Math.floor(row / 5) + 1);
    this.stageBg.style.backgroundImage = `url('./art/bg_realm${realm}.webp')`;
  }

  private rebuildEnemyStandees(): void {
    for (const s of this.enemyStandees) {
      s.wrapEl.remove();
      s.plateEl.remove();
    }
    this.enemyStandees = [];

    this.heroStandee.imgEl.src = this.engine.hero.standee;
    this.heroStandee.wrapEl.classList.remove('hidden');
    this.updateRealmBackdrop();

    const count = this.engine.enemies.length;
    const overlays = document.getElementById('actor-overlays')!;

    this.engine.enemies.forEach((e, idx) => {
      const xPct =
        count === 1 ? 74 : count === 2 ? 65 + idx * 17 : 59 + idx * 13.5;
      const yPct = count === 1 ? 67 : idx % 2 === 0 ? 69 : 63;

      const wrap = document.createElement('div');
      wrap.className = `standee-wrap enemy ${e.isBoss ? 'boss' : e.isElite ? 'elite' : ''}`;
      const shadow = document.createElement('div');
      shadow.className = 'standee-shadow';
      const img = document.createElement('img');
      img.className = 'standee-img';
      img.src = e.modelName;
      img.alt = e.name;
      wrap.append(shadow, img);

      const selectThis = () => {
        if (this.engine.enemies[idx]?.hp > 0) {
          this.audio.playCardHover();
          this.engine.selectedTargetIdx = idx;
          this.refreshCombatHud();
        }
      };
      wrap.addEventListener('click', selectThis);
      this.standeesLayer.appendChild(wrap);

      const plate = document.createElement('div');
      plate.className = 'actor-plate enemy-plate';
      plate.addEventListener('click', selectThis);
      overlays.appendChild(plate);

      this.enemyStandees.push({
        uid: e.uid,
        wrapEl: wrap,
        imgEl: img,
        plateEl: plate,
        xPct,
        yPct,
        lungePx: 0,
        wobble: 0,
        flashTimer: 0,
      });
    });
  }

  private actorScreenCenter(a: StandeeActor): { x: number; y: number } {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const footX = (a.xPct / 100) * w + a.lungePx;
    const footY = (a.yPct / 100) * h;
    const imgH = a.imgEl.offsetHeight || 260;
    return { x: footX, y: footY - imgH * 0.52 };
  }

  // =========================================================================
  // Choreograph Visual Events onto Illustrated Standees & 7-Channel Ink-Gold VFX!
  // =========================================================================
  private processEngineVisualEvents(): void {
    const events = this.engine.drainVisualEvents();
    const hPos = this.actorScreenCenter(this.heroStandee);
    const w = window.innerWidth;
    const h = window.innerHeight;

    const livingTargets = (): StandeeActor[] =>
      this.enemyStandees.filter((_, idx) => {
        const e = this.engine.enemies[idx];
        return !!e; // Include enemies just slain by this exact card!
      });

    for (const ev of events) {
      if (ev.kind === 'hero_slash') {
        // Spawn translucent golden-jade afterimage before hero lunges!
        this.ghosts.push({
          img: this.heroStandee.imgEl,
          x: (this.heroStandee.xPct / 100) * w,
          y: (this.heroStandee.yPct / 100) * h,
          h: this.heroStandee.imgEl.offsetHeight || 260,
          age: 0,
          dur: 0.28,
        });
        this.heroStandee.lungePx = ev.heavy ? 92 : 68;
        this.audio.playSwordSlash(!!ev.heavy);

        const hexStr = `#${ev.colorHex.toString(16).padStart(6, '0')}`;
        const el: SwordElement = ev.element || 'metal';
        const primaryTarget = this.enemyStandees[ev.targetIdx] || this.enemyStandees[0];

        // 1) Ultimate Sword Rain: ★ 万剑归宗 (12 Heavenly Swords plunging from the clouds!)
        if (ev.cardId === 'ten_thousand_swords') {
          const targets = livingTargets();
          for (let k = 0; k < 12; k++) {
            const tgt = targets[k % Math.max(1, targets.length)] || primaryTarget;
            if (!tgt) continue;
            const tPos = this.actorScreenCenter(tgt);
            const skyX = tPos.x - 220 + (k - 5.5) * 46;
            const skyY = -60 - (k % 3) * 45;
            const elemCycle: SwordElement[] = ['metal', 'fire', 'thunder', 'ice', 'metal'];
            const sEl = elemCycle[k % elemCycle.length];
            this.spawnSwordStreak(
              skyX,
              skyY,
              tPos.x + (Math.random() - 0.5) * 44,
              tPos.y + (Math.random() - 0.5) * 36,
              SWORD_ELEMENTS[sEl].cssColor,
              sEl,
              0.22,
              k * 0.042,
              1.18,
              k % 3 === 0
            );
          }
        }
        // 2) AoE Sweeping / Thunder Cleave (横扫千军 / 紫霄雷引)
        else if (ev.isAoe) {
          const targets = livingTargets();
          if (el === 'thunder') {
            targets.forEach((tgt, idx) => {
              const tPos = this.actorScreenCenter(tgt);
              this.spawnLightningBolt(tPos.x, tPos.y, '#c084fc', idx * 0.06);
              this.spawnImpactBurst(tPos.x, tPos.y, '#c084fc', 'thunder', true, idx * 0.06);
            });
          } else {
            // Giant Horizon-Splitting Crescent Wave across all enemies!
            const midTgt = targets[Math.floor(targets.length / 2)] || primaryTarget;
            if (midTgt) {
              const mPos = this.actorScreenCenter(midTgt);
              this.spawnCrescentSlash(mPos.x, mPos.y, -0.08, 235, 38, 1.18, hexStr, 0.38, 0);
            }
            targets.forEach((tgt, idx) => {
              const tPos = this.actorScreenCenter(tgt);
              this.spawnSwordStreak(
                hPos.x + 36,
                hPos.y - 18,
                tPos.x,
                tPos.y,
                hexStr,
                el,
                0.2,
                idx * 0.045,
                1.08,
                true
              );
            });
          }
        }
        // 3) Golden Bell Mountain Slam (乾坤镇岳击)
        else if (ev.cardId === 'shield_slam' && primaryTarget) {
          const tPos = this.actorScreenCenter(primaryTarget);
          this.pillars.push({ x: tPos.x, y: tPos.y + 105, color: '#fde047', age: 0, dur: 0.48 });
          this.rings.push({
            x: tPos.x,
            y: tPos.y + 85,
            r0: 24,
            r1: 210,
            scaleY: 0.36,
            color: '#fef08a',
            bagua: true,
            delay: 0.02,
            age: 0,
            dur: 0.52,
          });
          this.spawnCrescentSlash(tPos.x, tPos.y, 0.72, 138, 36, 1.12, '#fde047', 0.36, 0);
          this.spawnCrescentSlash(tPos.x, tPos.y, -0.72, 138, 36, 1.12, '#2dd4bf', 0.36, 0.05);
          this.spawnImpactBurst(tPos.x, tPos.y, '#fef08a', 'metal', true, 0.03);
        }
        // 4) Single-Target & Multi-Hit Precision Sword Arts (御剑诀 / 双燕回风斩 / 九天玄刹剑 / 离火符剑 / 破军剑指)
        else if (primaryTarget) {
          const tPos = this.actorScreenCenter(primaryTarget);
          const count = Math.max(1, ev.hits);
          const angles = [-0.58, 0.62, -1.15, 0.18, 0.95];

          for (let hit = 0; hit < count; hit++) {
            const dly = hit * 0.075;
            const sx = hPos.x + 24 + (hit % 2 === 0 ? -10 : 18);
            const sy = hPos.y - 26 - (hit % 3) * 24;
            const tx = tPos.x + (count > 1 ? (hit - (count - 1) * 0.5) * 18 : 0);
            const ty = tPos.y + (count > 1 ? ((hit % 2) - 0.5) * 22 : 0);

            this.spawnSwordStreak(
              sx,
              sy,
              tx,
              ty,
              hexStr,
              el,
              ev.heavy ? 0.19 : 0.17,
              dly,
              ev.heavy ? 1.24 : 1.04,
              !!ev.heavy
            );

            if (el === 'thunder') {
              this.spawnLightningBolt(tx, ty, '#c084fc', dly + 0.12);
            }

            // Heavy Cleave (破军剑指 / 燃血狂斩) adds a brutal X-Cross twin crescent!
            if (ev.heavy && count === 1) {
              this.spawnCrescentSlash(tx, ty, -0.68, 148, 36, 1.16, hexStr, 0.36, 0.14);
              this.spawnCrescentSlash(tx, ty, 0.68, 136, 30, 1.10, '#fef08a', 0.34, 0.20);
            } else {
              this.spawnCrescentSlash(
                tx,
                ty,
                angles[hit % angles.length],
                ev.heavy ? 132 : 106,
                ev.heavy ? 30 : 23,
                1.08,
                hexStr,
                0.31,
                dly + 0.13
              );
            }
          }
        }
      } else if (ev.kind === 'hero_cast') {
        this.heroStandee.wobble = 0.2;
        const hexStr = `#${ev.colorHex.toString(16).padStart(6, '0')}`;
        this.rings.push({
          x: hPos.x,
          y: hPos.y + 82,
          r0: 20,
          r1: 138,
          scaleY: 0.35,
          color: hexStr,
          bagua: true,
          delay: 0,
          age: 0,
          dur: 0.46,
        });
        for (let k = 0; k < 12; k++) {
          this.sparks.push({
            x: hPos.x + (Math.random() - 0.5) * 70,
            y: hPos.y + 40 + (Math.random() - 0.5) * 30,
            vx: (Math.random() - 0.5) * 55,
            vy: -130 - Math.random() * 120,
            color: hexStr,
            size: 3 + Math.random() * 3,
            delay: 0,
            age: 0,
            dur: 0.52,
            kind: ev.element === 'ice' ? 'shard' : 'ember',
          });
        }
      } else if (ev.kind === 'sword_fly') {
        this.audio.playElementalSword(ev.element, ev.isEvoke);
        const col = SWORD_ELEMENTS[ev.element].cssColor;
        const target = this.enemyStandees[ev.targetIdx] || this.enemyStandees[0];
        if (ev.element !== 'ice' && ev.element !== 'wood' && target) {
          const tPos = this.actorScreenCenter(target);
          this.spawnSwordStreak(
            hPos.x - 16,
            hPos.y - 78,
            tPos.x,
            tPos.y,
            col,
            ev.element,
            ev.isEvoke ? 0.18 : 0.23,
            0,
            ev.isEvoke ? 1.2 : 0.96,
            ev.isEvoke
          );
          if (ev.element === 'thunder') {
            this.spawnLightningBolt(tPos.x, tPos.y, col, 0.14);
          }
          this.spawnCrescentSlash(
            tPos.x,
            tPos.y,
            (Math.random() - 0.5) * 2.2,
            ev.isEvoke ? 126 : 88,
            ev.isEvoke ? 28 : 18,
            1.02,
            col,
            0.28,
            0.15
          );
        } else {
          // Ice / Wood supportive sword pulse on Hero!
          this.rings.push({
            x: hPos.x,
            y: hPos.y,
            r0: 18,
            r1: 120,
            scaleY: 1,
            color: col,
            bagua: true,
            delay: 0,
            age: 0,
            dur: 0.42,
          });
        }
      } else if (ev.kind === 'formation') {
        this.audio.playFormationAwaken();
        this.trauma = Math.min(1, this.trauma + 0.68);
        this.triggerHitstop(0.075);
        const hexStr = `#${ev.colorHex.toString(16).padStart(6, '0')}`;
        this.enemyStandees.forEach((es, idx) => {
          if (this.engine.enemies[idx]) {
            const p = this.actorScreenCenter(es);
            this.pillars.push({ x: p.x, y: p.y + 98, color: hexStr, age: 0, dur: 0.62 });
            this.rings.push({
              x: p.x,
              y: p.y + 84,
              r0: 20,
              r1: 185,
              scaleY: 0.36,
              color: hexStr,
              bagua: true,
              delay: 0.03,
              age: 0,
              dur: 0.55,
            });
            this.spawnImpactBurst(p.x, p.y, hexStr, 'fire', true, 0.04);
          }
        });
        this.showToast(`${ev.name} · 五行剑阵共鸣降世！`);
      } else if (ev.kind === 'damage_enemy') {
        const target = this.enemyStandees[ev.targetIdx];
        if (target) {
          const isBig = ev.amount >= 10;
          target.wobble = isBig ? 0.28 : 0.2;
          target.flashTimer = 0.11;
          target.lungePx = isBig ? 34 : 20;
          this.trauma = Math.min(1, this.trauma + (isBig ? 0.42 : 0.18));
          if (isBig) this.triggerHitstop(0.055);

          const p = this.actorScreenCenter(target);
          const hexStr = `#${ev.colorHex.toString(16).padStart(6, '0')}`;
          this.spawnImpactBurst(p.x, p.y, hexStr, 'metal', isBig, 0.08);
          if (ev.amount > 0) {
            this.spawnPopup(
              p.x,
              p.y - 34,
              isBig ? `斩 -${ev.amount}` : `-${ev.amount}`,
              isBig ? '#fde047' : '#fef08a',
              isBig
            );
          } else if (ev.blocked > 0) {
            this.spawnPopup(p.x, p.y - 30, `格挡 ${ev.blocked}`, '#93c5fd', false);
          }
        }
      } else if (ev.kind === 'damage_hero') {
        this.heroStandee.wobble = 0.24;
        if (ev.amount > 0) {
          this.heroStandee.flashTimer = 0.12;
          this.heroStandee.lungePx = -26;
          this.audio.playEnemyHitHero();
          this.trauma = Math.min(1, this.trauma + 0.46);
          this.triggerHitstop(0.05);
          this.spawnImpactBurst(hPos.x, hPos.y, '#fb7185', 'fire', true, 0);
          this.spawnPopup(hPos.x, hPos.y - 35, `-${ev.amount}`, '#fb7185', true);
        } else if (ev.blocked > 0) {
          this.audio.playJadeShield();
          this.rings.push({
            x: hPos.x + 28,
            y: hPos.y,
            r0: 24,
            r1: 126,
            scaleY: 1,
            color: '#2dd4bf',
            bagua: true,
            delay: 0,
            age: 0,
            dur: 0.36,
          });
          this.spawnImpactBurst(hPos.x + 32, hPos.y, '#5eead4', 'ice', false, 0);
          this.spawnPopup(hPos.x, hPos.y - 35, `罡气震碎 ${ev.blocked}`, '#5eead4', false);
        }
      } else if (ev.kind === 'block_hero') {
        this.audio.playJadeShield();
        this.spawnPopup(hPos.x, hPos.y - 45, `+${ev.amount} 罡气`, '#38bdf8', false);
      } else if (ev.kind === 'heal_hero') {
        this.spawnPopup(hPos.x, hPos.y - 45, `+${ev.amount} 气血`, '#4ade80', false);
      } else if (ev.kind === 'enemy_act') {
        const actor = this.enemyStandees[ev.enemyIdx];
        if (actor) {
          actor.lungePx = ev.attack ? -82 : -26;
          if (ev.attack) {
            // Triple Jagged Demon Claw Rend tearing across Hero!
            for (let c = -1; c <= 1; c++) {
              this.slashes.push({
                x: hPos.x + c * 22,
                y: hPos.y + c * 16,
                angle: 2.35,
                radius: 112,
                thickness: 16,
                sweepRad: 0.82,
                color: c === 0 ? '#f43f5e' : '#a855f7',
                delay: (c + 1) * 0.035,
                age: 0,
                dur: 0.32,
                claw: true,
                inkDrops: [],
              });
            }
          }
        }
      } else if (ev.kind === 'toast') {
        this.showToast(ev.text);
      }
    }
  }

  private triggerHitstop(sec: number): void {
    this.hitstopTimer = Math.max(this.hitstopTimer, sec);
  }

  private spawnSwordStreak(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    color: string,
    element: SwordElement,
    dur: number,
    delay = 0,
    scale = 1.05,
    heavy = false
  ): void {
    const cx = (x0 + x1) * 0.5 + (Math.random() - 0.5) * 60;
    const cy = Math.min(y0, y1) - 85 - Math.random() * 85;
    this.streaks.push({ x0, y0, cx, cy, x1, y1, color, element, delay, age: 0, dur, scale, heavy });
  }

  private spawnCrescentSlash(
    x: number,
    y: number,
    angle: number,
    radius: number,
    thickness: number,
    sweepRad: number,
    color: string,
    dur: number,
    delay = 0
  ): void {
    const inkDrops: { ang: number; dist: number; r: number }[] = [];
    for (let i = 0; i < 7; i++) {
      inkDrops.push({
        ang: (Math.random() - 0.5) * sweepRad * 1.85,
        dist: radius + 4 + Math.random() * 26,
        r: 2.2 + Math.random() * 4.8,
      });
    }
    this.slashes.push({
      x,
      y,
      angle,
      radius,
      thickness,
      sweepRad,
      color,
      delay,
      age: 0,
      dur,
      inkDrops,
    });
  }

  private spawnLightningBolt(hitX: number, hitY: number, color: string, delay = 0): void {
    const buildChain = (
      sx: number,
      sy: number,
      ex: number,
      ey: number,
      segs: number,
      jitter: number
    ): { x: number; y: number }[] => {
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        const j = i === 0 || i === segs ? 0 : (Math.random() - 0.5) * jitter;
        pts.push({ x: sx + (ex - sx) * t + j, y: sy + (ey - sy) * t });
      }
      return pts;
    };

    const main = buildChain(hitX + (Math.random() - 0.5) * 90, -25, hitX, hitY, 11, 56);
    const b1Start = main[4];
    const b2Start = main[7];
    const branch1 = buildChain(b1Start.x, b1Start.y, b1Start.x - 68, b1Start.y + 115, 5, 28);
    const branch2 = buildChain(b2Start.x, b2Start.y, b2Start.x + 64, b2Start.y + 95, 5, 26);

    this.bolts.push({
      chains: [main, branch1, branch2],
      hitX,
      hitY,
      color,
      delay,
      age: 0,
      dur: 0.34,
    });
  }

  private spawnImpactBurst(
    x: number,
    y: number,
    color: string,
    element: SwordElement,
    heavy: boolean,
    delay = 0
  ): void {
    this.flares.push({
      x,
      y,
      size: heavy ? 118 : 78,
      angle: (Math.random() - 0.5) * 0.7,
      color,
      delay,
      age: 0,
      dur: 0.2,
    });
    this.rings.push({
      x,
      y,
      r0: 14,
      r1: heavy ? 138 : 88,
      scaleY: 1,
      color,
      bagua: heavy,
      delay,
      age: 0,
      dur: heavy ? 0.38 : 0.28,
    });

    const count = heavy ? 24 : 13;
    const pKind: ImpactSpark['kind'] =
      element === 'fire' ? 'ember' : element === 'ice' ? 'shard' : 'spark';

    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.45;
      const spd = (heavy ? 240 : 165) + Math.random() * 310;
      this.sparks.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - (pKind === 'ember' ? 110 : 40),
        color: i % 3 === 0 ? '#fffbeb' : color,
        size: (heavy ? 3.6 : 2.5) + Math.random() * 2.8,
        delay,
        age: 0,
        dur: 0.32 + Math.random() * 0.26,
        kind: pKind,
      });
    }
  }

  private spawnPopup(
    x: number,
    y: number,
    text: string,
    color: string,
    big: boolean
  ): void {
    this.popups.push({
      x: x + (Math.random() - 0.5) * 32,
      y,
      vx: (Math.random() - 0.5) * 36,
      vy: -95,
      text,
      color,
      age: 0,
      dur: 0.88,
      big,
    });
  }

  // =========================================================================
  // UI Screen Sync & Gilded Guofeng Card Rendering
  // =========================================================================
  private syncAllUi(): void {
    const ph = this.engine.runPhase;
    const inCombat = ph === 'combat';

    this.heroStandee.wrapEl.classList.toggle('hidden', !inCombat);
    for (const es of this.enemyStandees) {
      es.wrapEl.classList.toggle('hidden', !inCombat);
    }

    document.getElementById('top-bar')!.classList.toggle('hidden', ph === 'title');
    document.getElementById('combat-ui')!.classList.toggle('hidden', !inCombat);
    document.getElementById('title-screen')!.classList.toggle('hidden', ph !== 'title');
    document.getElementById('map-screen')!.classList.toggle('hidden', ph !== 'map');
    document.getElementById('reward-screen')!.classList.toggle('hidden', ph !== 'reward');
    document.getElementById('rest-screen')!.classList.toggle('hidden', ph !== 'rest');
    document.getElementById('shop-screen')!.classList.toggle('hidden', ph !== 'shop');
    document.getElementById('event-screen')!.classList.toggle('hidden', ph !== 'event');
    document.getElementById('result-screen')!.classList.toggle(
      'hidden',
      ph !== 'victory' && ph !== 'gameover'
    );

    if (ph !== 'title') {
      this.refreshTopBar();
      this.updateRealmBackdrop();
    } else {
      this.stageBg.style.backgroundImage = `url('./art/bg_realm1.webp')`;
    }

    if (ph === 'map') this.renderSpireMap();
    else if (ph === 'combat') this.refreshCombatHud();
    else if (ph === 'reward') this.renderRewardScreen();
    else if (ph === 'rest') this.renderRestScreen();
    else if (ph === 'shop') this.renderShopScreen();
    else if (ph === 'event') this.renderEventScreen();
    else if (ph === 'victory' || ph === 'gameover') this.renderResultScreen(ph === 'victory');
  }

  private refreshTopBar(): void {
    document.getElementById('top-hero-name')!.textContent = this.engine.hero.name;
    const fl = Math.max(1, this.engine.currentRow + 1);
    const realmNames = ['第一重天·锁妖殿', '第二重天·幽冥冢', '第三重天·九霄坛'];
    const rIdx = Math.min(2, Math.floor(Math.max(0, this.engine.currentRow) / 5));
    document.getElementById('top-floor-badge')!.textContent = `${realmNames[rIdx]} · ${fl}/15 劫`;
    const hpPct = Math.max(0, Math.min(100, (this.engine.hp / this.engine.maxHp) * 100));
    document.getElementById('top-hp-bar')!.style.width = `${hpPct.toFixed(1)}%`;
    document.getElementById('top-hp')!.innerHTML =
      `${XIANXIA_ICONS.bloodLotus}<span>${this.engine.hp}/${this.engine.maxHp}</span>`;
    document.getElementById('top-gold')!.innerHTML =
      `${XIANXIA_ICONS.coin}<span>${this.engine.gold} 灵石</span>`;
    document.getElementById('deck-count')!.textContent = String(this.engine.masterDeck.length);

    document.getElementById('relic-strip')!.innerHTML = this.engine.relics
      .map((rid) => {
        const r = RELICS[rid];
        return `<div class="relic-badge" title="${r.name}：${r.desc}">
          <img src="${r.icon}" alt="${r.name}" />
          <span>${r.name}</span>
        </div>`;
      })
      .join('');
  }

  private renderTitleHeroes(): void {
    const sectSeals = ['剑宗', '符宗', '体宗'];
    const glowColors = [
      'rgba(229, 169, 60, 0.28)',
      'rgba(168, 85, 247, 0.28)',
      'rgba(225, 29, 72, 0.28)',
    ];
    const grid = document.getElementById('hero-grid')!;
    grid.innerHTML = HEROES.map((h, idx) => {
      const rel = RELICS[h.starterRelic];
      return `<div class="hero-card ${idx === this.selectedHeroIdx ? 'selected' : ''}" data-idx="${idx}">
        ${renderFrameCorners()}
        <div class="hero-art-banner" style="--hero-glow:${glowColors[idx]};">
          ${XIANXIA_ICONS.baguaWatermark}
          <span class="hero-sect-seal">${sectSeals[idx]}</span>
          <span class="hero-hp-tag">${XIANXIA_ICONS.bloodLotus} 气血 ${h.maxHp}</span>
          <img class="hero-standee-preview" src="${h.standee}" alt="${h.name}" />
        </div>
        <div class="hero-title-row">
          <span class="hero-name">${h.name}</span>
          <span class="hero-sub">${h.title}</span>
        </div>
        <div class="hero-desc">${h.desc}</div>
        <div class="hero-relic">
          <img src="${rel.icon}" alt="${rel.name}" />
          <div class="hero-relic-txt">
            <strong>本命【${rel.name}】</strong><br/>${rel.desc}
          </div>
        </div>
      </div>`;
    }).join('');

    grid.querySelectorAll('.hero-card').forEach((el) => {
      el.addEventListener('click', () => {
        this.audio.unlock();
        this.audio.playCardHover();
        this.selectedHeroIdx = Number((el as HTMLElement).dataset.idx);
        this.renderTitleHeroes();
      });
    });
  }

  private renderSpireMap(): void {
    const selectable = this.engine.getSelectableNodeIds();
    const realmNames = ['第一重天 · 锁妖残殿', '第二重天 · 幽冥剑冢', '第三重天 · 九霄天劫坛'];
    const nextRow = Math.min(14, this.engine.currentRow + 1);
    document.getElementById('map-realm-tag')!.textContent =
      realmNames[Math.floor(nextRow / 5)];

    const nodesWrap = document.getElementById('map-nodes')!;
    const svg = document.getElementById('map-svg')!;
    const rowH = 68;
    const totalH = 15 * rowH + 60;
    nodesWrap.style.height = `${totalH}px`;
    svg.setAttribute('height', String(totalH));

    const posOf = (n: MapNode) => ({
      xPct: n.kind === 'boss' ? 50 : 22 + n.col * 28,
      y: totalH - 42 - n.row * rowH,
    });

    const nodeLookup = new Map<string, MapNode>();
    for (const row of this.engine.mapRows) {
      for (const n of row) nodeLookup.set(n.id, n);
    }

    const lines: string[] = [];
    for (const row of this.engine.mapRows) {
      for (const n of row) {
        const p1 = posOf(n);
        for (const nid of n.nextIds) {
          const target = nodeLookup.get(nid);
          if (!target) continue;
          const p2 = posOf(target);
          const activeEdge =
            (n.id === this.engine.currentNodeId && selectable.has(nid)) ||
            (n.cleared && target.cleared);
          lines.push(
            `<line x1="${p1.xPct}%" y1="${p1.y}" x2="${p2.xPct}%" y2="${p2.y}" stroke="${
              activeEdge ? '#fbbf24' : 'rgba(148,163,184,0.28)'
            }" stroke-width="${activeEdge ? 2.5 : 1.5}" stroke-dasharray="${
              activeEdge ? '' : '5,5'
            }" />`
          );
        }
      }
    }
    svg.innerHTML = lines.join('');

    const labelMap: Record<MapNode['kind'], { seal: string; name: string }> = {
      battle: { seal: '剑', name: '群妖拦路' },
      elite: { seal: '煞', name: '凶煞妖王' },
      rest: { seal: '炉', name: '洞府丹炉' },
      shop: { seal: '坊', name: '云游仙坊' },
      event: { seal: '缘', name: '秘境奇遇' },
      boss: { seal: '尊', name: '镇界魔尊' },
    };

    nodesWrap.innerHTML = this.engine.mapRows
      .flat()
      .map((n) => {
        const p = posOf(n);
        const avail = selectable.has(n.id);
        const info = labelMap[n.kind];
        return `<button class="map-node ${n.cleared ? 'cleared' : ''} ${
          avail ? 'available' : ''
        }" data-nid="${n.id}" style="left:${p.xPct}%; top:${p.y}px;">
          <span class="mn-seal">【${info.seal}】</span>
          <span>第${n.row + 1}劫 · ${info.name}</span>
        </button>`;
      })
      .join('');

    nodesWrap.querySelectorAll('.map-node.available').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.audio.unlock();
        this.audio.playSwordSlash(false);
        const nid = (btn as HTMLElement).dataset.nid!;
        if (this.engine.enterMapNode(nid)) {
          if (this.engine.runPhase === 'combat') {
            this.rebuildEnemyStandees();
            this.processEngineVisualEvents();
          }
          this.syncAllUi();
        }
      });
    });

    const scrollEl = document.getElementById('map-scroll')!;
    const focusY = totalH - 42 - nextRow * rowH;
    scrollEl.scrollTop = Math.max(0, focusY - scrollEl.clientHeight * 0.55);
  }

  private refreshCombatHud(): void {
    this.refreshTopBar();
    const maxQi = this.engine.baseQiPerTurn + this.engine.bonusQiRegen;
    document.getElementById('qi-text')!.textContent = `${this.engine.qi}/${maxQi}`;
    document.getElementById('draw-count')!.textContent = String(this.engine.drawPile.length);
    document.getElementById('discard-count')!.textContent = String(
      this.engine.discardPile.length
    );
    document.getElementById('exhaust-count')!.textContent = String(
      this.engine.exhaustPile.length
    );

    document.getElementById('sb-count')!.textContent =
      `${this.engine.swordBox.length}/${this.engine.maxSwordSlots}`;
    const slotsHtml: string[] = [];
    for (let i = 0; i < this.engine.maxSwordSlots; i++) {
      const el = this.engine.swordBox[i];
      if (el) {
        const sp = SWORD_ELEMENTS[el];
        slotsHtml.push(
          `<span class="sb-slot filled" style="border-color:${sp.cssColor}; background:${sp.cssColor}30" title="${sp.name}：${sp.passiveDesc} | ${sp.evokeDesc}">${sp.name}</span>`
        );
      } else {
        slotsHtml.push(`<span class="sb-slot">空剑槽</span>`);
      }
    }
    document.getElementById('sb-slots')!.innerHTML = slotsHtml.join('');

    const fan = document.getElementById('hand-fan')!;
    const n = this.engine.hand.length;
    const overlapMargin = n >= 7 ? 'margin: 0 -10px;' : '';
    fan.innerHTML = this.engine.hand
      .map((card, idx) => {
        const mid = (n - 1) * 0.5;
        const off = idx - mid;
        const rot = off * (n > 6 ? 2.2 : 3.2);
        const yOff = Math.abs(off) * Math.abs(off) * 1.8;
        const playable = this.engine.getCardCost(card) <= this.engine.qi;
        return this.renderHoloCardHtml(card, {
          playable,
          hotkey: idx < 9 ? String(idx + 1) : undefined,
          fanStyle: `${overlapMargin} --fan-rot:${rot.toFixed(1)}deg; --fan-y:${yOff.toFixed(1)}px; z-index:${10 + idx};`,
        });
      })
      .join('');

    this.hoveredCardEl = null;
    this.hoveredSingleTarget = false;

    fan.querySelectorAll('.holo-card').forEach((el) => {
      const htmlEl = el as HTMLElement;
      const uid = Number(htmlEl.dataset.uid);
      const card = this.engine.hand.find((c) => c.uid === uid);
      if (!card) return;
      const def = CARDS[card.defId];

      this.attachHoloTilt(htmlEl);
      htmlEl.addEventListener('pointerenter', () => {
        this.audio.playCardHover();
        this.hoveredCardEl = htmlEl;
        this.hoveredSingleTarget = def.target === 'single';
      });
      htmlEl.addEventListener('pointerleave', () => {
        if (this.hoveredCardEl === htmlEl) {
          this.hoveredCardEl = null;
          this.hoveredSingleTarget = false;
        }
      });
      htmlEl.addEventListener('click', () => {
        this.audio.unlock();
        if (this.engine.playCard(uid, this.engine.selectedTargetIdx)) {
          this.hoveredCardEl = null;
          this.processEngineVisualEvents();
          this.syncAllUi();
        } else {
          this.showToast('丹田灵力不足，尚难催动此剑诀');
        }
      });
    });

    this.updateActorPlatesContent();
  }

  private renderHoloCardHtml(
    card: CardInstance,
    opts: { playable?: boolean; hotkey?: string; fanStyle?: string; price?: number } = {}
  ): string {
    const def = CARDS[card.defId];
    const cost = this.engine.getCardCost(card);
    const title = this.engine.getCardTitle(card);
    const typeLabel =
      def.type === 'attack' ? '剑诀 · 攻伐' : def.type === 'skill' ? '身法 · 玄术' : '心法 · 永续';

    let desc = this.engine.getCardDesc(card);
    if (this.engine.runPhase === 'combat') {
      const ops = this.engine.getCardOps(card);
      const dmgOp = ops.find((o) => o.op === 'damage') as
        | { op: 'damage'; amount: number }
        | undefined;
      if (dmgOp) {
        const real = this.engine.previewCardDamage(dmgOp.amount);
        desc = desc.replace(`${dmgOp.amount} `, `<b>${real}</b> `);
      }
      const blkOp = ops.find((o) => o.op === 'block') as
        | { op: 'block'; amount: number }
        | undefined;
      if (blkOp) {
        const realB = this.engine.previewCardBlock(blkOp.amount);
        desc = desc.replace(`${blkOp.amount} `, `<b>${realB}</b> `);
      }
    }

    const unplayableClass = opts.playable === false ? 'unplayable' : '';
    return `
      <div class="holo-card type-${def.type} ${card.upgraded ? 'upgraded' : ''} ${unplayableClass}"
           data-uid="${card.uid}" style="${opts.fanStyle || ''}">
        <div class="hc-top">
          <span class="hc-cost"><b>${cost}</b></span>
          <span class="hc-title">${title}</span>
        </div>
        ${opts.hotkey ? `<span class="hc-key">[${opts.hotkey}]</span>` : ''}
        <div class="hc-art-wrap">
          <img src="${def.art}" alt="${title}" />
        </div>
        <div class="hc-type-tag">${typeLabel}</div>
        <div class="hc-desc"><span>${desc}</span></div>
        ${opts.price !== undefined ? `<div class="price-tag">${XIANXIA_ICONS.coin} ${opts.price} 灵石</div>` : ''}
      </div>`;
  }

  private attachHoloTilt(el: HTMLElement): void {
    el.addEventListener('pointermove', (ev) => {
      const r = el.getBoundingClientRect();
      const px = (ev.clientX - r.left) / Math.max(1, r.width);
      const py = (ev.clientY - r.top) / Math.max(1, r.height);
      const ry = (px - 0.5) * 20;
      const rx = (0.5 - py) * 18;
      el.style.setProperty('--rx', `${rx.toFixed(1)}deg`);
      el.style.setProperty('--ry', `${ry.toFixed(1)}deg`);
      el.style.setProperty('--mx', `${(px * 100).toFixed(0)}%`);
      el.style.setProperty('--my', `${(py * 100).toFixed(0)}%`);
    });
    el.addEventListener('pointerleave', () => {
      el.style.setProperty('--rx', '0deg');
      el.style.setProperty('--ry', '0deg');
    });
  }

  private updateActorPlatesContent(): void {
    const hpPct = Math.max(0, (this.engine.hp / this.engine.maxHp) * 100);
    const hTags: string[] = [];
    if (this.engine.block > 0) hTags.push(`<span class="st-tag blk">罡气 ${this.engine.block}</span>`);
    if (this.engine.strength > 0) hTags.push(`<span class="st-tag buff">剑意 +${this.engine.strength}</span>`);
    if (this.engine.dexterity > 0) hTags.push(`<span class="st-tag buff">身法 +${this.engine.dexterity}</span>`);
    if (this.engine.thorns > 0) hTags.push(`<span class="st-tag buff">剑棘 ${this.engine.thorns}</span>`);
    if (this.engine.vuln > 0) hTags.push(`<span class="st-tag vuln">破绽 ${this.engine.vuln}</span>`);
    if (this.engine.weak > 0) hTags.push(`<span class="st-tag weak">虚弱 ${this.engine.weak}</span>`);

    this.heroStandee.imgEl.alt = this.engine.hero.name;
    this.heroStandee.plateEl.innerHTML = `
      <div class="plate-box">
        <div class="plate-name">${this.engine.hero.name.split(' · ')[0]}</div>
        <div class="hp-track">
          <div class="hp-fill hero" style="width:${hpPct.toFixed(1)}%"></div>
          <span class="hp-num">${this.engine.hp} / ${this.engine.maxHp}</span>
        </div>
        <div class="status-row">${hTags.join('')}</div>
      </div>`;

    this.enemyStandees.forEach((actor, idx) => {
      const e: EnemyInstance | undefined = this.engine.enemies[idx];
      if (!e || e.hp <= 0) {
        actor.plateEl.classList.add('hidden');
        actor.wrapEl.classList.add('hidden');
        return;
      }
      actor.plateEl.classList.remove('hidden');
      actor.wrapEl.classList.remove('hidden');
      const isSel = idx === this.engine.selectedTargetIdx;
      actor.plateEl.classList.toggle('selected', isSel);
      actor.wrapEl.classList.toggle('selected', isSel);

      const mv = e.intent;
      let intentIcon = XIANXIA_ICONS.taiji;
      let intentTxt = mv.intentName;
      let pillClass = 'def';
      if (mv.dmg) {
        const realD = this.engine.previewEnemyAttackDamage(e);
        const hits = mv.hits || 1;
        intentIcon = mv.kind === 'nuke' ? XIANXIA_ICONS.flame : XIANXIA_ICONS.singleSword;
        intentTxt = hits > 1 ? `${realD}×${hits}` : `${realD}`;
        if (mv.block) intentTxt += ` · 罡${mv.block}`;
        pillClass = mv.kind === 'nuke' ? 'nuke' : '';
      } else if (mv.block) {
        intentIcon = XIANXIA_ICONS.shield;
        intentTxt = `${mv.block}${mv.strength ? ` · 威+${mv.strength}` : ''}`;
      }

      const eTags: string[] = [];
      if (e.block > 0) eTags.push(`<span class="st-tag blk">罡 ${e.block}</span>`);
      if (e.burn > 0) eTags.push(`<span class="st-tag burn">丹火 ${e.burn}</span>`);
      if (e.vuln > 0) eTags.push(`<span class="st-tag vuln">破绽 ${e.vuln}</span>`);
      if (e.weak > 0) eTags.push(`<span class="st-tag weak">虚弱 ${e.weak}</span>`);
      if (e.strength > 0) eTags.push(`<span class="st-tag buff">魔威 +${e.strength}</span>`);

      const ePct = Math.max(0, (e.hp / e.maxHp) * 100);
      actor.plateEl.innerHTML = `
        <div class="intent-pill ${pillClass}" title="下回合意图：${mv.intentName}">
          ${intentIcon}
          <span>${intentTxt}</span>
        </div>
        <div class="plate-box">
          <div class="plate-name">${e.name}</div>
          <div class="hp-track">
            <div class="hp-fill" style="width:${ePct.toFixed(1)}%"></div>
            <span class="hp-num">${e.hp} / ${e.maxHp}</span>
          </div>
          <div class="status-row">${eTags.join('')}</div>
        </div>`;
    });
  }

  private renderRewardScreen(): void {
    this.audio.playVictoryFanfare();
    const rel = this.engine.rewardRelicId ? RELICS[this.engine.rewardRelicId] : null;
    document.getElementById('reward-summary')!.innerHTML = `
      <span class="rw-pill">${XIANXIA_ICONS.coin}<span>缴获灵石 +${this.engine.rewardGold}</span></span>
      ${
        rel
          ? `<span class="rw-pill relic"><img src="${rel.icon}" width="22" height="22" alt="${rel.name}" /><span>秘境法宝【${rel.name}】：${rel.desc}</span></span>`
          : ''
      }
    `;
    const grid = document.getElementById('reward-cards')!;
    grid.innerHTML = this.engine.rewardCards
      .map((c) => this.renderHoloCardHtml(c))
      .join('');
    grid.querySelectorAll('.holo-card').forEach((el) => {
      const htmlEl = el as HTMLElement;
      this.attachHoloTilt(htmlEl);
      htmlEl.addEventListener('click', () => {
        this.audio.playSwordSlash(false);
        this.engine.claimRewardCard(Number(htmlEl.dataset.uid));
        this.syncAllUi();
      });
    });
  }

  private renderRestScreen(): void {
    const healAmt = Math.max(15, Math.round(this.engine.maxHp * 0.35));
    document.getElementById('rest-heal-desc')!.textContent =
      `立即回复 35% 最大气血 (+${healAmt} 气血 · 当前 ${this.engine.hp}/${this.engine.maxHp})`;

    const candidates = this.engine.masterDeck.filter((c) => !c.upgraded);
    const grid = document.getElementById('forge-grid')!;
    grid.innerHTML = candidates
      .map((c) => this.renderHoloCardHtml({ ...c, upgraded: true }))
      .join('');

    grid.querySelectorAll('.holo-card').forEach((el) => {
      const htmlEl = el as HTMLElement;
      this.attachHoloTilt(htmlEl);
      htmlEl.addEventListener('click', () => {
        const uid = Number(htmlEl.dataset.uid);
        if (this.engine.restForgeCard(uid)) {
          this.audio.playFormationAwaken();
          this.showToast('地火淬剑大成 · 剑诀已永久升阶为【极品 +】');
          this.syncAllUi();
        }
      });
    });
  }

  private renderShopScreen(): void {
    const shop = this.engine.currentShop;
    if (!shop) return;

    const svc = document.getElementById('shop-services')!;
    const rel = shop.relic ? RELICS[shop.relic.relicId] : null;
    svc.innerHTML = `
      ${
        rel && shop.relic
          ? `<button id="btn-buy-relic" class="shop-svc-btn" ${
              shop.relic.sold || this.engine.gold < shop.relic.price ? 'disabled' : ''
            }>
              <img src="${rel.icon}" width="26" height="26" alt="${rel.name}" />
              <span>${shop.relic.sold ? '已购法宝' : `购置【${rel.name}】`}</span>
              ${shop.relic.sold ? '' : `<em class="svc-cost">${XIANXIA_ICONS.coin}${shop.relic.price}</em>`}
            </button>`
          : ''
      }
      <button id="btn-buy-heal" class="shop-svc-btn" ${
        shop.healUsed || this.engine.gold < shop.healPrice ? 'disabled' : ''
      }>
        ${XIANXIA_ICONS.furnace}
        <span>${shop.healUsed ? '已服灵丹' : '九转灵丹 (+30%气血)'}</span>
        ${shop.healUsed ? '' : `<em class="svc-cost">${XIANXIA_ICONS.coin}${shop.healPrice}</em>`}
      </button>
      <button id="btn-toggle-purge" class="shop-svc-btn" ${
        shop.removeUsed || this.engine.gold < shop.removePrice || this.engine.masterDeck.length <= 5
          ? 'disabled'
          : ''
      }>
        ${XIANXIA_ICONS.taiji}
        <span>${shop.removeUsed ? '已洗髓忘尘' : '洗髓忘尘 (删1张牌)'}</span>
        ${shop.removeUsed ? '' : `<em class="svc-cost">${XIANXIA_ICONS.coin}${shop.removePrice}</em>`}
      </button>
    `;

    document.getElementById('btn-buy-relic')?.addEventListener('click', () => {
      if (this.engine.buyShopRelic()) {
        this.audio.playFormationAwaken();
        this.renderShopScreen();
        this.refreshTopBar();
      }
    });
    document.getElementById('btn-buy-heal')?.addEventListener('click', () => {
      if (this.engine.buyShopHeal()) {
        this.audio.playJadeShield();
        this.renderShopScreen();
        this.refreshTopBar();
      }
    });
    document.getElementById('btn-toggle-purge')?.addEventListener('click', () => {
      const wrap = document.getElementById('shop-purge-wrap')!;
      wrap.classList.toggle('hidden');
      const pGrid = document.getElementById('shop-purge-grid')!;
      pGrid.innerHTML = this.engine.masterDeck.map((c) => this.renderHoloCardHtml(c)).join('');
      pGrid.querySelectorAll('.holo-card').forEach((el) => {
        el.addEventListener('click', () => {
          const uid = Number((el as HTMLElement).dataset.uid);
          if (this.engine.buyShopRemoveCard(uid)) {
            this.audio.playSwordSlash(true);
            wrap.classList.add('hidden');
            this.showToast('道心澄明 · 已从本命剑谱永久斩除该牌');
            this.renderShopScreen();
            this.refreshTopBar();
          }
        });
      });
    });

    const cGrid = document.getElementById('shop-cards')!;
    cGrid.innerHTML = shop.cards
      .map((item, idx) =>
        item.sold
          ? ''
          : `<div data-sidx="${idx}">${this.renderHoloCardHtml(item.card, {
              playable: this.engine.gold >= item.price,
              price: item.price,
            })}</div>`
      )
      .join('');

    cGrid.querySelectorAll('[data-sidx]').forEach((wrap) => {
      const sIdx = Number((wrap as HTMLElement).dataset.sidx);
      const cardEl = wrap.querySelector('.holo-card') as HTMLElement;
      this.attachHoloTilt(cardEl);
      cardEl.addEventListener('click', () => {
        if (this.engine.buyShopCard(sIdx)) {
          this.audio.playJadeShield();
          this.renderShopScreen();
          this.refreshTopBar();
        } else {
          this.showToast('囊中灵石不足，尚难易物');
        }
      });
    });
  }

  private renderEventScreen(): void {
    const ev = this.engine.currentEvent;
    if (!ev) return;
    document.getElementById('event-title')!.textContent = ev.title;
    document.getElementById('event-desc')!.textContent = ev.desc;
    const wrap = document.getElementById('event-choices')!;
    wrap.innerHTML = ev.choices
      .map(
        (c) => `<button class="event-btn" data-oid="${c.outcomeId}">
          <strong>${c.label}</strong>
          <span>${c.hint}</span>
        </button>`
      )
      .join('');
    wrap.querySelectorAll('.event-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.audio.playJadeShield();
        const msg = this.engine.chooseEventOption((btn as HTMLElement).dataset.oid!);
        this.showToast(msg);
        this.syncAllUi();
      });
    });
  }

  private openDeckInspector(title: string, list: CardInstance[]): void {
    document.getElementById('deck-modal-title')!.textContent = `${title} (${list.length} 张)`;
    const grid = document.getElementById('deck-modal-grid')!;
    grid.innerHTML = list.map((c) => this.renderHoloCardHtml(c)).join('');
    grid.querySelectorAll('.holo-card').forEach((el) => this.attachHoloTilt(el as HTMLElement));
    document.getElementById('deck-modal')!.classList.remove('hidden');
  }

  private renderResultScreen(victory: boolean): void {
    if (victory) this.audio.playVictoryFanfare();
    document.getElementById('result-eyebrow')!.textContent = victory
      ? '九天玄诏 · 三界荡平'
      : '元神兵解 · 轮回重修';
    document.getElementById('result-title')!.textContent = victory
      ? '剑破九霄 · 羽化登仙'
      : '道消身陨 · 剑断锁仙台';
    document.getElementById('result-stats')!.innerHTML = `
      <div>所选道统：<strong>${this.engine.hero.name}</strong></div>
      <div>抵达劫数：<strong>第 ${Math.max(1, this.engine.currentRow + 1)} / 15 劫</strong></div>
      <div>最终剑谱：<strong>${this.engine.masterDeck.length} 张剑诀 (${
        this.engine.masterDeck.filter((c) => c.upgraded).length
      } 张已淬炼+)</strong></div>
      <div>执掌法宝：<strong>${this.engine.relics.map((r) => RELICS[r].name).join(' · ')}</strong></div>
    `;
  }

  private showToast(msg: string): void {
    const el = document.getElementById('toast-banner')!;
    el.textContent = msg;
    el.classList.remove('hidden');
    this.toastTimer = 3.0;
  }

  private bindUiEvents(): void {
    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('pointerdown', () => this.audio.unlock(), { passive: true });

    document.getElementById('btn-start-run')!.addEventListener('click', () => {
      this.audio.unlock();
      this.audio.playFormationAwaken();
      const heroId: HeroId = HEROES[this.selectedHeroIdx].id;
      this.engine.startNewRun(heroId);
      this.syncAllUi();
    });

    document.getElementById('btn-end-turn')!.addEventListener('click', () => {
      this.audio.unlock();
      if (this.engine.runPhase === 'combat') {
        this.engine.endPlayerTurn();
        this.processEngineVisualEvents();
        this.syncAllUi();
      }
    });

    document.getElementById('btn-skip-reward')!.addEventListener('click', () => {
      this.engine.gold += 15;
      this.engine.claimRewardCard(null);
      this.syncAllUi();
    });

    document.getElementById('btn-rest-heal')!.addEventListener('click', () => {
      this.audio.playJadeShield();
      this.engine.restMeditate();
      this.showToast('打坐吐纳完毕 · 周天灵脉充盈');
      this.syncAllUi();
    });

    document.getElementById('btn-leave-shop')!.addEventListener('click', () => {
      this.engine.leaveSubScreen();
      this.syncAllUi();
    });

    document.getElementById('btn-open-deck')!.addEventListener('click', () => {
      this.openDeckInspector('本命剑谱总览', this.engine.masterDeck);
    });
    document.getElementById('btn-draw-pile')!.addEventListener('click', () => {
      const copy = [...this.engine.drawPile].sort((a, b) => a.defId.localeCompare(b.defId));
      this.openDeckInspector('剑匣待抽牌堆 (乱序展示)', copy);
    });
    document.getElementById('btn-discard-pile')!.addEventListener('click', () => {
      this.openDeckInspector('归鞘弃牌堆', this.engine.discardPile);
    });
    document.getElementById('btn-exhaust-pile')!.addEventListener('click', () => {
      this.openDeckInspector('本战已焚禁术', this.engine.exhaustPile);
    });
    document.getElementById('btn-close-deck')!.addEventListener('click', () => {
      document.getElementById('deck-modal')!.classList.add('hidden');
    });

    const syncMuteBtn = (muted: boolean) => {
      document.getElementById('btn-Audio-mute')!.innerHTML = muted
        ? `${XIANXIA_ICONS.mute}<span>静音</span>`
        : `${XIANXIA_ICONS.chime}<span>古乐</span>`;
    };

    document.getElementById('btn-Audio-mute')!.addEventListener('click', () => {
      this.audio.unlock();
      syncMuteBtn(this.audio.toggleMute());
    });

    document.getElementById('btn-give-up')!.addEventListener('click', () => {
      this.engine.runPhase = 'title';
      this.syncAllUi();
    });
    document.getElementById('btn-restart-run')!.addEventListener('click', () => {
      this.engine.runPhase = 'title';
      this.syncAllUi();
    });

    window.addEventListener('keydown', (e) => {
      this.audio.unlock();
      if (e.repeat) return;

      if (e.code === 'Escape') {
        document.getElementById('deck-modal')!.classList.add('hidden');
        return;
      }
      if (e.code === 'KeyM') {
        syncMuteBtn(this.audio.toggleMute());
        return;
      }
      if (e.code === 'KeyD' && this.engine.runPhase !== 'title') {
        this.openDeckInspector('本命剑谱总览', this.engine.masterDeck);
        return;
      }

      if (this.engine.runPhase === 'title' && (e.code === 'Space' || e.code === 'Enter')) {
        e.preventDefault();
        this.engine.startNewRun(HEROES[this.selectedHeroIdx].id);
        this.syncAllUi();
        return;
      }

      if (this.engine.runPhase === 'combat') {
        if (e.code.startsWith('Digit')) {
          const idx = Number(e.code.slice(5)) - 1;
          const card = this.engine.hand[idx];
          if (card && this.engine.playCard(card.uid, this.engine.selectedTargetIdx)) {
            this.processEngineVisualEvents();
            this.syncAllUi();
          }
        } else if (e.code === 'Tab') {
          e.preventDefault();
          const len = this.engine.enemies.length;
          for (let k = 1; k <= len; k++) {
            const nxt = (this.engine.selectedTargetIdx + k) % len;
            if (this.engine.enemies[nxt]?.hp > 0) {
              this.engine.selectedTargetIdx = nxt;
              this.refreshCombatHud();
              break;
            }
          }
        } else if (e.code === 'KeyE' || e.code === 'Space') {
          e.preventDefault();
          this.engine.endPlayerTurn();
          this.processEngineVisualEvents();
          this.syncAllUi();
        }
      }
    });
  }

  // =========================================================================
  // 60 FPS Illustrated Standee Motion & Ink-and-Gold Canvas VFX Loop
  // =========================================================================
  private tick(ts: number): void {
    const realDt = Math.min(0.05, Math.max(0.001, (ts - this.lastTs) / 1000));
    this.lastTs = ts;

    // Asymmetric Sakurai Hit-Stop: decays in real time so shake & UI never stall!
    let simScale = 1.0;
    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - realDt);
      simScale = 0.12;
    }
    const dt = realDt * simScale;
    this.clockSec += realDt;

    if (this.toastTimer > 0) {
      this.toastTimer -= realDt;
      if (this.toastTimer <= 0) {
        document.getElementById('toast-banner')!.classList.add('hidden');
      }
    }

    const inCombat = this.engine.runPhase === 'combat';
    const isBoss = inCombat && this.engine.enemies.some((e) => e.isBoss && e.hp > 0);
    this.audio.stepBgm(inCombat, isBoss);

    // Subtle Stage Parallax Breath + Trauma² Impact Shake (decays in realDt!)
    let shakeX = Math.sin(this.clockSec * 0.6) * 4;
    let shakeY = Math.cos(this.clockSec * 0.45) * 3;
    let shakeRot = 0;
    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - 1.95 * realDt);
      const sh = this.trauma * this.trauma;
      const sx = Math.sin(this.clockSec * 51) * 18 * sh;
      const sy = Math.cos(this.clockSec * 59) * 13 * sh;
      shakeRot = Math.sin(this.clockSec * 37) * 1.25 * sh;
      this.stageRoot.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) rotate(${shakeRot.toFixed(2)}deg)`;
    } else {
      this.stageRoot.style.transform = '';
    }
    this.stageBg.style.transform = `translate3d(${shakeX.toFixed(1)}px, ${shakeY.toFixed(
      1
    )}px, 0)`;

    const w = this.fxCanvas.width;
    const h = this.fxCanvas.height;
    this.backCtx.clearRect(0, 0, w, h);
    this.fxCtx.clearRect(0, 0, w, h);

    // 1. Ambient Rising Golden & Jade Spirit Motes
    for (const m of this.motes) {
      m.y += m.vy * dt;
      m.x += (m.vx + Math.sin(this.clockSec * 1.5 + m.r) * 8) * dt;
      if (m.y < -10) {
        m.y = h + 10;
        m.x = Math.random() * w;
      }
      this.backCtx.save();
      this.backCtx.globalAlpha = m.alpha * (0.65 + 0.35 * Math.sin(this.clockSec * 3 + m.x));
      this.backCtx.fillStyle = m.gold ? '#fde68a' : '#5eead4';
      this.backCtx.shadowColor = m.gold ? '#f59e0b' : '#2dd4bf';
      this.backCtx.shadowBlur = 8;
      this.backCtx.beginPath();
      this.backCtx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      this.backCtx.fill();
      this.backCtx.restore();
    }

    // 2. Combat Standees, Bagua Ground Arrays & Illustrated Orbiting Swords
    if (inCombat) {
      this.stepStandee(this.heroStandee, dt, 0);

      const hFootX = (this.heroStandee.xPct / 100) * w + this.heroStandee.lungePx;
      const hFootY = (this.heroStandee.yPct / 100) * h;

      // Hero Jade-Gold Bagua Ground Array & Protective Talisman Shield Halo!
      this.drawGroundBaguaArray(
        this.backCtx,
        hFootX,
        hFootY,
        92,
        this.engine.block > 0 ? '#2dd4bf' : 'rgba(245,158,11,0.38)',
        this.clockSec * 0.7
      );
      if (this.engine.block > 0) {
        this.drawProtectiveBaguaHalo(
          this.fxCtx,
          hFootX,
          hFootY - (this.heroStandee.imgEl.offsetHeight || 260) * 0.5,
          105
        );
      }

      // Draw 2.5D Orbiting Five-Element Swords around Hero (Back half on backCtx, Front half on fxCtx!)
      const swords = this.engine.swordBox;
      const hCenterY = hFootY - (this.heroStandee.imgEl.offsetHeight || 260) * 0.56;
      for (let i = 0; i < swords.length; i++) {
        const el = swords[i];
        const ang = this.clockSec * 1.65 + (i / swords.length) * Math.PI * 2;
        const ox = hFootX - 18 + Math.cos(ang) * 92;
        const oy = hCenterY - 22 + Math.sin(ang) * 34;
        const inFront = Math.sin(ang) > 0;
        this.drawIllustratedJian(
          inFront ? this.fxCtx : this.backCtx,
          ox,
          oy,
          -Math.PI * 0.36 + Math.cos(ang) * 0.18,
          el,
          inFront ? 1.0 : 0.84
        );
      }

      // Step Enemy Standees & Selected Target Golden Bagua Reticle
      this.enemyStandees.forEach((es, idx) => {
        const e = this.engine.enemies[idx];
        if (!e || e.hp <= 0) return;
        this.stepStandee(es, dt, idx + 1);
        if (idx === this.engine.selectedTargetIdx) {
          const ex = (es.xPct / 100) * w + es.lungePx;
          const ey = (es.yPct / 100) * h;
          this.drawGroundBaguaArray(
            this.backCtx,
            ex,
            ey,
            e.isBoss ? 128 : 96,
            '#fbbf24',
            -this.clockSec * 1.4
          );
        }
      });
    }

    // 3. Foreground 7-Channel Ink-and-Gold VFX
    this.renderForegroundVfx(realDt);

    requestAnimationFrame((nextTs) => this.tick(nextTs));
  }

  private stepStandee(a: StandeeActor, dt: number, phaseSeed: number): void {
    a.lungePx *= Math.exp(-10 * dt);
    if (a.wobble > 0) a.wobble = Math.max(0, a.wobble - dt);
    if (a.flashTimer > 0) {
      a.flashTimer -= dt;
      a.wrapEl.classList.add('hit-flash');
    } else {
      a.wrapEl.classList.remove('hit-flash');
    }

    const sy = 1 - Math.sin((a.wobble / 0.22) * Math.PI) * 0.15 + Math.sin(this.clockSec * 2.4 + phaseSeed) * 0.018;
    const sx = 1 / Math.sqrt(Math.max(0.7, sy));
    const bobY = Math.sin(this.clockSec * 2.4 + phaseSeed * 1.3) * 5;

    const w = window.innerWidth;
    const h = window.innerHeight;
    const x = (a.xPct / 100) * w + a.lungePx;
    const y = (a.yPct / 100) * h + bobY;

    a.wrapEl.style.left = `${x.toFixed(1)}px`;
    a.wrapEl.style.top = `${y.toFixed(1)}px`;
    a.wrapEl.style.transform = `translate(-50%, -100%) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;

    const imgH = a.imgEl.offsetHeight || 260;
    a.plateEl.style.left = `${x.toFixed(1)}px`;
    a.plateEl.style.top = `${(y - imgH - 8).toFixed(1)}px`;
  }

  private drawGroundBaguaArray(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    rx: number,
    color: string,
    rot: number
  ): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 0.34); // Perspective foreshortening onto stone floor!
    ctx.rotate(rot);
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.lineWidth = 2.4;

    // Outer octagon
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const px = Math.cos(a) * rx;
      const py = Math.sin(a) * rx;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();

    // Inner rune ring
    ctx.beginPath();
    ctx.arc(0, 0, rx * 0.72, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawProtectiveBaguaHalo(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number
  ): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.clockSec * 0.9);
    ctx.strokeStyle = 'rgba(94, 234, 212, 0.52)';
    ctx.shadowColor = '#2dd4bf';
    ctx.shadowBlur = 18;
    ctx.lineWidth = 2;
    ctx.setLineDash([18, 10]);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.rotate(-this.clockSec * 1.8);
    ctx.strokeStyle = 'rgba(253, 230, 138, 0.42)';
    ctx.setLineDash([8, 14]);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.86, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawIllustratedJian(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    angle: number,
    el: SwordElement,
    scale: number
  ): void {
    const col = SWORD_ELEMENTS[el].cssColor;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale, scale);

    // Outer Sword-Qi Aura
    ctx.shadowColor = col;
    ctx.shadowBlur = 16;

    // Blade (Pointing Up -Y)
    const grad = ctx.createLinearGradient(0, -48, 0, 12);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.45, col);
    grad.addColorStop(1, '#1e293b');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, -52);
    ctx.lineTo(6.5, -12);
    ctx.lineTo(4.5, 12);
    ctx.lineTo(-4.5, 12);
    ctx.lineTo(-6.5, -12);
    ctx.closePath();
    ctx.fill();

    // Central Fuller Gold Line
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(0, -44);
    ctx.lineTo(0, 10);
    ctx.stroke();

    // Ornate Gilded Lotus Guard
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.moveTo(-14, 10);
    ctx.lineTo(0, 16);
    ctx.lineTo(14, 10);
    ctx.lineTo(9, 15);
    ctx.lineTo(0, 12);
    ctx.lineTo(-9, 15);
    ctx.closePath();
    ctx.fill();

    // Hilt & Flowing Silk Tassel
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-2.5, 15, 5, 13);
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 29);
    ctx.quadraticCurveTo(Math.sin(this.clockSec * 7 + x) * 10, 38, Math.cos(this.clockSec * 5) * 8, 46);
    ctx.stroke();

    ctx.restore();
  }

  private renderForegroundVfx(dt: number): void {
    const ctx = this.fxCtx;
    const bCtx = this.backCtx;

    // 0. Hero Dash Golden-Jade Afterimage Ghosts (on backCtx behind standees!)
    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      const g = this.ghosts[i];
      g.age += dt;
      const u = Math.min(1, g.age / g.dur);
      if (g.img.complete && g.img.naturalWidth > 0) {
        const aspect = g.img.naturalWidth / g.img.naturalHeight;
        const gh = g.h * (1 + u * 0.06);
        const gw = gh * aspect;
        bCtx.save();
        bCtx.globalAlpha = (1 - u) * 0.42;
        bCtx.filter = 'sepia(1) hue-rotate(115deg) saturate(2.5) brightness(1.35)';
        bCtx.drawImage(g.img, g.x - gw * 0.5 - u * 18, g.y - gh, gw, gh);
        bCtx.restore();
      }
      if (u >= 1) this.ghosts.splice(i, 1);
    }

    // 1. Expanding Perspective Shockwaves & Bagua Rune Seals
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const rg = this.rings[i];
      if (rg.delay > 0) {
        rg.delay -= dt;
        continue;
      }
      rg.age += dt;
      const u = Math.min(1, rg.age / rg.dur);
      const ease = 1 - Math.pow(1 - u, 3);
      const rad = rg.r0 + (rg.r1 - rg.r0) * ease;
      const alpha = Math.pow(1 - u, 1.35);

      ctx.save();
      ctx.translate(rg.x, rg.y);
      ctx.scale(1, rg.scaleY);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alpha * 0.85;
      ctx.strokeStyle = rg.color;
      ctx.shadowColor = rg.color;
      ctx.shadowBlur = 18;
      ctx.lineWidth = Math.max(1.2, (1 - u) * 6.5);
      ctx.beginPath();
      ctx.arc(0, 0, rad, 0, Math.PI * 2);
      ctx.stroke();

      if (rg.bagua) {
        ctx.rotate(u * 1.2);
        ctx.strokeStyle = '#fffbeb';
        ctx.lineWidth = Math.max(1, (1 - u) * 2.5);
        ctx.beginPath();
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          const px = Math.cos(a) * rad * 0.78;
          const py = Math.sin(a) * rad * 0.78;
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
      ctx.restore();

      if (u >= 1) this.rings.splice(i, 1);
    }

    // 2. Five-Element Heaven-Splitting Formation Pillars
    for (let i = this.pillars.length - 1; i >= 0; i--) {
      const p = this.pillars[i];
      p.age += dt;
      const u = Math.min(1, p.age / p.dur);
      const alpha = Math.pow(1 - u, 1.2);
      const pw = (1 - u * 0.58) * 104;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alpha;
      const g = ctx.createLinearGradient(p.x - pw, 0, p.x + pw, 0);
      g.addColorStop(0, 'transparent');
      g.addColorStop(0.28, p.color);
      g.addColorStop(0.5, '#ffffff');
      g.addColorStop(0.72, p.color);
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.fillRect(p.x - pw, 0, pw * 2, p.y);
      ctx.restore();
      if (u >= 1) this.pillars.splice(i, 1);
    }

    // 3. Heavenly Purple-Gold Lightning Bolts (九天紫霄落雷)
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      if (b.delay > 0) {
        b.delay -= dt;
        continue;
      }
      b.age += dt;
      const u = Math.min(1, b.age / b.dur);
      const alpha = Math.pow(1 - u, 1.4);

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'bevel';

      b.chains.forEach((chain, cIdx) => {
        const wMul = cIdx === 0 ? 1 : 0.48;
        // Outer violet-gold plasma halo
        ctx.globalAlpha = alpha * 0.9;
        ctx.strokeStyle = b.color;
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 24;
        ctx.lineWidth = 11 * wMul * (1 - u * 0.65);
        ctx.beginPath();
        chain.forEach((pt, k) => (k === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
        ctx.stroke();

        // Blazing white-hot lightning core
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3.2 * wMul * (1 - u * 0.5);
        ctx.stroke();
      });

      // Strike flash orb
      const flashR = 56 * (1 - u);
      const fg = ctx.createRadialGradient(b.hitX, b.hitY, 0, b.hitX, b.hitY, flashR);
      fg.addColorStop(0, '#ffffff');
      fg.addColorStop(0.4, b.color);
      fg.addColorStop(1, 'transparent');
      ctx.globalAlpha = alpha * 0.85;
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.arc(b.hitX, b.hitY, flashR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      if (u >= 1) this.bolts.splice(i, 1);
    }

    // 4. Sub-Stepped Elemental Flying Swords + Tapered Silk Sword-Qi Ribbons
    for (let i = this.streaks.length - 1; i >= 0; i--) {
      const s = this.streaks[i];
      if (s.delay > 0) {
        s.delay -= dt;
        continue;
      }
      s.age += dt;
      const uRaw = Math.min(1, s.age / s.dur);
      const uPos = 0.32 * uRaw + 0.68 * uRaw * uRaw; // Accelerating sword lunge!
      const uTail = Math.max(0, uPos - 0.46);
      const steps = 16;

      const evalBez = (t: number) => {
        const inv = 1 - t;
        const x = inv * inv * s.x0 + 2 * inv * t * s.cx + t * t * s.x1;
        const y = inv * inv * s.y0 + 2 * inv * t * s.cy + t * t * s.y1;
        const tx = 2 * inv * (s.cx - s.x0) + 2 * t * (s.x1 - s.cx);
        const ty = 2 * inv * (s.cy - s.y0) + 2 * t * (s.y1 - s.cy);
        const len = Math.hypot(tx, ty) || 1;
        return { x, y, nx: -ty / len, ny: tx / len, ang: Math.atan2(ty, tx) + Math.PI * 0.5 };
      };

      const leftPts: { x: number; y: number }[] = [];
      const rightPts: { x: number; y: number }[] = [];
      const coreLeft: { x: number; y: number }[] = [];
      const coreRight: { x: number; y: number }[] = [];
      const maxHalfW = (s.heavy ? 13 : 9) * s.scale;

      for (let k = 0; k <= steps; k++) {
        const frac = k / steps;
        const t = uTail + (uPos - uTail) * frac;
        const p = evalBez(t);
        const hw = maxHalfW * Math.pow(frac, 1.45);
        leftPts.push({ x: p.x + p.nx * hw, y: p.y + p.ny * hw });
        rightPts.push({ x: p.x - p.nx * hw, y: p.y - p.ny * hw });
        coreLeft.push({ x: p.x + p.nx * hw * 0.38, y: p.y + p.ny * hw * 0.38 });
        coreRight.push({ x: p.x - p.nx * hw * 0.38, y: p.y - p.ny * hw * 0.38 });
      }

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = s.color;
      ctx.shadowColor = s.color;
      ctx.shadowBlur = 20;
      ctx.globalAlpha = 0.82;
      ctx.beginPath();
      leftPts.forEach((pt, idx) => (idx === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
      for (let idx = rightPts.length - 1; idx >= 0; idx--) {
        ctx.lineTo(rightPts[idx].x, rightPts[idx].y);
      }
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#fffbeb';
      ctx.globalAlpha = 0.92;
      ctx.beginPath();
      coreLeft.forEach((pt, idx) => (idx === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
      for (let idx = coreRight.length - 1; idx >= 0; idx--) {
        ctx.lineTo(coreRight[idx].x, coreRight[idx].y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      const head = evalBez(uPos);
      this.drawIllustratedJian(ctx, head.x, head.y, head.ang, s.element, s.scale);

      if (uRaw >= 1) {
        this.spawnImpactBurst(s.x1, s.y1, s.color, s.element, s.heavy, 0);
        this.streaks.splice(i, 1);
      }
    }

    // 5. Dual-Tapered Calligraphic Ink-and-Gold Crescent Sword-Qi & Demon Claws
    for (let i = this.slashes.length - 1; i >= 0; i--) {
      const sl = this.slashes[i];
      if (sl.delay > 0) {
        sl.delay -= dt;
        continue;
      }
      sl.age += dt;
      const u = Math.min(1, sl.age / sl.dur);
      const alpha = Math.pow(1 - u, 1.15);
      const whip = 1 - Math.pow(1 - Math.min(1, u / 0.34), 3);
      const aStart = -sl.sweepRad;
      const aEnd = -sl.sweepRad + sl.sweepRad * 2 * whip;
      const curR = sl.radius * (0.82 + 0.28 * (1 - Math.pow(1 - u, 2)));
      const curThick = sl.thickness * (1 - Math.pow(u, 1.55));
      const segs = 24;

      const fillCrescent = (radOffset: number, thickMul: number) => {
        ctx.beginPath();
        for (let k = 0; k <= segs; k++) {
          const s = k / segs;
          const a = aStart + (aEnd - aStart) * s;
          const rOut = curR + radOffset;
          const px = Math.cos(a) * rOut;
          const py = Math.sin(a) * rOut;
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        for (let k = segs; k >= 0; k--) {
          const s = k / segs;
          const a = aStart + (aEnd - aStart) * s;
          const profile = Math.pow(Math.sin(s * Math.PI), 1.35);
          const jag = sl.claw ? Math.sin(k * 3.7) * 5 * profile : 0;
          const rIn = curR + radOffset - curThick * thickMul * profile + jag;
          ctx.lineTo(Math.cos(a) * rIn, Math.sin(a) * rIn);
        }
        ctx.closePath();
        ctx.fill();
      };

      ctx.save();
      ctx.translate(sl.x, sl.y);
      ctx.rotate(sl.angle);

      // Layer A: Dark Xuan-Paper Ink-Wash Contrast Backing & Flying Ink Droplets!
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = alpha * 0.72;
      ctx.fillStyle = '#050711';
      fillCrescent(5, 1.38);

      for (const d of sl.inkDrops) {
        const dr = d.dist + u * 26;
        ctx.beginPath();
        ctx.arc(Math.cos(d.ang) * dr, Math.sin(d.ang) * dr, d.r * (1 - u), 0, Math.PI * 2);
        ctx.fill();
      }

      // Layer B: Blazing Additive Elemental Sword-Qi Halo
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alpha * 0.95;
      ctx.fillStyle = sl.color;
      ctx.shadowColor = sl.color;
      ctx.shadowBlur = 26;
      fillCrescent(0, 1.0);

      // Layer C: White-Hot Forged Blade Edge Core
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#fffef2';
      fillCrescent(-1, 0.44);

      ctx.restore();

      if (u >= 1) this.slashes.splice(i, 1);
    }

    // 6. 4-Pointed Sword-Tip Cross-Star Glints (十字寒芒星闪)
    for (let i = this.flares.length - 1; i >= 0; i--) {
      const fl = this.flares[i];
      if (fl.delay > 0) {
        fl.delay -= dt;
        continue;
      }
      fl.age += dt;
      const u = Math.min(1, fl.age / fl.dur);
      const scale = (1 - u * 0.5) * Math.sin(Math.min(1, u * 3.2) * (Math.PI * 0.5));
      const longR = fl.size * scale;
      const shortR = Math.max(2.5, fl.size * 0.085 * scale);

      ctx.save();
      ctx.translate(fl.x, fl.y);
      ctx.rotate(fl.angle);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1 - u;
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = fl.color;
      ctx.shadowBlur = 22;

      for (let arm = 0; arm < 2; arm++) {
        ctx.beginPath();
        ctx.moveTo(-longR, 0);
        ctx.quadraticCurveTo(0, -shortR, longR, 0);
        ctx.quadraticCurveTo(0, shortR, -longR, 0);
        ctx.closePath();
        ctx.fill();
        ctx.rotate(Math.PI * 0.5);
      }
      ctx.restore();

      if (u >= 1) this.flares.splice(i, 1);
    }

    // 7. Tamahagane Forged-Sword Sparks, Lotus Fire Embers & Frost Shards
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const sp = this.sparks[i];
      if (sp.delay > 0) {
        sp.delay -= dt;
        continue;
      }
      sp.age += dt;
      const u = Math.min(1, sp.age / sp.dur);

      if (sp.kind === 'spark') {
        sp.vx *= Math.exp(-4.2 * dt);
        sp.vy = sp.vy * Math.exp(-3.0 * dt) + 420 * dt;
      } else if (sp.kind === 'ember') {
        sp.vx += Math.sin(this.clockSec * 14 + sp.y * 0.05) * 180 * dt;
        sp.vy -= 140 * dt;
      } else {
        sp.vx *= Math.exp(-3.5 * dt);
        sp.vy *= Math.exp(-3.5 * dt);
      }
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1 - u;
      ctx.strokeStyle = sp.color;
      ctx.fillStyle = sp.color;
      ctx.shadowColor = sp.color;
      ctx.shadowBlur = 10;

      if (sp.kind === 'spark') {
        ctx.lineWidth = Math.max(1, sp.size * (1 - u * 0.6));
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(sp.x - sp.vx * 0.036, sp.y - sp.vy * 0.036);
        ctx.lineTo(sp.x, sp.y);
        ctx.stroke();
      } else if (sp.kind === 'shard') {
        ctx.translate(sp.x, sp.y);
        ctx.rotate(sp.age * 9);
        const r = sp.size * 1.6 * (1 - u * 0.5);
        ctx.beginPath();
        ctx.moveTo(0, -r);
        ctx.lineTo(r * 0.55, 0);
        ctx.lineTo(0, r);
        ctx.lineTo(-r * 0.55, 0);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, sp.size * (1 - u * 0.65), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      if (u >= 1) this.sparks.splice(i, 1);
    }

    // 8. Luminous Bezier Targeting Curve on Hovered Single-Target Card
    if (
      this.engine.runPhase === 'combat' &&
      this.hoveredCardEl &&
      this.hoveredSingleTarget &&
      this.enemyStandees[this.engine.selectedTargetIdx]
    ) {
      const rect = this.hoveredCardEl.getBoundingClientRect();
      const sx = rect.left + rect.width * 0.5;
      const sy = rect.top + 12;
      const dst = this.actorScreenCenter(this.enemyStandees[this.engine.selectedTargetIdx]);

      ctx.save();
      ctx.strokeStyle = '#fde68a';
      ctx.lineWidth = 3.5;
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 14;
      ctx.setLineDash([12, 8]);
      ctx.lineDashOffset = -this.clockSec * 95;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo((sx + dst.x) * 0.5, Math.min(sy, dst.y) - 110, dst.x, dst.y);
      ctx.stroke();

      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(dst.x, dst.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 9. Calligraphic Brush Damage / Block Popups with Spring Scale Overshoot
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const ft = this.popups[i];
      ft.age += dt;
      ft.vy += 185 * dt;
      ft.x += ft.vx * dt;
      ft.y += ft.vy * dt;
      const u = Math.min(1, ft.age / ft.dur);
      const alpha = Math.max(0, 1 - Math.pow(u, 1.6));
      const popScale =
        u < 0.16 ? 0.65 + (u / 0.16) * (ft.big ? 0.75 : 0.45) : 1 + Math.max(0, 0.34 - u) * (ft.big ? 1.1 : 0.4);

      ctx.save();
      ctx.translate(ft.x, ft.y);
      ctx.scale(popScale, popScale);
      ctx.globalAlpha = alpha;
      ctx.font = ft.big
        ? `400 34px "Ma Shan Zheng", "STKaiti", "KaiTi", serif`
        : `900 20px "Noto Serif SC", "Songti SC", serif`;
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#050711';
      ctx.lineWidth = ft.big ? 6 : 4.5;
      ctx.strokeText(ft.text, 0, 0);
      ctx.fillStyle = ft.color;
      ctx.shadowColor = ft.color;
      ctx.shadowBlur = ft.big ? 14 : 6;
      ctx.fillText(ft.text, 0, 0);
      ctx.restore();
      if (ft.age >= ft.dur) this.popups.splice(i, 1);
    }
  }

  private onResize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.backCanvas.width = w;
    this.backCanvas.height = h;
    this.fxCanvas.width = w;
    this.fxCanvas.height = h;
  }
}

const app = new SwordSpireIllustratedApp();
Object.assign(window, { app });
