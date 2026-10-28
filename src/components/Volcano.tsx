import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Flame, Play, Square, RotateCcw, Wind, Gauge, Beaker, AlertTriangle } from "lucide-react";
import { simState } from "../store";
import { setRumble, stopRumble, explosion } from "../audio";
import { PointCloud } from "../three/pfx";
import { PageHeader, SliderRow, Panel, Badge } from "./ui";
import lavaTexUrl from "../assets/lava.jpg";
import rockTexUrl from "../assets/rock.jpg";

/** نسيج ترابي إجرائي — يُنشأ فوراً بدون انتظار تحميل */
function dirtTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#6b5a47";
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2200; i++) {
    const v = Math.random();
    g.fillStyle = v > 0.66 ? "#7d6a52" : v > 0.33 ? "#5e4f3e" : "#8a7860";
    g.globalAlpha = 0.35 + Math.random() * 0.4;
    g.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** نسيج حمم إجرائي بفقاعات متوهجة وشقوق داكنة */
function lavaCanvasTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 256, 256);
  grad.addColorStop(0, "#ffb347");
  grad.addColorStop(0.35, "#f97316");
  grad.addColorStop(0.7, "#c2410c");
  grad.addColorStop(1, "#7c2d12");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = "rgba(24,8,2,0.8)";
  for (let i = 0; i < 26; i++) {
    g.lineWidth = 1 + Math.random() * 4;
    let x = Math.random() * 256, y = Math.random() * 256;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 5; k++) { x += (Math.random() - 0.5) * 60; y += Math.random() * 34; g.lineTo(x, y); }
    g.stroke();
  }
  for (let i = 0; i < 130; i++) {
    g.fillStyle = Math.random() > 0.45 ? "rgba(255,231,146,0.95)" : "rgba(40,10,2,0.75)";
    g.beginPath();
    g.arc(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 3.4, 0, 7);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

const WA = Math.PI * 0.55; // زاوية المقطع الناقص
const PROFILE: [number, number][] = [[13.8, 0.02], [12.4, 0.7], [10.6, 1.45], [8.8, 2.25], [7.2, 3.1], [5.8, 3.95], [4.6, 4.7], [3.6, 5.35], [2.8, 5.9], [2.3, 6.3], [1.95, 6.55], [1.65, 6.75]];
function hProfile(r: number): number {
  if (r >= 13.8) return 0;
  if (r <= 1.65) return 6.75;
  for (let i = 0; i < PROFILE.length - 1; i++) {
    const [r1, y1] = PROFILE[i];
    const [r2, y2] = PROFILE[i + 1];
    if (r <= r1 && r >= r2) return y1 + (y2 - y1) * ((r1 - r) / (r1 - r2));
  }
  return 0;
}

/** رسم مقطع أرضي تعليمي على canvas */
function crossSectionTexture(): THREE.CanvasTexture {
  const W = 512, H = 512;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d")!;
  const img = g.createImageData(W, H);
  const d = img.data;
  const R = 15, Y0 = -9.5, Y1 = 6.85;
  for (let py = 0; py < H; py++) {
    const yw = Y1 - (py / (H - 1)) * (Y1 - Y0);
    for (let px = 0; px < W; px++) {
      const r = (px / (W - 1)) * R;
      const surf = r <= 1.65 ? 6.75 : hProfile(r);
      const inside = (yw <= surf && r <= 13.85) || yw < 0;
      const o = (py * W + px) * 4;
      if (!inside) { d[o + 3] = 0; continue; }
      const noise = (Math.sin(px * 12.9898 + py * 78.233) * 43758.5453) % 1 * 14;
      let cr = 0, cg = 0, cb = 0;
      if (yw < 0) {
        // باطن الأرض — طبقات بازلتية داكنة
        const band = Math.sin(yw * 1.9 + Math.sin(r * 0.9) * 1.6);
        const depth = Math.min(1, -yw / 9.5);
        cr = 34 - depth * 12 + band * 7 + Math.abs(noise);
        cg = 24 - depth * 8 + band * 5 + Math.abs(noise) * 0.6;
        cb = 18 - depth * 6 + band * 3;
      } else {
        // جسم المخروط — طبقات حمم ورماد متعاقبة
        const band = Math.sin(yw * 3.3 + r * 0.55 + Math.sin(r * 2.0) * 0.4);
        if (band > 0.25) { cr = 82 + noise; cg = 58 + noise * 0.7; cb = 36; }
        else if (band > -0.25) { cr = 56 + noise; cg = 40 + noise * 0.6; cb = 26; }
        else { cr = 40 + noise; cg = 28 + noise * 0.5; cb = 18; }
        // حافة علوية داكنة
        if (surf - yw < 0.12) { cr *= 0.45; cg *= 0.45; cb *= 0.45; }
      }
      // المدخنة المركزية
      if (yw > -5.9 && yw < 6.3 && r < 0.8) {
        const core = 1 - r / 0.8;
        cr = 200 + core * 55; cg = 60 + core * 140; cb = 10 + core * 40;
      }
      // غرفة الماغما
      const dxc = r, dyc = (yw + 6.2) / 0.72;
      const dc = Math.sqrt(dxc * dxc * 0.55 + dyc * dyc);
      if (dc < 2.35 && yw < -3.6) {
        const glow = Math.max(0, 1 - dc / 2.35);
        cr = 160 + glow * 95; cg = 40 + glow * 150; cb = 8 + glow * 50;
        if (dc > 1.85 && dc < 2.25) { cr = 90; cg = 55; cb = 30; } // جدار الغرفة
      }
      d[o] = cr; d[o + 1] = cg; d[o + 2] = cb; d[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export type VolcanoStyle = "هاواي هادئ" | "سترومبولي متوسط" | "فولكاني عنيف" | "بليني مدمّر";

export default function Volcano() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [silica, setSilica] = useState(58);
  const [gas, setGas] = useState(55);
  const [erupting, setErupting] = useState(false);
  const refsRef = useRef({ silica: 58, gas: 55, erupting: false });
  const resetRef = useRef<() => void>(() => {});

  const visc01 = useMemo(() => (silica - 45) / 33, [silica]);
  const explosivity = useMemo(() => Math.min(1, Math.max(0.05, (gas / 100) * 0.62 + visc01 * 0.5 - 0.06)), [gas, visc01]);
  const style: VolcanoStyle = explosivity < 0.25 ? "هاواي هادئ" : explosivity < 0.5 ? "سترومبولي متوسط" : explosivity < 0.75 ? "فولكاني عنيف" : "بليني مدمّر";
  const styleColor = explosivity < 0.25 ? "#4ade80" : explosivity < 0.5 ? "#fbbf24" : explosivity < 0.75 ? "#fb923c" : "#ef4444";
  const vei = Math.max(0, Math.round(explosivity * 7));

  useEffect(() => { refsRef.current = { silica, gas, erupting }; simState.volcano = { silica, gas, erupting, style }; }, [silica, gas, erupting, style]);

  useEffect(() => {
    const mount = mountRef.current!;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07080c);
    scene.fog = new THREE.Fog(0x07080c, 60, 170);

    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / mount.clientHeight, 0.1, 500);
    camera.position.set(21, 11, 17);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 3, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 9;
    controls.maxDistance = 90;
    controls.maxPolarAngle = Math.PI * 0.52;

    const world = new THREE.Group();
    scene.add(world);

    // إضاءة ليلية
    scene.add(new THREE.AmbientLight(0x33415c, 0.9));
    const moon = new THREE.DirectionalLight(0x8fa3c7, 0.85);
    moon.position.set(-24, 30, -12);
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    moon.shadow.camera.left = -30; moon.shadow.camera.right = 30;
    moon.shadow.camera.top = 30; moon.shadow.camera.bottom = -30;
    scene.add(moon);
    const ventLight = new THREE.PointLight(0xff6a00, 40, 46, 1.8);
    ventLight.position.set(0, 7.4, 0);
    world.add(ventLight);
    const riverLight = new THREE.PointLight(0xff5a00, 0, 30, 1.8);
    riverLight.position.set(6, 3, 3);
    world.add(riverLight);

    // نجوم
    {
      const n = 700;
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(160 + Math.random() * 140); if (v.y < 5) v.y = Math.abs(v.y) + 8; pos.set([v.x, v.y, v.z], i * 3); }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xa8b8dc, size: 0.6, transparent: true, opacity: 0.75 })));
    }

    // الأنسجة
    const loader = new THREE.TextureLoader();
    const lavaTex = loader.load(lavaTexUrl);
    lavaTex.colorSpace = THREE.SRGBColorSpace;
    lavaTex.wrapS = lavaTex.wrapT = THREE.RepeatWrapping;
    const rockTex = loader.load(rockTexUrl);
    rockTex.colorSpace = THREE.SRGBColorSpace;
    rockTex.wrapS = rockTex.wrapT = THREE.RepeatWrapping;

    // الأرض
    const groundTex = dirtTexture();
    groundTex.repeat.set(18, 18);
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(75, 96, WA / 2, Math.PI * 2 - WA),
      new THREE.MeshStandardMaterial({ map: groundTex, color: 0x9a8770, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    world.add(ground);
    // جدران وجوف تحت الأرض
    const underWall = new THREE.Mesh(new THREE.CylinderGeometry(75, 75, 11, 64, 1, true), new THREE.MeshStandardMaterial({ color: 0x120e0a, roughness: 1, side: THREE.BackSide }));
    underWall.position.y = -5.5;
    world.add(underWall);
    const underFloor = new THREE.Mesh(new THREE.CircleGeometry(75, 32), new THREE.MeshStandardMaterial({ color: 0x0a0806 }));
    underFloor.rotation.x = Math.PI / 2;
    underFloor.position.y = -10.8;
    world.add(underFloor);

    // المخروط البركاني
    const conePts = PROFILE.map(([r, y]) => new THREE.Vector2(r, y));
    const coneGeo = new THREE.LatheGeometry(conePts, 96, WA / 2, Math.PI * 2 - WA);
    {
      const pos = coneGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        const az = Math.atan2(z, x);
        const n = Math.sin(az * 9 + y * 1.7) * 0.32 + Math.sin(az * 23 + y * 3.3) * 0.14 + Math.sin(az * 5 - y * 0.8) * 0.2;
        const rr = Math.hypot(x, z);
        if (rr > 0.5) {
          const k = 1 + (n * 0.06 * Math.min(1, rr / 6));
          pos.setX(i, x * k); pos.setZ(i, z * k);
        }
      }
      coneGeo.computeVertexNormals();
    }
    rockTex.repeat.set(7, 3);
    const cone = new THREE.Mesh(coneGeo, new THREE.MeshStandardMaterial({ map: rockTex, color: 0x9c856f, roughness: 1 }));
    cone.castShadow = true; cone.receiveShadow = true;
    world.add(cone);
    world.add(new THREE.Mesh(coneGeo.clone(), new THREE.MeshStandardMaterial({ color: 0x1c130c, roughness: 1, side: THREE.BackSide })));

    // وجها المقطع التعليميان
    const secTex = crossSectionTexture();
    [WA / 2, -WA / 2].forEach((az) => {
      const g = new THREE.PlaneGeometry(15, 16.35);
      g.translate(7.5, -1.325, 0);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: secTex, side: THREE.DoubleSide, transparent: true }));
      m.rotation.y = -az;
      world.add(m);
    });

    // المدخنة + الغرفة + بحيرة الحمم
    const conduitTex = lavaCanvasTexture();
    const conduit = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.88, 12.9, 24, 1, true, WA / 2, Math.PI * 2 - WA),
      new THREE.MeshStandardMaterial({ map: conduitTex, emissive: 0xff5a00, emissiveMap: conduitTex, emissiveIntensity: 1.4, side: THREE.DoubleSide })
    );
    conduit.position.y = 0.25;
    world.add(conduit);
    const chamber = new THREE.Mesh(
      new THREE.SphereGeometry(2.5, 40, 28, WA / 2, Math.PI * 2 - WA),
      new THREE.MeshStandardMaterial({ map: lavaTex, emissive: 0xff4d00, emissiveMap: lavaTex, emissiveIntensity: 1.8 })
    );
    chamber.position.y = -6.2;
    world.add(chamber);
    const poolTex = lavaCanvasTexture();
    const pool = new THREE.Mesh(new THREE.CircleGeometry(1.62, 40), new THREE.MeshStandardMaterial({ map: poolTex, emissive: 0xff6a00, emissiveMap: poolTex, emissiveIntensity: 1.5, roughness: 0.4 }));
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 6.5;
    world.add(pool);
    const rimGlow = new THREE.Mesh(new THREE.TorusGeometry(1.72, 0.09, 10, 48), new THREE.MeshBasicMaterial({ color: 0xff7a1a }));
    rimGlow.rotation.x = -Math.PI / 2;
    rimGlow.position.y = 6.62;
    world.add(rimGlow);

    // أنهار الحمم
    interface River { mesh: THREE.Mesh; tex: THREE.Texture; idxCount: number; progress: number }
    const rivers: River[] = [];
    const riverAz = [1.31, 1.9, 2.6, 3.5, 4.35];
    riverAz.forEach((az0, ri) => {
      const N = 46;
      const posArr = new Float32Array(N * 2 * 3);
      const uvArr = new Float32Array(N * 2 * 2);
      const idx: number[] = [];
      for (let i = 0; i < N; i++) {
        const t = i / (N - 1);
        const r = 2.05 + t * 11.4;
        const az = az0 + Math.sin(t * 6 + ri * 2.3) * 0.075 * t;
        const y = hProfile(r) + 0.09;
        const cx = Math.cos(az) * r, cz = Math.sin(az) * r;
        const w = 0.5 + t * 1.15;
        const sx = -Math.sin(az) * w, sz = Math.cos(az) * w;
        posArr.set([cx - sx, y, cz - sz], i * 6);
        posArr.set([cx + sx, y + 0.02, cz + sz], i * 6 + 3);
        uvArr.set([0, t * 6], i * 4);
        uvArr.set([1, t * 6], i * 4 + 2);
        if (i < N - 1) {
          const a = i * 2, b = i * 2 + 1, c2 = i * 2 + 2, d2 = i * 2 + 3;
          idx.push(a, b, c2, b, d2, c2);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(posArr, 3));
      g.setAttribute("uv", new THREE.BufferAttribute(uvArr, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      const rt = lavaCanvasTexture();
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: rt, emissive: 0xff5a00, emissiveMap: rt, emissiveIntensity: 2.0, roughness: 0.7 }));
      g.setDrawRange(0, 0);
      world.add(m);
      rivers.push({ mesh: m, tex: rt, idxCount: idx.length, progress: 0 });
    });

    // صخور وأشجار وجبال
    const rockMat = new THREE.MeshStandardMaterial({ map: rockTex, color: 0x5a4f42, roughness: 1 });
    for (let i = 0; i < 12; i++) {
      const az = Math.random() * Math.PI * 2, rr = 16 + Math.random() * 26;
      const s = 0.4 + Math.random() * 1.3;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rockMat);
      rock.position.set(Math.cos(az) * rr, s * 0.45, Math.sin(az) * rr);
      rock.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      rock.castShadow = true;
      world.add(rock);
    }
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x2a1c10, roughness: 1 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x16240f, roughness: 1 });
    for (let i = 0; i < 14; i++) {
      const az = Math.random() * Math.PI * 2, rr = 19 + Math.random() * 34;
      if (Math.abs(((az + Math.PI) % (Math.PI * 2)) - Math.PI) < 0.5) continue;
      const tg = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 1.0, 7), trunkMat);
      trunk.position.y = 0.5;
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.75, 2.1, 8), leafMat);
      leaf.position.y = 1.9;
      leaf.castShadow = true;
      tg.add(trunk, leaf);
      tg.position.set(Math.cos(az) * rr, 0, Math.sin(az) * rr);
      const sc = 0.8 + Math.random() * 0.9;
      tg.scale.setScalar(sc);
      world.add(tg);
    }
    for (let i = 0; i < 7; i++) {
      const az = (i / 7) * Math.PI * 2 + 0.35;
      const rr = 90 + Math.random() * 45;
      const h = 10 + Math.random() * 16;
      const mnt = new THREE.Mesh(new THREE.ConeGeometry(h * (1.1 + Math.random() * 0.6), h, 7), new THREE.MeshStandardMaterial({ color: 0x0b0d13, roughness: 1 }));
      mnt.position.set(Math.cos(az) * rr, h / 2 - 1.5, Math.sin(az) * rr);
      scene.add(mnt);
    }

    // ===== الجسيمات =====
    const ash = new PointCloud(1500, false);
    world.add(ash.points);
    interface Ash { alive: boolean; x: number; y: number; z: number; vx: number; vy: number; vz: number; age: number; max: number; s0: number; grow: number; seed: number; shade: number; dust: boolean }
    const parts: Ash[] = Array.from({ length: 1500 }, () => ({ alive: false, x: 0, y: -99, z: 0, vx: 0, vy: 0, vz: 0, age: 0, max: 1, s0: 1, grow: 1, seed: Math.random() * 100, shade: 0.5, dust: false }));
    let ashCursor = 0;
    const spawnAsh = (dust: boolean, px = 0, py = 6.7, pz = 0) => {
      for (let k = 0; k < (dust ? 5 : 1); k++) {
        const i = ashCursor; ashCursor = (ashCursor + 1) % parts.length;
        const p = parts[i];
        const E = explosivityRef.current;
        const a = Math.random() * Math.PI * 2;
        if (dust) {
          const sp = 1.5 + Math.random() * 3.5;
          Object.assign(p, { alive: true, x: px, y: py + 0.2, z: pz, vx: Math.cos(a) * sp, vy: 1 + Math.random() * 2.5, vz: Math.sin(a) * sp, age: 0, max: 1.4 + Math.random() * 1.4, s0: 0.7, grow: 2.4, shade: 0.62 + Math.random() * 0.18, dust: true });
        } else {
          const up = (6 + E * 17) * (0.55 + Math.random() * 0.55);
          const spread = (1.5 - E) * (0.4 + Math.random() * 1.1);
          Object.assign(p, { alive: true, x: (Math.random() - 0.5) * 1.2, y: 6.55 + Math.random() * 0.5, z: (Math.random() - 0.5) * 1.2, vx: Math.cos(a) * spread, vy: up, vz: Math.sin(a) * spread, age: 0, max: 4 + Math.random() * 5 + E * 3, s0: 0.9 + Math.random() * 1.2, grow: 1.3 + E * 1.6, shade: 0.16 + Math.random() * 0.22, dust: false });
        }
      }
    };

    // القنابل النارية
    const BOMB_N = 90;
    const bombs = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshStandardMaterial({ color: 0x2a0f04, emissive: 0xff5a00, emissiveIntensity: 2.6, roughness: 0.6 }), BOMB_N);
    bombs.frustumCulled = false;
    world.add(bombs);
    interface Bomb { alive: boolean; x: number; y: number; z: number; vx: number; vy: number; vz: number; s: number }
    const bombArr: Bomb[] = Array.from({ length: BOMB_N }, () => ({ alive: false, x: 0, y: -99, z: 0, vx: 0, vy: 0, vz: 0, s: 1 }));
    const M4 = new THREE.Matrix4();
    const hideBombs = () => { bombArr.forEach((b, i) => { b.alive = false; M4.makeScale(0, 0, 0); M4.setPosition(0, -99, 0); bombs.setMatrixAt(i, M4); }); bombs.instanceMatrix.needsUpdate = true; };
    hideBombs();

    const explosivityRef = { current: explosivity };
    const riverRate = 0.05 + 0.09 * (1 - visc01);

    let intensity = 0;
    let bomAcc = 0, ashAcc = 0, boomTimer = 1.5;
    let raf = 0;
    let prevMs = performance.now();
    const startMs = prevMs;

    resetRef.current = () => {
      parts.forEach((p) => (p.alive = false));
      hideBombs();
      rivers.forEach((r) => { r.progress = 0; r.mesh.geometry.setDrawRange(0, 0); });
      intensity = 0;
    };

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const nowMs = performance.now();
      const dt = Math.min(0.05, (nowMs - prevMs) / 1000);
      prevMs = nowMs;
      const t = (nowMs - startMs) / 1000;
      const st = refsRef.current;
      explosivityRef.current = Math.min(1, Math.max(0.05, (st.gas / 100) * 0.62 + ((st.silica - 45) / 33) * 0.5 - 0.06));
      const E = explosivityRef.current;

      intensity += ((st.erupting ? 0.35 + E * 0.65 : 0) - intensity) * Math.min(1, dt * 1.6);

      // اهتزاز العالم
      const sh = intensity * 0.1;
      world.position.set((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh * 0.7, (Math.random() - 0.5) * sh);

      // أضواء متوهجة
      ventLight.intensity = 26 + Math.sin(t * 17) * 7 + intensity * (55 + Math.sin(t * 31) * 22);
      (pool.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.1 + intensity * 1.6 + Math.sin(t * 9) * 0.25 * (0.3 + intensity);
      conduitTex.offset.y -= dt * (0.12 + intensity * 0.5);
      poolTex.offset.y += dt * 0.06;
      riverLight.intensity = intensity * 30;

      // رماد
      if (st.erupting && intensity > 0.05) {
        ashAcc += dt * (30 + E * 160) * intensity;
        while (ashAcc > 1) { spawnAsh(false); ashAcc -= 1; }
      }
      const wind = 1.0 + E * 2.2;
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        if (!p.alive) { ash.hide(i); continue; }
        p.age += dt;
        if (p.age > p.max) { p.alive = false; ash.hide(i); continue; }
        p.vy *= 1 - 0.35 * dt;
        p.vx += (wind * 0.55 + Math.sin(t * 2.6 + p.seed) * (0.5 + E)) * dt;
        p.vz += Math.cos(t * 2.1 + p.seed * 1.3) * dt * (0.6 + E);
        if (p.dust) p.vy -= 5.5 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.dust && p.y < 0.15) { p.y = 0.15; p.vy = 0; p.vx *= 0.9; p.vz *= 0.9; }
        const a01 = p.age / p.max;
        const alpha = (p.dust ? 0.5 : 0.42) * Math.min(1, a01 * 8) * (1 - a01) * (0.55 + intensity * 0.45);
        const size = p.s0 * (1 + p.age * p.grow);
        const sh2 = p.shade * (p.dust ? 1.35 : 1);
        // توهج برتقالي قرب الفوهة
        const heat = !p.dust && p.y < 10 ? Math.max(0, 1 - (p.y - 6.5) / 3.5) * intensity : 0;
        ash.set(i, p.x, p.y, p.z, size, alpha, sh2 + heat * 1.3, sh2 * 0.92 + heat * 0.45, sh2 * 0.85 + heat * 0.08);
      }
      ash.commit();

      // قنابل
      if (st.erupting && intensity > 0.15 && E > 0.12) {
        bomAcc += dt * (E * 9 + (1 - E) * 0.8) * intensity;
        while (bomAcc > 1) {
          bomAcc -= 1;
          const b = bombArr.find((bb) => !bb.alive);
          if (b) {
            const a = Math.random() * Math.PI * 2;
            const up = (10 + E * 15) * (0.65 + Math.random() * 0.5);
            const sp = ((1 - ((st.silica - 45) / 33)) * 5 + 1.2) * (0.4 + Math.random());
            Object.assign(b, { alive: true, x: (Math.random() - 0.5), y: 6.9, z: (Math.random() - 0.5), vx: Math.cos(a) * sp, vy: up, vz: Math.sin(a) * sp, s: 0.16 + Math.random() * 0.4 });
          }
        }
      }
      for (let i = 0; i < BOMB_N; i++) {
        const b = bombArr[i];
        if (!b.alive) continue;
        b.vy -= 9.8 * dt * 1.4;
        b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
        const rr = Math.hypot(b.x, b.z);
        const floor = rr < 1.8 ? 6.6 : hProfile(Math.min(13.7, rr)) + b.s * 0.6;
        if (b.y <= floor) {
          b.alive = false;
          spawnAsh(true, b.x, b.y, b.z);
          M4.makeScale(0, 0, 0); M4.setPosition(0, -99, 0);
          bombs.setMatrixAt(i, M4);
          continue;
        }
        M4.makeRotationY(t * 4 + i);
        M4.scale(new THREE.Vector3(b.s, b.s * 0.85, b.s));
        M4.setPosition(b.x, b.y, b.z);
        bombs.setMatrixAt(i, M4);
      }
      bombs.instanceMatrix.needsUpdate = true;

      // أنهار الحمم
      rivers.forEach((rv, i) => {
        const target = st.erupting ? Math.min(1, (E < 0.5 ? 1 : 0.45)) : 0;
        if (st.erupting) rv.progress = Math.min(target, rv.progress + dt * riverRate);
        else rv.progress = Math.max(0, rv.progress - dt * 0.15);
        rv.mesh.geometry.setDrawRange(0, Math.floor(rv.progress * rv.idxCount));
        rv.tex.offset.y -= dt * (0.5 + intensity * 1.2);
        (rv.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.4 + Math.sin(t * 7 + i * 2) * 0.4 + intensity * 0.5;
      });

      // أصوات دورية
      if (st.erupting && intensity > 0.3) {
        boomTimer -= dt;
        if (boomTimer <= 0) {
          explosion(0.14 + E * 0.3 * intensity);
          boomTimer = (E > 0.5 ? 1.6 : 3.2) + Math.random() * 2.4;
        }
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      ash.dispose();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Points) {
          o.geometry.dispose();
          const m = o.material as THREE.Material | THREE.Material[];
          (Array.isArray(m) ? m : [m]).forEach((mm) => mm.dispose());
        }
      });
      lavaTex.dispose(); rockTex.dispose(); secTex.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = () => {
    const next = !erupting;
    setErupting(next);
    if (next) { explosion(0.35 + explosivity * 0.55); setRumble(0.2 + explosivity * 0.55, 3 + explosivity * 5); }
    else stopRumble();
  };

  return (
    <div className="anim-page flex h-full flex-col">
      <PageHeader icon={Flame} title="محاكي البراكين والانفجارات" sub="تحكّم بخصائص الماغما وشاهد كيف يتغيّر سلوك البركان — من التدفق الهادئ إلى الانفجار البليني" />
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/[0.07] bg-[#07080c]">
        <div ref={mountRef} className="absolute inset-0" />

        {/* لوحة التحكم */}
        <div className="absolute right-3 top-3 w-[280px] max-w-[calc(100%-24px)] max-h-[calc(100%-24px)] overflow-y-auto">
          <Panel title="مختبر الماغما" icon={Beaker}>
            <div className="space-y-4">
              <SliderRow label="نسبة السيليكا SiO₂" value={silica} display={`${silica}%`} min={45} max={78} step={1}
                onChange={setSilica} tone="gold" hint="تتحكم في اللزوجة: بازلت (50%) سائل — ريولايت (70%) متخثّر" />
              <SliderRow label="ضغط الغازات المحتبسة" value={gas} display={`${gas}%`} min={0} max={100} step={1}
                onChange={setGas} hint="بخار الماء وCO₂ وSO₂ المحبوسة داخل الماغما" />
              <div className="grid grid-cols-2 gap-2 border-t border-white/[0.07] pt-3">
                <div className="rounded-xl bg-white/[0.04] p-2 text-center border border-white/[0.06]">
                  <div className="text-[10px] font-bold text-slate-500">اللزوجة النسبية</div>
                  <div className="font-display text-sm font-black text-ember">{(Math.pow(10, 2 + visc01 * 6)).toExponential(1)} Pa·s</div>
                </div>
                <div className="rounded-xl bg-white/[0.04] p-2 text-center border border-white/[0.06]">
                  <div className="text-[10px] font-bold text-slate-500">مؤشر الانفجار VEI</div>
                  <div className="font-display text-sm font-black" style={{ color: styleColor }}>{vei}</div>
                </div>
              </div>
              <div className="rounded-xl border p-2.5 text-center" style={{ borderColor: `${styleColor}44`, background: `${styleColor}11` }}>
                <div className="text-[10px] font-bold text-slate-400 mb-0.5">النمط المتوقع للثوران</div>
                <div className="font-display text-[15px] font-black" style={{ color: styleColor }}>{style}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={toggle} className={`btn flex-1 ${erupting ? "btn-danger" : "btn-primary"}`}>
                  {erupting ? <><Square className="size-4" /> إيقاف الثوران</> : <><Play className="size-4" /> تفجير البركان</>}
                </button>
                <button onClick={() => { setErupting(false); stopRumble(); resetRef.current(); }} className="btn btn-ghost" title="إعادة الضبط">
                  <RotateCcw className="size-4" />
                </button>
              </div>
            </div>
          </Panel>
        </div>

        {/* مفتاح العناصر */}
        <div className="absolute bottom-3 left-3 hidden sm:block">
          <div className="glass rounded-xl px-3 py-2.5 space-y-1.5 max-w-[240px]">
            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-300"><span className="size-2 rounded-full bg-zinc-400" /> عمود الرماد البركاني</div>
            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-300"><span className="size-2 rounded-full bg-orange-500" /> القنابل النارية والحمم</div>
            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-300"><span className="size-2 rounded-full bg-red-400" /> خزان الماغما والمدخنة (المقطع)</div>
          </div>
        </div>

        <div className="absolute bottom-3 right-3 hidden md:block">
          <div className="glass rounded-xl px-3 py-2 text-[11px] text-slate-400 flex items-center gap-2 max-w-[300px]">
            <AlertTriangle className="size-4 text-ember shrink-0" />
            <span>كلما زادت السيليكا احتُبست الغازات أكثر، فيتحول الثوران من تدفق هادئ إلى انفجار كارثي</span>
          </div>
        </div>

        {erupting && (
          <div className="absolute left-3 top-3 anim-fade-in">
            <Badge color={styleColor}><Wind className="size-3.5" /> ثوران {style} نشط الآن</Badge>
          </div>
        )}
        {!erupting && (
          <div className="absolute left-3 top-3">
            <Badge color="#4ade80"><Gauge className="size-3.5" /> البركان خامل — اضغط «تفجير البركان»</Badge>
          </div>
        )}
      </div>
    </div>
  );
}
