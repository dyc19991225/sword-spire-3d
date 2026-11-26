import './style.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import {
  CARDS,
  HEROES,
  RELICS,
  SWORD_ELEMENTS,
  type HeroId,
} from './cards.ts';
import {
  SwordSpireEngine,
  type CardInstance,
  type EnemyInstance,
  type MapNode,
} from './engine.ts';
import { XianxiaAudio } from './audio.ts';

interface SwordProjectile3D {
  mesh: THREE.Mesh;
  start: THREE.Vector3;
  ctrl: THREE.Vector3;
  end: THREE.Vector3;
  age: number;
  dur: number;
  colorHex: number;
}

interface ShockRing3D {
  mesh: THREE.Mesh;
  age: number;
  dur: number;
  maxScale: number;
}

interface SkyPillar3D {
  mesh: THREE.Mesh;
  age: number;
  dur: number;
}

interface FloatingText2D {
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

interface EnemyActor3D {
  uid: number;
  group: THREE.Group;
  mesh: THREE.Mesh;
  baseX: number;
  baseZ: number;
  lungeX: number;
  wobble: number;
  flash: number;
  plateEl: HTMLDivElement;
}

class SwordSpireApp {
  public renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  private composer: EffectComposer;
  private timer = new THREE.Timer();
  private loader = new GLTFLoader();
  private raycaster = new THREE.Raycaster();
  private pointerNdc = new THREE.Vector2();

  public engine = new SwordSpireEngine();
  private audio = new XianxiaAudio();
  private fxCanvas: HTMLCanvasElement;
  private fxCtx: CanvasRenderingContext2D;

  private modelsLoaded = false;
  private modelTemplates: Record<string, THREE.BufferGeometry> = {};
  private selectedHeroIdx = 0;

  // 3D Scene Nodes
  private arenaMesh!: THREE.Mesh;
  private heroGroup = new THREE.Group();
  private heroMesh!: THREE.Mesh;
  private heroShieldMesh!: THREE.Mesh;
  private heroPlateEl!: HTMLDivElement;
  private heroLungeX = 0;
  private heroWobble = 0;
  private orbitSwords: THREE.Mesh[] = [];
  private targetRing!: THREE.Mesh;
  private qiParticles!: THREE.Points;

  private enemyActors: EnemyActor3D[] = [];
  private activeProjectiles: SwordProjectile3D[] = [];
  private activeRings: ShockRing3D[] = [];
  private activePillars: SkyPillar3D[] = [];
  private floatTexts: FloatingText2D[] = [];

  // Camera Trauma & Hover Targeting Curve
  private trauma = 0;
  private clockSec = 0;
  private toastTimer = 0;
  private hoveredCardEl: HTMLElement | null = null;
  private hoveredSingleTarget = false;
  private tmpVec = new THREE.Vector3();

  constructor() {
    const canvas = document.getElementById('arena-canvas') as HTMLCanvasElement;
    this.fxCanvas = document.getElementById('fx-canvas') as HTMLCanvasElement;
    this.fxCtx = this.fxCanvas.getContext('2d')!;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060913);
    this.scene.fog = new THREE.FogExp2(0x060913, 0.036);

    this.camera = new THREE.PerspectiveCamera(
      44,
      window.innerWidth / window.innerHeight,
      0.2,
      80
    );
    this.camera.position.set(0, 3.9, 9.2);
    this.camera.lookAt(0.2, 1.35, 0);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(
      new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.38,
        0.32,
        0.76
      )
    );
    this.composer.addPass(new OutputPass());

    this.setupLightingAndStage();
    this.bindUiEvents();
    this.renderTitleHeroes();
    this.onResize();
    this.load3dAssets();

    this.timer.connect(document);
    this.renderer.setAnimationLoop(() => this.tick());
  }

  private setupLightingAndStage(): void {
    const hemi = new THREE.HemisphereLight(0x99f6e4, 0x1e1b4b, 1.55);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfffbeb, 2.5);
    sun.position.set(-4, 11, 7);
    this.scene.add(sun);

    const rim = new THREE.PointLight(0x2dd4bf, 8, 18);
    rim.position.set(0, 3.2, -4.5);
    this.scene.add(rim);

    // Fallback Arena Platform before GLB arrives
    this.arenaMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(7.2, 5.8, 0.7, 8),
      new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.35,
        metalness: 0.65,
      })
    );
    this.arenaMesh.position.y = -0.35;
    this.scene.add(this.arenaMesh);

    // Hero Group at Left (-2.75, 0, 0.2)
    this.heroGroup.position.set(-2.75, 0, 0.2);
    this.heroMesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.45, 1.8, 8),
      new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.3, metalness: 0.6 })
    );
    this.heroMesh.rotation.y = Math.PI / 2;
    this.heroGroup.add(this.heroMesh);

    // Hero Protective Bagua Jade Shield Dome
    this.heroShieldMesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.18, 1),
      new THREE.MeshBasicMaterial({
        color: 0x2dd4bf,
        wireframe: true,
        transparent: true,
        opacity: 0.42,
        blending: THREE.AdditiveBlending,
      })
    );
    this.heroShieldMesh.position.y = 1.05;
    this.heroShieldMesh.visible = false;
    this.heroGroup.add(this.heroShieldMesh);

    // 8 Orbiting Flying Sword Meshes in the Floating Sword Box
    const fallbackSwordGeo = new THREE.ConeGeometry(0.08, 1.05, 4);
    for (let i = 0; i < 8; i++) {
      const sm = new THREE.Mesh(
        fallbackSwordGeo,
        new THREE.MeshStandardMaterial({
          color: 0xfbbf24,
          emissive: 0xfbbf24,
          emissiveIntensity: 0.55,
          roughness: 0.2,
          metalness: 0.85,
        })
      );
      sm.visible = false;
      this.scene.add(sm);
      this.orbitSwords.push(sm);
    }
    this.scene.add(this.heroGroup);

    // Selected Enemy Lock-on Golden Reticle
    const ringGeo = new THREE.RingGeometry(0.78, 0.96, 8);
    ringGeo.rotateX(-Math.PI / 2);
    this.targetRing = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        transparent: true,
        opacity: 0.88,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      })
    );
    this.targetRing.position.y = 0.05;
    this.targetRing.visible = false;
    this.scene.add(this.targetRing);

    // Floating Immortal Qi Spirit Motes
    const pCount = 180;
    const pos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 18;
      pos[i * 3 + 1] = Math.random() * 7 - 0.5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 12 - 1;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.qiParticles = new THREE.Points(
      pGeo,
      new THREE.PointsMaterial({
        color: 0x5eead4,
        size: 0.08,
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending,
      })
    );
    this.scene.add(this.qiParticles);

    // Hero Overhead DOM Plate
    this.heroPlateEl = document.createElement('div');
    this.heroPlateEl.className = 'actor-plate hero-plate';
    document.getElementById('actor-overlays')!.appendChild(this.heroPlateEl);
  }

  private async load3dAssets(): Promise<void> {
    try {
      const gltf = await this.loader.loadAsync('./models/xianxia_arena.glb');
      gltf.scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          this.modelTemplates[m.name] = m.geometry.clone();
        }
      });

      if (this.modelTemplates.Arena_Platform) {
        this.arenaMesh.geometry.dispose();
        this.arenaMesh.geometry = this.modelTemplates.Arena_Platform;
        this.arenaMesh.position.set(0, 0, 0);
        this.arenaMesh.material = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          vertexColors: true,
          roughness: 0.34,
          metalness: 0.62,
        });
      }

      if (this.modelTemplates.Hero_Cultivator) {
        this.heroMesh.geometry.dispose();
        this.heroMesh.geometry = this.modelTemplates.Hero_Cultivator;
        this.heroMesh.material = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          vertexColors: true,
          roughness: 0.3,
          metalness: 0.62,
        });
        this.heroMesh.rotation.y = Math.PI / 2;
      }

      if (this.modelTemplates.Flying_Jian) {
        for (const sm of this.orbitSwords) {
          sm.geometry = this.modelTemplates.Flying_Jian;
        }
      }

      this.modelsLoaded = true;
      if (this.engine.runPhase === 'combat') {
        this.rebuildEnemy3dActors();
      }
    } catch (err) {
      console.error('Failed to load xianxia_arena.glb:', err);
    }
  }

  // =========================================================================
  // Sync 3D Enemy Meshes, Visual Event Choreography & UI Screens
  // =========================================================================
  private rebuildEnemy3dActors(): void {
    for (const a of this.enemyActors) {
      this.scene.remove(a.group);
      a.plateEl.remove();
    }
    this.enemyActors = [];

    const count = this.engine.enemies.length;
    const overlays = document.getElementById('actor-overlays')!;

    this.engine.enemies.forEach((e, idx) => {
      const grp = new THREE.Group();
      const slotX = count === 1 ? 2.65 : count === 2 ? 1.85 + idx * 1.85 : 1.35 + idx * 1.48;
      const slotZ = count === 1 ? 0.2 : idx % 2 === 0 ? 0.55 : -0.45;
      grp.position.set(slotX, 0, slotZ);

      const geo =
        this.modelTemplates[e.modelName] || new THREE.BoxGeometry(0.9, 1.8, 0.9);
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        vertexColors: !!this.modelTemplates[e.modelName],
        roughness: 0.3,
        metalness: 0.65,
        emissive: new THREE.Color(e.tintHex),
        emissiveIntensity: e.isBoss ? 0.22 : 0.1,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.y = -Math.PI / 2; // Face Left (-X) toward Hero!
      mesh.scale.setScalar(e.scale);
      mesh.userData.enemyIdx = idx;
      grp.add(mesh);
      this.scene.add(grp);

      const plate = document.createElement('div');
      plate.className = 'actor-plate enemy-plate';
      plate.addEventListener('click', () => {
        if (this.engine.enemies[idx]?.hp > 0) {
          this.audio.playCardHover();
          this.engine.selectedTargetIdx = idx;
          this.refreshCombatHud();
        }
      });
      overlays.appendChild(plate);

      this.enemyActors.push({
        uid: e.uid,
        group: grp,
        mesh,
        baseX: slotX,
        baseZ: slotZ,
        lungeX: 0,
        wobble: 0,
        flash: 0,
        plateEl: plate,
      });
    });
  }

  private processEngineVisualEvents(): void {
    const events = this.engine.drainVisualEvents();
    for (const ev of events) {
      if (ev.kind === 'hero_slash') {
        this.heroLungeX = 0.72;
        this.audio.playSwordSlash(ev.heavy);
        const actor = this.enemyActors[ev.targetIdx];
        if (actor) {
          this.spawnFlyingSwordArc(
            new THREE.Vector3(-2.3, 1.55, 0.2),
            new THREE.Vector3(actor.baseX, 1.2, actor.baseZ),
            ev.colorHex,
            0.22
          );
        }
      } else if (ev.kind === 'hero_cast') {
        this.heroWobble = 0.16;
        this.spawnShockRing(-2.75, 0.2, 2.2, ev.colorHex, 0.35);
      } else if (ev.kind === 'sword_fly') {
        this.audio.playElementalSword(ev.element, ev.isEvoke);
        const col = SWORD_ELEMENTS[ev.element].colorHex;
        const actor = this.enemyActors[ev.targetIdx] || this.enemyActors[0];
        if (ev.element === 'ice' || ev.element === 'wood') {
          this.spawnShockRing(-2.75, 0.2, 2.5, col, 0.38);
        } else if (actor) {
          this.spawnFlyingSwordArc(
            new THREE.Vector3(-2.75, 2.25, 0.2),
            new THREE.Vector3(actor.baseX, 1.25, actor.baseZ),
            col,
            ev.isEvoke ? 0.20 : 0.26
          );
        }
      } else if (ev.kind === 'formation') {
        this.audio.playFormationAwaken();
        this.trauma = Math.min(1, this.trauma + 0.55);
        this.spawnSkyPillar(2.4, 0.1, ev.colorHex);
        this.spawnShockRing(2.4, 0.1, 4.8, ev.colorHex, 0.55);
        this.showToast(`${ev.name} · 五行共鸣剑威爆发！`);
      } else if (ev.kind === 'damage_enemy') {
        const actor = this.enemyActors[ev.targetIdx];
        if (actor) {
          actor.wobble = 0.2;
          actor.flash = 0.1;
          this.trauma = Math.min(1, this.trauma + (ev.amount >= 12 ? 0.36 : 0.18));
          this.spawnShockRing(actor.baseX, actor.baseZ, 1.8, ev.colorHex, 0.26);
          const scr = this.worldToScreen(actor.baseX, 2.1, actor.baseZ);
          if (ev.amount > 0) {
            this.spawnFloatText(scr.x, scr.y, `-${ev.amount}`, '#fef08a', ev.amount >= 12);
          } else if (ev.blocked > 0) {
            this.spawnFloatText(scr.x, scr.y, `格挡 ${ev.blocked}`, '#93c5fd', false);
          }
        }
      } else if (ev.kind === 'damage_hero') {
        this.heroWobble = 0.2;
        if (ev.amount > 0) {
          this.audio.playEnemyHitHero();
          this.trauma = Math.min(1, this.trauma + 0.42);
        } else {
          this.audio.playJadeShield();
        }
        const scr = this.worldToScreen(-2.75, 2.1, 0.2);
        if (ev.amount > 0) {
          this.spawnFloatText(scr.x, scr.y, `-${ev.amount}`, '#fb7185', true);
        } else if (ev.blocked > 0) {
          this.spawnFloatText(scr.x, scr.y, `罡气抵御 ${ev.blocked}`, '#5eead4', false);
        }
      } else if (ev.kind === 'block_hero') {
        this.audio.playJadeShield();
        const scr = this.worldToScreen(-2.75, 2.2, 0.2);
        this.spawnFloatText(scr.x, scr.y, `+${ev.amount} 罡气`, '#38bdf8', false);
      } else if (ev.kind === 'heal_hero') {
        const scr = this.worldToScreen(-2.75, 2.2, 0.2);
        this.spawnFloatText(scr.x, scr.y, `+${ev.amount} 气血`, '#4ade80', false);
      } else if (ev.kind === 'enemy_act') {
        const actor = this.enemyActors[ev.enemyIdx];
        if (actor) {
          actor.lungeX = ev.attack ? -0.85 : -0.25;
        }
      } else if (ev.kind === 'toast') {
        this.showToast(ev.text);
      }
    }
  }

  private spawnFlyingSwordArc(
    start: THREE.Vector3,
    end: THREE.Vector3,
    colorHex: number,
    dur: number
  ): void {
    const geo = this.modelTemplates.Flying_Jian || new THREE.ConeGeometry(0.08, 1.0, 4);
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ color: colorHex })
    );
    mesh.position.copy(start);
    this.scene.add(mesh);
    const ctrl = start
      .clone()
      .lerp(end, 0.5)
      .add(new THREE.Vector3(0, 1.6 + Math.random() * 0.9, (Math.random() - 0.5) * 1.4));
    this.activeProjectiles.push({ mesh, start, ctrl, end, age: 0, dur, colorHex });
  }

  private spawnShockRing(
    x: number,
    z: number,
    maxScale: number,
    colorHex: number,
    dur: number
  ): void {
    const geo = new THREE.RingGeometry(0.75, 1.0, 28);
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    mesh.position.set(x, 0.08, z);
    mesh.scale.setScalar(0.2);
    this.scene.add(mesh);
    this.activeRings.push({ mesh, age: 0, dur, maxScale });
  }

  private spawnSkyPillar(x: number, z: number, colorHex: number): void {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.65, 1.1, 12, 14, 1, true),
      new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.72,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    mesh.position.set(x, 6, z);
    this.scene.add(mesh);
    this.activePillars.push({ mesh, age: 0, dur: 0.52 });
  }

  private spawnFloatText(
    x: number,
    y: number,
    text: string,
    color: string,
    big: boolean
  ): void {
    this.floatTexts.push({
      x: x + (Math.random() - 0.5) * 26,
      y,
      vx: (Math.random() - 0.5) * 32,
      vy: -88,
      text,
      color,
      age: 0,
      dur: 0.85,
      big,
    });
  }

  private worldToScreen(wx: number, wy: number, wz: number): { x: number; y: number } {
    this.tmpVec.set(wx, wy, wz).project(this.camera);
    return {
      x: (this.tmpVec.x * 0.5 + 0.5) * window.innerWidth,
      y: (-this.tmpVec.y * 0.5 + 0.5) * window.innerHeight,
    };
  }

  // =========================================================================
  // UI Screen Sync & Holographic Card Rendering
  // =========================================================================
  private syncAllUi(): void {
    const ph = this.engine.runPhase;
    document.getElementById('top-bar')!.classList.toggle('hidden', ph === 'title');
    document.getElementById('combat-ui')!.classList.toggle('hidden', ph !== 'combat');
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
    }
    if (ph === 'map') {
      this.renderSpireMap();
    } else if (ph === 'combat') {
      this.refreshCombatHud();
    } else if (ph === 'reward') {
      this.renderRewardScreen();
    } else if (ph === 'rest') {
      this.renderRestScreen();
    } else if (ph === 'shop') {
      this.renderShopScreen();
    } else if (ph === 'event') {
      this.renderEventScreen();
    } else if (ph === 'victory' || ph === 'gameover') {
      this.renderResultScreen(ph === 'victory');
    }
  }

  private refreshTopBar(): void {
    document.getElementById('top-hero-name')!.textContent = this.engine.hero.name;
    const fl = Math.max(1, this.engine.currentRow + 1);
    const realmNames = ['第一重天·锁妖殿', '第二重天·幽冥冢', '第三重天·九霄坛'];
    const rIdx = Math.min(2, Math.floor(Math.max(0, this.engine.currentRow) / 5));
    document.getElementById('top-floor-badge')!.textContent = `${realmNames[rIdx]} · ${fl}/15 劫`;
    document.getElementById('top-hp')!.textContent = `❤️ ${this.engine.hp}/${this.engine.maxHp}`;
    document.getElementById('top-gold')!.textContent = `💰 ${this.engine.gold} 灵石`;
    document.getElementById('deck-count')!.textContent = String(this.engine.masterDeck.length);

    const strip = document.getElementById('relic-strip')!;
    strip.innerHTML = this.engine.relics
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
    const grid = document.getElementById('hero-grid')!;
    grid.innerHTML = HEROES.map((h, idx) => {
      const rel = RELICS[h.starterRelic];
      return `<div class="hero-card ${idx === this.selectedHeroIdx ? 'selected' : ''}" data-idx="${idx}">
        <div class="hero-top">
          <img src="${h.portrait}" alt="${h.name}" />
          <div>
            <div class="hero-name">${h.name}</div>
            <div class="hero-sub">${h.title} · ❤️ ${h.maxHp}</div>
          </div>
        </div>
        <div class="hero-desc">${h.desc}</div>
        <div class="hero-relic">🔮 本命法宝【${rel.name}】：${rel.desc}</div>
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

    const posOf = (n: MapNode) => {
      const xPct = n.kind === 'boss' ? 50 : 22 + n.col * 28;
      const y = totalH - 42 - n.row * rowH; // Bottom-to-top ascension!
      return { xPct, y };
    };

    const nodeLookup = new Map<string, MapNode>();
    for (const row of this.engine.mapRows) {
      for (const n of row) nodeLookup.set(n.id, n);
    }

    // Draw connecting SVG lines
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

    const labelMap: Record<MapNode['kind'], string> = {
      battle: '⚔️ 群妖',
      elite: '👹 凶煞妖王',
      rest: '🔥 洞府丹炉',
      shop: '🏮 云游仙坊',
      event: '☯️ 秘境奇遇',
      boss: '☠️ 镇界魔尊',
    };

    nodesWrap.innerHTML = this.engine.mapRows
      .flat()
      .map((n) => {
        const p = posOf(n);
        const avail = selectable.has(n.id);
        return `<button class="map-node ${n.cleared ? 'cleared' : ''} ${
          avail ? 'available' : ''
        }" data-nid="${n.id}" style="left:${p.xPct}%; top:${p.y}px;">
          ${n.row + 1}劫 · ${labelMap[n.kind]}
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
            this.rebuildEnemy3dActors();
            this.processEngineVisualEvents();
          }
          this.syncAllUi();
        }
      });
    });

    // Auto-scroll to player's current ascension row
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

    // Sword Box Panel
    document.getElementById('sb-count')!.textContent =
      `${this.engine.swordBox.length}/${this.engine.maxSwordSlots}`;
    const slotsHtml: string[] = [];
    for (let i = 0; i < this.engine.maxSwordSlots; i++) {
      const el = this.engine.swordBox[i];
      if (el) {
        const sp = SWORD_ELEMENTS[el];
        slotsHtml.push(
          `<span class="sb-slot filled" style="border-color:${sp.cssColor}; background:${sp.cssColor}28" title="${sp.name}：${sp.passiveDesc} | ${sp.evokeDesc}">${sp.name}</span>`
        );
      } else {
        slotsHtml.push(`<span class="sb-slot">空剑槽</span>`);
      }
    }
    document.getElementById('sb-slots')!.innerHTML = slotsHtml.join('');

    // Render 3D Holographic Foil Hand
    const fan = document.getElementById('hand-fan')!;
    const n = this.engine.hand.length;
    fan.innerHTML = this.engine.hand
      .map((card, idx) => {
        const mid = (n - 1) * 0.5;
        const off = idx - mid;
        const rot = off * (n > 6 ? 3.0 : 4.2);
        const yOff = Math.abs(off) * Math.abs(off) * 2.4;
        const playable = this.engine.getCardCost(card) <= this.engine.qi;
        return this.renderHoloCardHtml(card, {
          playable,
          hotkey: idx < 9 ? String(idx + 1) : undefined,
          fanStyle: `--fan-rot:${rot.toFixed(1)}deg; --fan-y:${yOff.toFixed(1)}px; z-index:${10 + idx};`,
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
          this.showToast('⚠️ 灵力不足，无法催动此剑诀！');
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
      def.type === 'attack' ? '⚔️ 剑诀 · 攻' : def.type === 'skill' ? '🛡️ 身法 · 术' : '☯️ 心法 · 永续';

    // Dynamic Damage/Block Preview in Combat
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
          <span class="hc-cost">${cost}</span>
          <span class="hc-title">${title}</span>
        </div>
        ${opts.hotkey ? `<span class="hc-key">[${opts.hotkey}]</span>` : ''}
        <div class="hc-art-wrap">
          <img src="${def.art}" alt="${title}" />
        </div>
        <div class="hc-type-tag">${typeLabel}</div>
        <div class="hc-desc"><span>${desc}</span></div>
        ${opts.price !== undefined ? `<div class="price-tag">💰 ${opts.price}</div>` : ''}
      </div>`;
  }

  private attachHoloTilt(el: HTMLElement): void {
    el.addEventListener('pointermove', (ev) => {
      const r = el.getBoundingClientRect();
      const px = (ev.clientX - r.left) / Math.max(1, r.width);
      const py = (ev.clientY - r.top) / Math.max(1, r.height);
      const ry = (px - 0.5) * 22;
      const rx = (0.5 - py) * 20;
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
    // Hero Plate
    const hpPct = Math.max(0, (this.engine.hp / this.engine.maxHp) * 100);
    const hTags: string[] = [];
    if (this.engine.block > 0) hTags.push(`<span class="st-tag blk">🛡️罡气 ${this.engine.block}</span>`);
    if (this.engine.strength > 0) hTags.push(`<span class="st-tag buff">⚔️剑意 +${this.engine.strength}</span>`);
    if (this.engine.dexterity > 0) hTags.push(`<span class="st-tag buff">🍃身法 +${this.engine.dexterity}</span>`);
    if (this.engine.thorns > 0) hTags.push(`<span class="st-tag buff">⚡剑棘 ${this.engine.thorns}</span>`);
    if (this.engine.vuln > 0) hTags.push(`<span class="st-tag vuln">破绽 ${this.engine.vuln}</span>`);
    if (this.engine.weak > 0) hTags.push(`<span class="st-tag weak">虚弱 ${this.engine.weak}</span>`);

    this.heroPlateEl.innerHTML = `
      <div class="plate-box">
        <div class="plate-name">${this.engine.hero.name.split(' · ')[0]}</div>
        <div class="hp-track">
          <div class="hp-fill hero" style="width:${hpPct.toFixed(1)}%"></div>
          <span class="hp-num">${this.engine.hp} / ${this.engine.maxHp}</span>
        </div>
        <div class="status-row">${hTags.join('')}</div>
      </div>`;

    // Enemy Plates + Clear Intents
    this.enemyActors.forEach((actor, idx) => {
      const e: EnemyInstance | undefined = this.engine.enemies[idx];
      if (!e || e.hp <= 0) {
        actor.plateEl.classList.add('hidden');
        actor.group.visible = false;
        return;
      }
      actor.plateEl.classList.remove('hidden');
      actor.group.visible = true;
      actor.plateEl.classList.toggle('selected', idx === this.engine.selectedTargetIdx);

      const mv = e.intent;
      let intentIcon = '🔮';
      let intentTxt = mv.intentName;
      let pillClass = 'def';
      if (mv.dmg) {
        const realD = this.engine.previewEnemyAttackDamage(e);
        const hits = mv.hits || 1;
        intentIcon = mv.kind === 'nuke' ? '☄️' : '🗡️';
        intentTxt = hits > 1 ? `${realD}×${hits}` : `${realD}`;
        if (mv.block) intentTxt += ` + 🛡️${mv.block}`;
        pillClass = mv.kind === 'nuke' ? 'nuke' : '';
      } else if (mv.block) {
        intentIcon = '🛡️';
        intentTxt = `${mv.block}${mv.strength ? ` + 魔威+${mv.strength}` : ''}`;
      }

      const eTags: string[] = [];
      if (e.block > 0) eTags.push(`<span class="st-tag blk">🛡️${e.block}</span>`);
      if (e.burn > 0) eTags.push(`<span class="st-tag burn">🔥丹火 ${e.burn}</span>`);
      if (e.vuln > 0) eTags.push(`<span class="st-tag vuln">破绽 ${e.vuln}</span>`);
      if (e.weak > 0) eTags.push(`<span class="st-tag weak">虚弱 ${e.weak}</span>`);
      if (e.strength > 0) eTags.push(`<span class="st-tag buff">魔威 +${e.strength}</span>`);

      const ePct = Math.max(0, (e.hp / e.maxHp) * 100);
      actor.plateEl.innerHTML = `
        <div class="intent-pill ${pillClass}" title="下回合意图：${mv.intentName}">
          <span>${intentIcon}</span>
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
      <span>💰 已缴获 +${this.engine.rewardGold} 灵石</span>
      ${rel ? `<span>🔮 获得秘境法宝【${rel.name}】：${rel.desc}</span>` : ''}
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
      `立即回复 35% 最大气血 (+${healAmt} HP · 当前 ${this.engine.hp}/${this.engine.maxHp})`;

    const candidates = this.engine.masterDeck.filter((c) => !c.upgraded);
    const grid = document.getElementById('forge-grid')!;
    grid.innerHTML = candidates
      .map((c) => {
        // Preview upgraded version!
        const preview: CardInstance = { ...c, upgraded: true };
        return this.renderHoloCardHtml(preview);
      })
      .join('');

    grid.querySelectorAll('.holo-card').forEach((el) => {
      const htmlEl = el as HTMLElement;
      this.attachHoloTilt(htmlEl);
      htmlEl.addEventListener('click', () => {
        const uid = Number(htmlEl.dataset.uid);
        if (this.engine.restForgeCard(uid)) {
          this.audio.playFormationAwaken();
          this.showToast('🔥 剑炉淬炼成功！卡牌已永久升阶为【+】！');
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
              <span>${shop.relic.sold ? '已购法宝' : `购置【${rel.name}】💰${shop.relic.price}`}</span>
            </button>`
          : ''
      }
      <button id="btn-buy-heal" class="shop-svc-btn" ${
        shop.healUsed || this.engine.gold < shop.healPrice ? 'disabled' : ''
      }>
        🍵 灵丹回春 (+30%气血) 💰${shop.healPrice}
      </button>
      <button id="btn-toggle-purge" class="shop-svc-btn" ${
        shop.removeUsed || this.engine.gold < shop.removePrice || this.engine.masterDeck.length <= 5
          ? 'disabled'
          : ''
      }>
        🌊 ${shop.removeUsed ? '已洗髓删牌' : `洗髓忘尘 (删1张牌) 💰${shop.removePrice}`}
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
            this.showToast('🌊 道心澄明！已从牌库永久删去该牌！');
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
          this.showToast('💰 灵石不足！');
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
      ? 'IMMORTAL ASCENSION · 三界荡平'
      : 'SOUL SHATTERED · 兵解重修';
    document.getElementById('result-title')!.textContent = victory
      ? '✨ 剑破九霄 · 羽化登仙！'
      : '💀 道消身陨 · 剑断锁仙台';
    document.getElementById('result-stats')!.innerHTML = `
      <div>所选道统：<strong>${this.engine.hero.name}</strong></div>
      <div>抵达劫数：<strong>第 ${Math.max(1, this.engine.currentRow + 1)} / 15 劫</strong></div>
      <div>最终牌库：<strong>${this.engine.masterDeck.length} 张剑诀 (${
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

  // =========================================================================
  // Event Listeners & Keyboard Shortcuts
  // =========================================================================
  private bindUiEvents(): void {
    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('pointerdown', () => this.audio.unlock(), { passive: true });

    // Click 3D Enemy directly on Canvas via Raycaster!
    document.getElementById('arena-canvas')!.addEventListener('pointerdown', (ev) => {
      if (this.engine.runPhase !== 'combat') return;
      this.pointerNdc.x = (ev.clientX / window.innerWidth) * 2 - 1;
      this.pointerNdc.y = -(ev.clientY / window.innerHeight) * 2 + 1;
      this.raycaster.setFromCamera(this.pointerNdc, this.camera);
      const meshes = this.enemyActors
        .filter((_, idx) => this.engine.enemies[idx]?.hp > 0)
        .map((a) => a.mesh);
      const hits = this.raycaster.intersectObjects(meshes, false);
      if (hits.length > 0) {
        const idx = hits[0].object.userData.enemyIdx;
        if (typeof idx === 'number') {
          this.audio.playCardHover();
          this.engine.selectedTargetIdx = idx;
          this.refreshCombatHud();
        }
      }
    });

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
      this.showToast('🧘 打坐调息完毕，气血充盈！');
      this.syncAllUi();
    });

    document.getElementById('btn-leave-shop')!.addEventListener('click', () => {
      this.engine.leaveSubScreen();
      this.syncAllUi();
    });

    document.getElementById('btn-open-deck')!.addEventListener('click', () => {
      this.openDeckInspector('📜 本命牌库总览', this.engine.masterDeck);
    });
    document.getElementById('btn-draw-pile')!.addEventListener('click', () => {
      const copy = [...this.engine.drawPile].sort((a, b) => a.defId.localeCompare(b.defId));
      this.openDeckInspector('🎴 当前抽牌堆 (顺序已打乱展示)', copy);
    });
    document.getElementById('btn-discard-pile')!.addEventListener('click', () => {
      this.openDeckInspector('♻️ 当前弃牌堆', this.engine.discardPile);
    });
    document.getElementById('btn-exhaust-pile')!.addEventListener('click', () => {
      this.openDeckInspector('🔥 本战已消耗牌', this.engine.exhaustPile);
    });
    document.getElementById('btn-close-deck')!.addEventListener('click', () => {
      document.getElementById('deck-modal')!.classList.add('hidden');
    });

    document.getElementById('btn-Audio-mute')!.addEventListener('click', () => {
      this.audio.unlock();
      const m = this.audio.toggleMute();
      document.getElementById('btn-Audio-mute')!.textContent = m ? '🔇' : '🎵';
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
        const m = this.audio.toggleMute();
        document.getElementById('btn-Audio-mute')!.textContent = m ? '🔇' : '🎵';
        return;
      }
      if (e.code === 'KeyD' && this.engine.runPhase !== 'title') {
        this.openDeckInspector('📜 本命牌库总览', this.engine.masterDeck);
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
  // Main 60 FPS Animation Loop
  // =========================================================================
  private tick(): void {
    this.timer.update();
    const dt = Math.min(Math.max(this.timer.getDelta(), 0), 0.05);
    this.clockSec += dt;

    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) {
        document.getElementById('toast-banner')!.classList.add('hidden');
      }
    }

    const inCombat = this.engine.runPhase === 'combat';
    const isBoss = inCombat && this.engine.enemies.some((e) => e.isBoss && e.hp > 0);
    this.audio.stepBgm(inCombat, isBoss);

    // Animate Qi Spirit Particles
    const pAttr = this.qiParticles.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pAttr.count; i++) {
      let y = pAttr.getY(i) + dt * 0.55;
      if (y > 6.5) y = -0.5;
      pAttr.setY(i, y);
    }
    pAttr.needsUpdate = true;

    // Animate Hero Cultivator & Protective Jade Shield
    this.heroLungeX *= Math.exp(-10 * dt);
    if (this.heroWobble > 0) this.heroWobble = Math.max(0, this.heroWobble - dt);
    const hSy = 1 - Math.sin((this.heroWobble / 0.2) * Math.PI) * 0.16;
    const hSxz = 1 / Math.sqrt(Math.max(0.6, hSy));
    const hBob = Math.sin(this.clockSec * 2.4) * 0.06;
    this.heroGroup.position.set(-2.75 + this.heroLungeX, hBob, 0.2);
    this.heroGroup.scale.set(hSxz, hSy, hSxz);

    this.heroShieldMesh.visible = inCombat && this.engine.block > 0;
    this.heroShieldMesh.rotation.y += dt * 1.2;

    // Animate Orbiting Floating Swords in the Sword Box!
    const box = inCombat ? this.engine.swordBox : (['metal', 'ice', 'fire'] as const);
    for (let i = 0; i < this.orbitSwords.length; i++) {
      const sm = this.orbitSwords[i];
      if (i >= box.length) {
        sm.visible = false;
        continue;
      }
      sm.visible = true;
      const el = box[i];
      const spec = SWORD_ELEMENTS[el];
      const mat = sm.material as THREE.MeshStandardMaterial;
      mat.color.setHex(spec.colorHex);
      mat.emissive.setHex(spec.colorHex);

      const ang = this.clockSec * 1.6 + (i / Math.max(1, box.length)) * Math.PI * 2;
      const hx = this.heroGroup.position.x - 0.35 + Math.cos(ang) * 0.65;
      const hy = 1.65 + Math.sin(ang * 1.5) * 0.32;
      const hz = 0.2 + Math.sin(ang) * 0.85;
      sm.position.set(hx, hy, hz);
      sm.rotation.set(0.25 * Math.sin(ang), 0, -Math.PI * 0.32);
    }

    // Animate 3D Enemies & Overhead Projected DOM Plates
    if (inCombat) {
      const hScr = this.worldToScreen(-2.75, 2.45, 0.2);
      this.heroPlateEl.style.left = `${hScr.x.toFixed(0)}px`;
      this.heroPlateEl.style.top = `${hScr.y.toFixed(0)}px`;

      const selActor = this.enemyActors[this.engine.selectedTargetIdx];
      if (selActor && this.engine.enemies[this.engine.selectedTargetIdx]?.hp > 0) {
        this.targetRing.visible = true;
        this.targetRing.position.set(selActor.baseX, 0.05, selActor.baseZ);
        this.targetRing.rotation.z += dt * 1.8;
      } else {
        this.targetRing.visible = false;
      }

      this.enemyActors.forEach((actor, idx) => {
        const e = this.engine.enemies[idx];
        if (!e || e.hp <= 0) return;
        actor.lungeX *= Math.exp(-9 * dt);
        if (actor.wobble > 0) actor.wobble = Math.max(0, actor.wobble - dt);
        const sy = 1 - Math.sin((actor.wobble / 0.2) * Math.PI) * 0.2;
        const sxz = 1 / Math.sqrt(Math.max(0.6, sy));
        const bob = Math.sin(this.clockSec * 2.8 + idx * 1.4) * 0.08;
        actor.group.position.set(actor.baseX + actor.lungeX, bob, actor.baseZ);
        actor.group.scale.set(sxz, sy, sxz);

        const m = actor.mesh.material as THREE.MeshStandardMaterial;
        if (actor.flash > 0) {
          actor.flash -= dt;
          m.emissive.setHex(0xffffff);
          m.emissiveIntensity = 0.95;
        } else {
          m.emissive.setHex(e.tintHex);
          m.emissiveIntensity = e.isBoss ? 0.22 : 0.1;
        }

        const topY = e.isBoss ? 3.35 : e.isElite ? 2.85 : 2.35;
        const eScr = this.worldToScreen(actor.baseX, topY, actor.baseZ);
        actor.plateEl.style.left = `${eScr.x.toFixed(0)}px`;
        actor.plateEl.style.top = `${eScr.y.toFixed(0)}px`;
      });
    } else {
      this.targetRing.visible = false;
    }

    // Step 3D Flying Sword Projectiles
    for (let i = this.activeProjectiles.length - 1; i >= 0; i--) {
      const p = this.activeProjectiles[i];
      p.age += dt;
      const u = Math.min(1, p.age / p.dur);
      const inv = 1 - u;
      p.mesh.position
        .set(0, 0, 0)
        .addScaledVector(p.start, inv * inv)
        .addScaledVector(p.ctrl, 2 * inv * u)
        .addScaledVector(p.end, u * u);

      // Point blade tip (+Y) along Bezier tangent!
      const tangent = p.ctrl
        .clone()
        .sub(p.start)
        .multiplyScalar(2 * inv)
        .add(p.end.clone().sub(p.ctrl).multiplyScalar(2 * u))
        .normalize();
      p.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);

      if (u >= 1) {
        this.scene.remove(p.mesh);
        (p.mesh.material as THREE.Material).dispose();
        this.activeProjectiles.splice(i, 1);
      }
    }

    // Step 3D Shockwave Rings & Sky Pillars
    for (let i = this.activeRings.length - 1; i >= 0; i--) {
      const r = this.activeRings[i];
      r.age += dt;
      const u = Math.min(1, r.age / r.dur);
      r.mesh.scale.setScalar(0.2 + u * r.maxScale);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - u) * 0.85;
      if (u >= 1) {
        this.scene.remove(r.mesh);
        r.mesh.geometry.dispose();
        (r.mesh.material as THREE.Material).dispose();
        this.activeRings.splice(i, 1);
      }
    }

    for (let i = this.activePillars.length - 1; i >= 0; i--) {
      const pl = this.activePillars[i];
      pl.age += dt;
      const u = Math.min(1, pl.age / pl.dur);
      pl.mesh.scale.set(1 - u * 0.65, 1, 1 - u * 0.65);
      (pl.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - u) * 0.72;
      if (u >= 1) {
        this.scene.remove(pl.mesh);
        pl.mesh.geometry.dispose();
        (pl.mesh.material as THREE.Material).dispose();
        this.activePillars.splice(i, 1);
      }
    }

    // Camera Positioning & Trauma² Rotational Shake
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    const camDist = aspect < 1.0 ? 12.8 : 9.2;
    const camY = aspect < 1.0 ? 5.1 : 3.9;
    this.camera.position.set(0.15, camY, camDist);
    this.camera.lookAt(0.25, 1.3, 0);
    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - 1.9 * dt);
      const sh = this.trauma * this.trauma;
      this.camera.rotateX(Math.sin(this.clockSec * 37) * 0.03 * sh);
      this.camera.rotateZ(Math.cos(this.clockSec * 43) * 0.04 * sh);
    }

    this.render2dFxCanvas(dt);
    this.composer.render();
  }

  private render2dFxCanvas(dt: number): void {
    const ctx = this.fxCtx;
    ctx.clearRect(0, 0, this.fxCanvas.width, this.fxCanvas.height);

    // Draw Luminous Bezier Targeting Curve when hovering a single-target card!
    if (
      this.engine.runPhase === 'combat' &&
      this.hoveredCardEl &&
      this.hoveredSingleTarget &&
      this.enemyActors[this.engine.selectedTargetIdx]
    ) {
      const rect = this.hoveredCardEl.getBoundingClientRect();
      const sx = rect.left + rect.width * 0.5;
      const sy = rect.top + 16;
      const act = this.enemyActors[this.engine.selectedTargetIdx];
      const dst = this.worldToScreen(act.baseX, 1.3, act.baseZ);

      ctx.save();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 3.5;
      ctx.shadowColor = '#2dd4bf';
      ctx.shadowBlur = 14;
      ctx.setLineDash([10, 8]);
      ctx.lineDashOffset = -this.clockSec * 90;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo((sx + dst.x) * 0.5, Math.min(sy, dst.y) - 120, dst.x, dst.y);
      ctx.stroke();

      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(dst.x, dst.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw Parabolic Floating Damage / Block Popups
    for (let i = this.floatTexts.length - 1; i >= 0; i--) {
      const ft = this.floatTexts[i];
      ft.age += dt;
      ft.vy += 170 * dt;
      ft.x += ft.vx * dt;
      ft.y += ft.vy * dt;
      const alpha = Math.max(0, 1 - ft.age / ft.dur);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `900 ${ft.big ? 26 : 18}px "Microsoft YaHei", sans-serif`;
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#060913';
      ctx.lineWidth = 4;
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();

      if (ft.age >= ft.dur) {
        this.floatTexts.splice(i, 1);
      }
    }
  }

  private onResize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / Math.max(1, h);
    this.camera.fov = w < h ? 52 : 44;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, w <= 820 ? 1.25 : 1.5));
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.fxCanvas.width = w;
    this.fxCanvas.height = h;
  }

  public getMetrics() {
    return {
      modelsLoaded: this.modelsLoaded,
      phase: this.engine.runPhase,
      floor: this.engine.currentRow + 1,
      hp: this.engine.hp,
      qi: this.engine.qi,
      handCount: this.engine.hand.length,
      swordBox: this.engine.swordBox,
      drawCalls: this.renderer.info.render.calls,
    };
  }
}

const app = new SwordSpireApp();
Object.assign(window, {
  app,
  renderer: app.renderer,
  scene: app.scene,
});
