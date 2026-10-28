import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Activity, Zap, RotateCcw, MoveHorizontal, ArrowDownUp, ChevronsUp, FileWarning, Gauge, Clock, ArrowDown } from "lucide-react";
import { simState, type FaultType } from "../store";
import { setRumble, stopRumble, crash } from "../audio";
import { PointCloud } from "../three/pfx";
import { PageHeader, SliderRow, Panel, Seg } from "./ui";
import rockTexUrl from "../assets/rock.jpg";

// ---------- دوال مساعدة للرسم ----------
function groundCanvas(): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#6a6b4a"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 260; i++) {
    g.fillStyle = ["#5d6b40", "#77694a", "#6f7350", "#7d7154", "#66684a"][i % 5];
    g.globalAlpha = 0.25 + Math.random() * 0.3;
    const s = 6 + Math.random() * 26;
    g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, s, 0, 7); g.fill();
  }
  g.globalAlpha = 1;
  for (let i = 0; i < 900; i++) {
    g.fillStyle = Math.random() > 0.5 ? "#565a3c" : "#7c7458";
    g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function strataCanvas(): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = 256; c.height = 128;
  const g = c.getContext("2d")!;
  const bands = ["#4a3b2a", "#3a2d20", "#54432f", "#2f261b", "#5d4a33", "#42331f", "#372a1c", "#4f3e2b"];
  bands.forEach((col, i) => {
    g.fillStyle = col;
    const y = (i / bands.length) * 128;
    g.fillRect(0, y, 256, 128 / bands.length + 1);
    g.strokeStyle = "rgba(0,0,0,0.35)";
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= 256; x += 16) g.lineTo(x, y + Math.sin(x * 0.09 + i * 2.4) * 2.2);
    g.stroke();
  });
  for (let i = 0; i < 500; i++) { g.fillStyle = "rgba(0,0,0,0.18)"; g.fillRect(Math.random() * 256, Math.random() * 128, 2, 1); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function asphaltCanvas(): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = 256; c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = "#2c2e31"; g.fillRect(0, 0, 256, 64);
  for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(${140 + Math.random() * 60},${140 + Math.random() * 60},${140 + Math.random() * 60},0.09)`; g.fillRect(Math.random() * 256, Math.random() * 64, 1.6, 1.6); }
  g.fillStyle = "#e8c247";
  for (let x = 4; x < 256; x += 32) g.fillRect(x, 30, 18, 3.5);
  g.fillStyle = "#cfd3d8"; g.fillRect(0, 4, 256, 2.5); g.fillRect(0, 57, 256, 2.5);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}
function paintFacade(c: HTMLCanvasElement, base: string, cols: number, rows: number, crackLevel: number, seed: number) {
  const g = c.getContext("2d")!;
  const W = c.width, H = c.height;
  g.fillStyle = base; g.fillRect(0, 0, W, H);
  // تدرج إضاءة واتساخ
  g.fillStyle = "rgba(0,0,0,0.14)"; g.fillRect(0, 0, W, H * 0.16);
  g.fillStyle = "rgba(0,0,0,0.2)"; g.fillRect(0, H - H * 0.07, W, H * 0.07);
  const rh = H / rows;
  for (let r = 0; r < rows; r++) {
    g.fillStyle = "rgba(255,255,255,0.13)";
    g.fillRect(0, r * rh + rh - 2, W, 2);
    for (let co = 0; co < cols; co++) {
      const wx = (co + 0.22) * (W / cols);
      const ww = (W / cols) * 0.56;
      const wy = r * rh + rh * 0.2;
      const wh = rh * 0.58;
      g.fillStyle = "#3a4757"; g.fillRect(wx, wy, ww, wh);
      const lit = ((Math.sin(seed * 13.7 + r * 7.1 + co * 3.3) * 43758.5) % 1 + 1) % 1 > 0.72;
      g.fillStyle = lit ? "#ffd98a" : "#141c28";
      g.fillRect(wx + 2, wy + 2, ww - 4, wh - 4);
      g.strokeStyle = "#0d1117"; g.lineWidth = 2;
      g.beginPath(); g.moveTo(wx + ww / 2, wy); g.lineTo(wx + ww / 2, wy + wh); g.moveTo(wx, wy + wh / 2); g.lineTo(wx + ww, wy + wh / 2); g.stroke();
      if (crackLevel >= 2 && ((r * 3 + co * 7 + seed) % 5) < 2) {
        g.strokeStyle = "rgba(230,230,230,0.55)"; g.lineWidth = 1;
        g.beginPath(); g.moveTo(wx + ww / 2, wy + wh / 2);
        g.lineTo(wx + ww * 0.2, wy + wh * 0.15); g.moveTo(wx + ww / 2, wy + wh / 2); g.lineTo(wx + ww * 0.8, wy + wh * 0.8); g.stroke();
      }
    }
  }
  if (crackLevel >= 1) {
    g.strokeStyle = "rgba(20,12,6,0.85)";
    const cracks = crackLevel >= 2 ? 5 : 2;
    for (let k = 0; k < cracks; k++) {
      g.lineWidth = 1.4 + ((k + seed) % 3);
      let x = ((Math.sin(seed * 3.1 + k * 17.7) * 1000) % 1 + 1) % 1 * W;
      let y = 0;
      g.beginPath(); g.moveTo(x, y);
      while (y < H * (0.5 + ((k + seed) % 3) * 0.22)) {
        x += (Math.sin(y * 0.4 + k * 9 + seed) * 9);
        y += 7 + ((k * 13 + seed * 7) % 9);
        g.lineTo(x, y);
      }
      g.stroke();
    }
  }
}

interface Building {
  group: THREE.Group; segLow: THREE.Group; segTop: THREE.Group | null;
  texLow: THREE.CanvasTexture; canvasLow: HTMLCanvasElement;
  texTop: THREE.CanvasTexture | null; canvasTop: HTMLCanvasElement | null;
  baseColor: string; cols: number; rowsLow: number; rowsTop: number;
  block: "L" | "R"; h: number; fragility: number;
  health: number; state: 0 | 1 | 2; crackLevel: number;
  sway: number; swayV: number; topple: number; dir: number; seed: number;
  x: number; z: number;
  topple2: number;
}

const FAULT_INFO: Record<FaultType, { name: string; desc: string }> = {
  strike: { name: "انزلاقي أفقي", desc: "تنزلق الكتلتان جانبياً — لاحظ إزاحة الطريق والسياج بعد الزلزال" },
  normal: { name: "عادي (تمددي)", desc: "تهبط الكتلة المعلّقة ويتّسع الصدع — تمدد القشرة" },
  reverse: { name: "معكوس (انضغاطي)", desc: "تركب الكتلة المعلّقة فوق جارتها — انضغاط يولّد أعنف الزلازل" },
};

// ===== نموذج التوهين الزلزالي (مبسّط من GMPE) =====
// يحسب PGA التقريبي (بوحدة g) بناءً على Mw وعمق البؤرة (كم)
// المسافة الأفقية مفترضة ~5 كم (المباني قريبة من الإبيسنتر)
function estimatePGA(mw: number, depthKm: number): number {
  // المسافة الهيبوسنترية = √(depth² + epicDist²)
  const epicDist = 5;
  const Rhypo = Math.sqrt(depthKm * depthKm + epicDist * epicDist);
  // معادلة توهين مبسّطة مستوحاة من Boore-Atkinson:
  // log₁₀(PGA) ≈ -1.7 + 0.55·Mw - 1.35·log₁₀(Rhypo) - 0.003·Rhypo
  const logPGA = -1.7 + 0.55 * mw - 1.35 * Math.log10(Math.max(1, Rhypo)) - 0.003 * Rhypo;
  // تشبّع عند 2.5g (الحد الأقصى المسجل فعلياً في أقوى الزلازل)
  return Math.min(2.5, Math.pow(10, logPGA));
}

// وصف الشدة بالعربية يعتمد على PGA المحسوب
function mmiFromPGA(pgaG: number): { label: string; color: string } {
  if (pgaG < 0.002) return { label: "ضعيف جداً — بالكاد يُسجَّل", color: "#22c55e" };
  if (pgaG < 0.014) return { label: "ضعيف — يُحس داخلياً فقط", color: "#4ade80" };
  if (pgaG < 0.039) return { label: "خفيف — تهتز الأثاث والنوافذ", color: "#a3e635" };
  if (pgaG < 0.092) return { label: "متوسط — تتشقق جدران بعض المباني", color: "#fbbf24" };
  if (pgaG < 0.18) return { label: "قوي — أضرار خفيفة بالمباني الضعيفة", color: "#fb923c" };
  if (pgaG < 0.34) return { label: "شديد — أضرار متوسطة بمبانٍ غير مقاومة", color: "#f97316" };
  if (pgaG < 0.65) return { label: "مدمّر — انهيارات جزئية بالمباني", color: "#ef4444" };
  if (pgaG < 1.24) return { label: "كارثي — دمار واسع واقع", color: "#dc2626" };
  return { label: "هائل — تدمير شبه شامل", color: "#991b1b" };
}

export default function Earthquake() {
  const mountRef = useRef<HTMLDivElement>(null);
  const seismoRef = useRef<HTMLCanvasElement>(null);
  const [mag, setMag] = useState(5.5);
  const [depth, setDepth] = useState(15);   // كم
  const [duration, setDuration] = useState(20); // ثانية
  const [fault, setFault] = useState<FaultType>("strike");
  const [active, setActive] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [pga, setPga] = useState(0);
  const stateRef = useRef({ mag: 5.5, fault: "strike" as FaultType, depth: 15, duration: 20 });
  const apiRef = useRef<{ trigger: () => void; reset: () => void }>({ trigger: () => {}, reset: () => {} });

  useEffect(() => {
    stateRef.current = { mag, fault, depth, duration };
    simState.quake.fault = fault; simState.quake.mag = mag;
    simState.quake.depth = depth; simState.quake.duration = duration;
  }, [mag, fault, depth, duration]);

  const expectedPGA = useMemo(() => estimatePGA(mag, depth), [mag, depth]);
  const mmi = useMemo(() => mmiFromPGA(expectedPGA), [expectedPGA]);
  const depthLabel = depth <= 70 ? "ضحل" : depth <= 300 ? "متوسط العمق" : "عميق";

  useEffect(() => {
    const mount = mountRef.current!;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a2030);
    scene.fog = new THREE.Fog(0x1a2030, 85, 240);

    const camera = new THREE.PerspectiveCamera(46, mount.clientWidth / mount.clientHeight, 0.1, 600);
    camera.position.set(30, 22, 34);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.5, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 14;
    controls.maxDistance = 110;
    controls.maxPolarAngle = Math.PI * 0.52;

    // إضاءة غروب
    scene.add(new THREE.AmbientLight(0x8fa0c0, 0.75));
    const sun = new THREE.DirectionalLight(0xffd9a8, 2.1);
    sun.position.set(34, 30, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -42; sun.shadow.camera.right = 42;
    sun.shadow.camera.top = 42; sun.shadow.camera.bottom = -42;
    sun.shadow.camera.far = 120;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0x5a6d96, 0.7);
    fill.position.set(-30, 18, -24);
    scene.add(fill);

    const quakeWorld = new THREE.Group();
    scene.add(quakeWorld);

    // أنسجة
    const gTex = groundCanvas();
    const sTex = strataCanvas();
    const aTex = asphaltCanvas();
    const loader = new THREE.TextureLoader();
    const rockTex = loader.load(rockTexUrl);
    rockTex.colorSpace = THREE.SRGBColorSpace;

    // التضاريس الواسعة
    const terrainMap = groundCanvas();
    terrainMap.repeat.set(24, 24);
    const terrain = new THREE.Mesh(new THREE.CircleGeometry(200, 64), new THREE.MeshStandardMaterial({ map: terrainMap, color: 0x8d8a6e, roughness: 1 }));
    terrain.rotation.x = -Math.PI / 2;
    terrain.position.y = -6.05;
    quakeWorld.add(terrain);

    // الكتلتان التكتونيتان
    gTex.repeat.set(5, 3);
    const mkBlockMats = () => {
      const mkSide = () => {
        const t = strataCanvas();
        t.repeat.set(4, 1);
        return new THREE.MeshStandardMaterial({ map: t, roughness: 1 });
      };
      const topMap = groundCanvas();
      topMap.repeat.set(6, 4);
      const top = new THREE.MeshStandardMaterial({ map: topMap, color: 0xb0ad88, roughness: 1 });
      const bot = new THREE.MeshStandardMaterial({ color: 0x2a2118 });
      return [mkSide(), mkSide(), top, bot, mkSide(), mkSide()];
    };
    const blockL = new THREE.Mesh(new THREE.BoxGeometry(26, 6, 34), mkBlockMats());
    blockL.position.set(-13.6, -3.01, 0);
    blockL.receiveShadow = true; blockL.castShadow = true;
    const blockR = new THREE.Mesh(new THREE.BoxGeometry(26, 6, 34), mkBlockMats());
    blockR.position.set(13.6, -3.01, 0);
    blockR.receiveShadow = true; blockR.castShadow = true;
    const grpL = new THREE.Group(); grpL.add(blockL);
    const grpR = new THREE.Group(); grpR.add(blockR);
    quakeWorld.add(grpL, grpR);

    // شق الفالق الداكن
    const fissure = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 34), new THREE.MeshBasicMaterial({ color: 0x050403 }));
    fissure.rotation.x = -Math.PI / 2;
    fissure.rotation.z = Math.PI / 2;
    fissure.position.set(0, 0.02, 0);
    quakeWorld.add(fissure);

    // الطريق
    const roadMat = new THREE.MeshStandardMaterial({ map: aTex, roughness: 0.95 });
    const mkRoad = (len: number) => new THREE.Mesh(new THREE.PlaneGeometry(len, 4.4), roadMat);
    const roadL = mkRoad(27); roadL.rotation.x = -Math.PI / 2; roadL.position.set(-13.6, 0.06, 5); roadL.receiveShadow = true;
    const roadR = mkRoad(27); roadR.rotation.x = -Math.PI / 2; roadR.position.set(13.6, 0.06, 5); roadR.receiveShadow = true;
    grpL.add(roadL); grpR.add(roadR);

    // سياج يعبر الفالق يُظهر الإزاحة
    const fenceMat = new THREE.MeshStandardMaterial({ color: 0x7c5b3a, roughness: 0.9 });
    for (let i = 0; i <= 16; i++) {
      const x = -13 + i * 1.625;
      if (Math.abs(x) < 0.9) continue;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 6), fenceMat);
      post.position.set(x, 0.45, -6);
      post.castShadow = true;
      if (x < 0) grpL.add(post); else grpR.add(post);
    }
    const railL = new THREE.Mesh(new THREE.BoxGeometry(12.4, 0.07, 0.07), fenceMat);
    railL.position.set(-6.9, 0.78, -6);
    grpL.add(railL);
    const railR = railL.clone();
    railR.position.x = 6.9;
    grpR.add(railR);

    // امتدادات أرضية محيطة بالكتلتين لدمج المشهد مع التضاريس
    const apronMat = new THREE.MeshStandardMaterial({ map: gTex, color: 0x9a9778, roughness: 1 });
    const apron = (grp: THREE.Group, x0: number, x1: number, z0: number, z1: number) => {
      const w = x1 - x0, d = z1 - z0;
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), apronMat);
      p.rotation.x = -Math.PI / 2;
      p.position.set((x0 + x1) / 2, -0.02, (z0 + z1) / 2);
      p.receiveShadow = true;
      grp.add(p);
    };
    apron(grpL, -26.6, -0.6, 17, 62);
    apron(grpR, 0.6, 26.6, 17, 62);
    apron(grpL, -26.6, -0.6, -62, -17);
    apron(grpR, 0.6, 26.6, -62, -17);
    apron(grpL, -110, -26.6, -62, 62);
    apron(grpR, 26.6, 110, -62, 62);

    // أشجار
    const trunkM = new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 1 });
    const leafM = new THREE.MeshStandardMaterial({ color: 0x2e4224, roughness: 1 });
    const treePos: [number, number][] = [[-20, 14], [-9, -13], [-3.5, 12.5], [4, -12], [11, 13], [21, -3], [-22, -5], [17, -14]];
    treePos.forEach(([x, z], i) => {
      const t = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 1.4, 7), trunkM);
      trunk.position.y = 0.7;
      const crown = new THREE.Mesh(new THREE.ConeGeometry(1.15, 2.6, 8), leafM);
      crown.position.y = 2.5;
      crown.castShadow = true;
      t.add(trunk, crown);
      const s = 0.85 + (i % 3) * 0.3;
      t.scale.setScalar(s);
      t.position.set(x, 0, z);
      if (x < -0.8) grpL.add(t); else grpR.add(t);
    });

    // ===== المباني =====
    const buildings: Building[] = [];
    const palettes = ["#d9c9a8", "#c8b8a0", "#b3aca0", "#cfa56e", "#bd9270", "#dcd6c8"];
    const mkBuilding = (bx: number, bz: number, floors: number, w: number, d: number, block: "L" | "R", quality: number) => {
      const floorH = 2.6;
      const h = floors * floorH;
      const seed = Math.floor(Math.random() * 97) + 3;
      const base = palettes[(bx * 7 + bz * 3 + floors) & 5] ?? palettes[0];
      const cols = Math.max(2, Math.round(w / 1.7));
      const rowsLow = Math.ceil(floors / 2);
      const rowsTop = floors - rowsLow;
      const group = new THREE.Group();
      const lowH = rowsLow * floorH;
      const topH = rowsTop * floorH;

      // الأساس
      const found = new THREE.Mesh(new THREE.BoxGeometry(w + 1.1, 0.3, d + 1.1), new THREE.MeshStandardMaterial({ color: 0x54504a, roughness: 1 }));
      found.position.y = 0.15;
      found.receiveShadow = true;
      group.add(found);

      // الجزء السفلي
      const canvasLow = document.createElement("canvas");
      canvasLow.width = 128; canvasLow.height = rowsLow * 40;
      paintFacade(canvasLow, base, cols, rowsLow, 0, seed);
      const texLow = new THREE.CanvasTexture(canvasLow);
      texLow.colorSpace = THREE.SRGBColorSpace;
      const matLow = new THREE.MeshStandardMaterial({ map: texLow, roughness: 0.92 });
      const segLow = new THREE.Group();
      const lowMesh = new THREE.Mesh(new THREE.BoxGeometry(w, lowH, d), matLow);
      lowMesh.position.y = lowH / 2;
      lowMesh.castShadow = true; lowMesh.receiveShadow = true;
      segLow.add(lowMesh);
      segLow.position.y = 0.3;
      group.add(segLow);

      // الجزء العلوي
      let segTop: THREE.Group | null = null;
      let texTop: THREE.CanvasTexture | null = null;
      let canvasTop: HTMLCanvasElement | null = null;
      if (rowsTop > 0) {
        canvasTop = document.createElement("canvas");
        canvasTop.width = 128; canvasTop.height = rowsTop * 40;
        paintFacade(canvasTop, base, cols, rowsTop, 0, seed + 5);
        texTop = new THREE.CanvasTexture(canvasTop);
        texTop.colorSpace = THREE.SRGBColorSpace;
        const matTop = new THREE.MeshStandardMaterial({ map: texTop, roughness: 0.92 });
        segTop = new THREE.Group();
        const topMesh = new THREE.Mesh(new THREE.BoxGeometry(w, topH, d), matTop);
        topMesh.position.y = topH / 2;
        topMesh.castShadow = true;
        segTop.add(topMesh);
        // سقف
        if (floors <= 2) {
          const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.72, 1.4, 4), new THREE.MeshStandardMaterial({ color: 0x7a4a30, roughness: 1 }));
          roof.rotation.y = Math.PI / 4;
          roof.position.y = topH + 0.7;
          roof.castShadow = true;
          segTop.add(roof);
        } else {
          const slab = new THREE.Mesh(new THREE.BoxGeometry(w + 0.25, 0.22, d + 0.25), new THREE.MeshStandardMaterial({ color: 0x6b6560 }));
          slab.position.y = topH + 0.11;
          const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.8, 10), new THREE.MeshStandardMaterial({ color: 0x8b949e }));
          tank.position.set(w * 0.2, topH + 0.6, d * 0.15);
          segTop.add(slab, tank);
        }
        segTop.position.y = lowH + 0.3;
        group.add(segTop);
      }

      group.position.set(bx, 0, bz);
      group.rotation.y = ((seed % 5) - 2) * 0.03;
      (block === "L" ? grpL : grpR).add(group);
      const distFault = Math.abs(bx);
      const fragility = quality * (1 / (1 + distFault * 0.05)) * (0.85 + (seed % 10) / 28);
      buildings.push({
        group, segLow, segTop, texLow, canvasLow, texTop, canvasTop,
        baseColor: base, cols, rowsLow, rowsTop,
        block, h, fragility, health: 1, state: 0, crackLevel: 0,
        sway: 0, swayV: 0, topple: 0, dir: block === "L" ? -1 : 1, seed,
        x: bx, z: bz, topple2: 0,
      });
    };
    // مبانٍ واقعية متنوعة
    mkBuilding(-5, 1.4, 4, 5.4, 4.6, "L", 0.9);
    mkBuilding(-11, 10, 2, 5, 4, "L", 1.1);
    mkBuilding(-17, -7, 1, 4.6, 4, "L", 1.2);
    mkBuilding(-8, -10.5, 6, 6, 5, "L", 0.75);
    mkBuilding(-19, 8.5, 3, 5, 4.4, "L", 0.85);
    mkBuilding(5.2, -1.8, 5, 5.6, 4.8, "R", 0.8);
    mkBuilding(11, 9.6, 2, 5, 4.2, "R", 1.05);
    mkBuilding(18, -8, 1, 4.4, 3.8, "R", 1.2);
    mkBuilding(7.4, -11, 7, 6.2, 5.2, "R", 0.62);
    mkBuilding(20, 7.6, 3, 5.4, 4.6, "R", 0.95);

    // خزان ماء
    const tower = new THREE.Group();
    const tankLeg = new THREE.MeshStandardMaterial({ color: 0x6a7076, roughness: 0.7, metalness: 0.5 });
    for (let i = 0; i < 4; i++) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3.4, 6), tankLeg);
      leg.position.set(Math.cos(i * Math.PI / 2 + Math.PI / 4) * 0.9, 1.7, Math.sin(i * Math.PI / 2 + Math.PI / 4) * 0.9);
      leg.castShadow = true;
      tower.add(leg);
    }
    const tankBody = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 2.2, 16), new THREE.MeshStandardMaterial({ map: rockTex, color: 0x9aa4ad, roughness: 0.6, metalness: 0.3 }));
    tankBody.position.y = 4.4;
    tankBody.castShadow = true;
    tower.add(tankBody);
    tower.position.set(-1.5, 0, -12);
    grpL.add(tower);
    let towerFallen = 0;

    // الحطام
    const DEB_N = 320;
    const debris = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x8f8a80, roughness: 1 }), DEB_N);
    debris.frustumCulled = false;
    quakeWorld.add(debris);
    interface Deb { alive: boolean; x: number; y: number; z: number; vx: number; vy: number; vz: number; s: number; rx: number; rz: number; sleep: boolean }
    const debs: Deb[] = Array.from({ length: DEB_N }, () => ({ alive: false, x: 0, y: -99, z: 0, vx: 0, vy: 0, vz: 0, s: 0.5, rx: 0, rz: 0, sleep: false }));
    const M4 = new THREE.Matrix4();
    const Q = new THREE.Quaternion();
    const E = new THREE.Euler();
    const hideAllDebris = () => debs.forEach((d, i) => { d.alive = false; d.sleep = false; M4.makeScale(0, 0, 0); M4.setPosition(0, -99, 0); debris.setMatrixAt(i, M4); });
    hideAllDebris();
    const spawnDebris = (wx: number, wy: number, wz: number, n: number) => {
      let spawned = 0;
      for (const d of debs) {
        if (spawned >= n) break;
        if (d.alive && !d.sleep) continue;
        const a = Math.random() * Math.PI * 2;
        Object.assign(d, {
          alive: true, sleep: false,
          x: wx + (Math.random() - 0.5) * 1.4, y: wy + Math.random() * 0.8, z: wz + (Math.random() - 0.5) * 1.4,
          vx: Math.cos(a) * (1 + Math.random() * 3.2), vy: 1.5 + Math.random() * 4, vz: Math.sin(a) * (1 + Math.random() * 3.2),
          s: 0.22 + Math.random() * 0.55, rx: Math.random() * 6, rz: Math.random() * 6,
        });
        spawned++;
      }
    };

    // غبار
    const dust = new PointCloud(900, false);
    quakeWorld.add(dust.points);
    interface Dp { alive: boolean; x: number; y: number; z: number; vx: number; vy: number; vz: number; age: number; max: number }
    const dps: Dp[] = Array.from({ length: 900 }, () => ({ alive: false, x: 0, y: -99, z: 0, vx: 0, vy: 0, vz: 0, age: 0, max: 1 }));
    let dustCursor = 0;
    const spawnDust = (x: number, y: number, z: number, n: number, big = false) => {
      for (let k = 0; k < n; k++) {
        const i = dustCursor; dustCursor = (dustCursor + 1) % dps.length;
        const p = dps[i];
        const a = Math.random() * Math.PI * 2;
        Object.assign(p, { alive: true, x, y: y + 0.3, z, vx: Math.cos(a) * (1 + Math.random() * (big ? 5 : 2.2)), vy: 0.8 + Math.random() * (big ? 3.6 : 1.6), vz: Math.sin(a) * (1 + Math.random() * (big ? 5 : 2.2)), age: 0, max: 1.6 + Math.random() * 2.2 });
      }
    };

    // الموجات الزلزالية
    interface Wave { mesh: THREE.Mesh; age: number; max: number; speed: number; kind: string }
    const waves: Wave[] = [];
    const spawnWaves = () => {
      const mkSphere = (color: number) => new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.85 }));
      const p = mkSphere(0x38bdf8); p.position.set(0, -7.5, 17);
      const s = mkSphere(0xfbbf24); s.position.set(0, -7.5, 17);
      quakeWorld.add(p, s);
      waves.push({ mesh: p, age: 0, max: 3.6, speed: 15, kind: "p" }, { mesh: s, age: -0.4, max: 6.5, speed: 8, kind: "s" });
      for (let i = 0; i < 3; i++) {
        const r = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 64), new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
        r.rotation.x = -Math.PI / 2;
        r.position.set(0, 0.12 + i * 0.05, 0);
        quakeWorld.add(r);
        waves.push({ mesh: r, age: -0.6 - i * 0.5, max: 8, speed: 4.6, kind: "surf" });
      }
    };

    // علامة البؤرة على واجهة المقطع
    const hypo = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), new THREE.MeshBasicMaterial({ color: 0xff4444 }));
    hypo.position.set(0, -7.5, 17.02);
    quakeWorld.add(hypo);
    const hypoHalo = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.72, 24), new THREE.MeshBasicMaterial({ color: 0xff6644, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    hypoHalo.position.copy(hypo.position);
    hypoHalo.position.z += 0.02;
    quakeWorld.add(hypoHalo);

    // أفق المدينة والجبال
    for (let i = 0; i < 26; i++) {
      const az = (i / 26) * Math.PI * 2 + 0.12;
      const rr = 130 + (i % 4) * 22;
      const hh = 14 + ((i * 37) % 19);
      const mnt = new THREE.Mesh(new THREE.ConeGeometry(hh * 1.7, hh, 6), new THREE.MeshStandardMaterial({ color: 0x141a26, roughness: 1 }));
      mnt.position.set(Math.cos(az) * rr, hh / 2 - 6, Math.sin(az) * rr);
      scene.add(mnt);
    }

    // ===== منطق الزلزال =====
    let quakeT = -1, quakeDur = 0, quakeMag = 5.5, quakeFault: FaultType = "strike";
    let quakeDepth = 15, quakeDuration = 20;
    let peakPGA = 0; // PGA ذروي محسوب من نموذج التوهين (ثابت طوال الهزة)
    let perm = 0; // إزاحة دائمة حالية
    let permTarget = 0;
    let maxPgaLive = 0; // أعلى PGA لحظي مقاس
    let hasReported = true;
    const seismoData: number[][] = [[], [], []];
    let lastCrash = 0;

    apiRef.current.trigger = () => {
      if (quakeT >= 0) return;
      const st = stateRef.current;
      quakeMag = st.mag;
      quakeFault = st.fault;
      quakeDepth = st.depth;
      quakeDuration = st.duration;
      quakeT = 0;
      // مدة المحاكاة: نضغط الزمن ليناسب العرض — 5 ثوان حد أدنى + تناسب مع المدة
      quakeDur = Math.max(5, 3 + quakeDuration * 0.22);
      // حساب PGA بنموذج التوهين
      peakPGA = estimatePGA(quakeMag, quakeDepth);
      maxPgaLive = 0;
      hasReported = false;
      // الإزاحة الدائمة تعتمد على الشدة (لوغاريتمية) وتقل مع العمق
      const depthFactor = Math.max(0.1, 1 - quakeDepth / 400);
      permTarget = quakeMag >= 5 ? Math.min(4, 0.001 * Math.pow(10, quakeMag * 0.5) * depthFactor) : 0;
      spawnWaves();
      setActive(true);
      simState.quake.active = true;
    };
    apiRef.current.reset = () => {
      quakeT = -1; perm = 0; permTarget = 0;
      stopRumble();
      setActive(false); setPga(0);
      simState.quake.active = false; simState.quake.lastReport = null;
      buildings.forEach((b) => {
        b.health = 1; b.state = 0; b.crackLevel = 0; b.sway = 0; b.swayV = 0; b.topple = 0; b.topple2 = 0;
        b.group.rotation.set(0, ((b.seed % 5) - 2) * 0.03, 0);
        b.segLow.rotation.set(0, 0, 0); b.segLow.position.set(0, 0.3, 0);
        paintFacade(b.canvasLow, b.baseColor, b.cols, b.rowsLow, 0, b.seed);
        b.texLow.needsUpdate = true;
        if (b.segTop && b.canvasTop && b.texTop) {
          b.segTop.rotation.set(0, 0, 0); b.segTop.position.y = b.rowsLow * 2.6 + 0.3; b.segTop.position.x = 0;
          paintFacade(b.canvasTop, b.baseColor, b.cols, b.rowsTop, 0, b.seed + 5);
          b.texTop.needsUpdate = true;
        }
      });
      towerFallen = 0;
      tower.rotation.set(0, 0, 0); tower.position.set(-1.5, 0, -12);
      hideAllDebris(); debris.instanceMatrix.needsUpdate = true;
      dps.forEach((p) => (p.alive = false));
      grpL.position.set(0, 0, 0); grpR.position.set(0, 0, 0);
      setReport(null);
    };

    let raf = 0;
    let seismoTimer = 0;
    let prevMs = performance.now();
    const startMs = prevMs;

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const nowMs = performance.now();
      const dt = Math.min(0.05, (nowMs - prevMs) / 1000);
      prevMs = nowMs;
      const t = (nowMs - startMs) / 1000;

      // ---- حركة الأرض ----
      // peakPGA: PGA ذروي محسوب من نموذج التوهين (g)
      // amp: سعة الإزاحة البصرية — نحوّل PGA(g) إلى بكسلات المشهد
      // المقياس البصري: PGA 0.01g ≈ 0.03 وحدة، PGA 1g ≈ 3 وحدات
      let amp = 0, env = 0;
      if (quakeT >= 0) {
        quakeT += dt;
        amp = peakPGA * 3.0; // تحويل g → وحدات المشهد
        const up = Math.min(1, quakeT / 1.2);
        const decay = Math.exp(-Math.max(0, quakeT - quakeDur * 0.35) / (quakeDur * 0.45));
        env = up * decay * (quakeT < quakeDur ? 1 : 0);
        if (quakeT >= quakeDur) {
          quakeT = -1; env = 0;
          stopRumble();
          setActive(false);
          simState.quake.active = false;
          if (!hasReported) {
            hasReported = true;
            const total = buildings.filter((b) => b.state === 2).length;
            const part = buildings.filter((b) => b.state === 1).length;
            const ok = buildings.length - total - part;
            const depthLbl = quakeDepth <= 70 ? "ضحل" : quakeDepth <= 300 ? "متوسط" : "عميق";
            const rep = `شدة ${quakeMag.toFixed(1)} Mw • عمق ${depthLbl} (${quakeDepth} كم) • مدة ${quakeDuration} ث • فالق ${FAULT_INFO[quakeFault].name}: انهيار كلي ${total}، جزئي ${part}، سليم ${ok} — إزاحة دائمة ${(perm * 100).toFixed(0)} سم، أعلى PGA ${maxPgaLive.toFixed(3)}g`;
            setReport(rep);
            simState.quake.lastReport = rep;
          }
        }
      }
      const disp = quakeT >= 0 ? amp * env * (Math.sin(quakeT * 6.3) + 0.6 * Math.sin(quakeT * 11.7) + 0.8 * Math.sin(quakeT * 3.1) + 0.45 * Math.sin(quakeT * 17.3)) : 0;
      const vel = quakeT >= 0 ? amp * env * (6.3 * Math.cos(quakeT * 6.3) + 7 * Math.cos(quakeT * 11.7) + 2.5 * Math.cos(quakeT * 3.1) + 7.8 * Math.cos(quakeT * 17.3)) : 0;
      const vert = quakeT >= 0 ? amp * env * 0.5 * Math.sin(quakeT * 9.4 + 1.3) : 0;
      // PGA لحظي (بوحدة g): نسبة من vel المطلقة إلى amp الأقصى
      const velAbs = Math.abs(vel);
      const curPgaG = amp > 0.001 ? peakPGA * (velAbs / (amp * 24.2)) : 0;

      // تطبيق الحركة على الكتل حسب نوع الفالق
      if (quakeFault === "strike") {
        perm += (permTarget - perm) * dt * 0.5;
        grpL.position.set(disp * 0.5, 0, -disp * 0.4 - perm / 2);
        grpR.position.set(disp * 0.5, vert * 0.15, disp * 0.4 + perm / 2);
      } else if (quakeFault === "normal") {
        perm += (permTarget - perm) * dt * 0.5;
        grpL.position.set(disp * 0.5, 0, disp * 0.15);
        grpR.position.set(disp * 0.5 + perm * 0.35, -perm * 0.55 + vert * 0.3, disp * 0.15);
      } else {
        perm += (permTarget * 0.7 - perm) * dt * 0.5;
        grpL.position.set(disp * 0.5, 0, disp * 0.15);
        grpR.position.set(disp * 0.5 - perm * 0.55, perm * 0.4 + vert * 0.35 + velAbs * 0.005, disp * 0.15);
      }
      fissure.visible = true;
      fissure.scale.set(1 + perm * (quakeFault === "normal" ? 1.4 : 0.2), 1, 1);
      // عرض PGA
      if (quakeT >= 0) {
        maxPgaLive = Math.max(maxPgaLive, curPgaG);
        setPga(curPgaG);
        setRumble(Math.min(1, curPgaG * 3.5), 5);
      } else if (pga !== 0) setPga(0);

      hypoHalo.scale.setScalar(1 + ((t * 1.6) % 1) * 1.6);
      (hypoHalo.material as THREE.MeshBasicMaterial).opacity = 0.85 - ((t * 1.6) % 1) * 0.85;

      // ---- المباني ----
      // فيزياء الأضرار الواقعية:
      // • PGA < 0.05g: لا أضرار إطلاقاً (زلازل < ~4.5 Mw ضحلة)
      // • PGA 0.05–0.15g: تشققات سطحية فقط (شعرية)
      // • PGA 0.15–0.35g: أضرار إنشائية تبدأ، انهيار جزئي للمباني الضعيفة
      // • PGA > 0.35g: انهيارات كلية تبعاً لجودة البناء
      // المدة تزيد الضرر التراكمي
      const durFactor = 0.6 + (quakeDuration / 120) * 0.8; // 0.6 لـ 5 ث → 1.4 لـ 120 ث
      for (const b of buildings) {
        if (quakeT >= 0 && b.state < 2) {
          // التمايل البندولي — يتناسب مع سعة الموجة
          const w0 = 2 * Math.PI * (6.5 / b.h);
          b.swayV += (-(w0 * w0) * b.sway - 2 * 0.08 * w0 * b.swayV + vel * b.h * 0.01) * dt;
          b.sway += b.swayV * dt;
          b.group.rotation.z = b.sway;
          b.group.rotation.x = b.sway * 0.4 * Math.sin(t * 2.2 + b.seed);

          // إجهاد المبنى: يعتمد على PGA (g) مباشرة بدل vel الخام
          // المبنى يبدأ بصحة 1.0 وينقص بالتناسب مع شدة PGA
          // عتبة البدء: لا ضرر إذا PGA < 0.04g (≈ Mw 4.5 ضحل)
          if (curPgaG > 0.04) {
            // سرعة نقصان الصحة تعتمد على: PGA فوق العتبة × هشاشة المبنى × مضاعف المدة
            const excess = curPgaG - 0.04;
            const stressRate = excess * b.fragility * durFactor * 0.65;
            b.health -= stressRate * dt;
          }

          const newCrack = b.health < 0.45 ? 2 : b.health < 0.75 ? 1 : 0;
          if (newCrack !== b.crackLevel && b.state === 0) {
            b.crackLevel = newCrack;
            paintFacade(b.canvasLow, b.baseColor, b.cols, b.rowsLow, b.crackLevel, b.seed);
            b.texLow.needsUpdate = true;
            if (b.canvasTop && b.texTop) { paintFacade(b.canvasTop, b.baseColor, b.cols, b.rowsTop, b.crackLevel, b.seed + 5); b.texTop.needsUpdate = true; }
            spawnDust(b.x, b.h * 0.5, b.z, 6);
          }
          if (b.health < 0.40 && b.state === 0 && b.segTop) {
            b.state = 1;
            if (t - lastCrash > 0.7) { crash(); lastCrash = t; }
          }
          if (b.health < 0.08 && b.state <= 1) {
            b.state = 2;
            if (t - lastCrash > 0.5) { crash(); lastCrash = t; }
            spawnDebris(b.x + (b.block === "L" ? -13.6 + 13.6 : 0), 1, b.z, 2);
          }
        }
        // حركة الانهيار
        if (b.state >= 1 && b.segTop && b.topple < 1) {
          b.topple = Math.min(1, b.topple + dt * (0.7 + (1 - b.health)));
          const e = 1 - Math.pow(1 - b.topple, 3);
          b.segTop.rotation.z = b.dir * e * (1.05 + (b.seed % 3) * 0.16);
          b.segTop.rotation.y = e * ((b.seed % 7) - 3) * 0.1;
          b.segTop.position.y = b.rowsLow * 2.6 + 0.3 - e * e * (b.rowsTop * 2.6 * 0.55);
          b.segTop.position.x = b.dir * e * 1.6;
          if (b.topple > 0.55 && !b.segTop.userData.debbed) {
            b.segTop.userData.debbed = true;
            const wp = new THREE.Vector3();
            b.segTop.getWorldPosition(wp);
            spawnDebris(wp.x, wp.y, wp.z, 14);
            spawnDust(b.x + b.dir * 2, 1, b.z, 26, true);
            if (t - lastCrash > 0.4) { crash(); lastCrash = t; }
          }
        }
        if (b.state === 2 && b.topple2 < 1) {
          b.topple2 = Math.min(1, b.topple2 + dt * 0.8);
          const e = 1 - Math.pow(1 - b.topple2, 3);
          b.segLow.rotation.z = -b.dir * e * 1.35;
          b.segLow.rotation.x = e * ((b.seed % 5) - 2) * 0.12;
          b.segLow.position.y = 0.3 - e * (b.rowsLow * 2.6 * 0.5);
          b.segLow.position.x = -b.dir * e * 1.2;
          if (b.topple2 > 0.5 && !b.segLow.userData.debbed) {
            b.segLow.userData.debbed = true;
            spawnDebris(b.x, 1.2, b.z, 20);
            spawnDust(b.x, 0.8, b.z, 34, true);
            if (t - lastCrash > 0.4) { crash(); lastCrash = t; }
          }
        }
      }

      // خزان الماء يسقط في الهزات العنيفة (PGA > 0.3g)
      if (quakeT >= 0 && curPgaG > 0.3 && towerFallen === 0) {
        towerFallen = 1;
        crash();
      }
      if (towerFallen > 0 && towerFallen < 1) {
        towerFallen = Math.min(1, towerFallen + dt * 0.85);
        const e = 1 - Math.pow(1 - towerFallen, 3);
        tower.rotation.z = e * 1.5;
        tower.position.y = -e * 0.4;
        if (towerFallen >= 1 && !tower.userData.debbed) {
          tower.userData.debbed = true;
          spawnDebris(-1.5, 1, -12, 16);
          spawnDust(-1.5, 1, -12, 30, true);
        }
      }

      // الحطام
      for (let i = 0; i < DEB_N; i++) {
        const d = debs[i];
        if (!d.alive || d.sleep) continue;
        d.vy -= 15 * dt;
        d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
        d.rx += dt * 4; d.rz += dt * 3;
        const rest = d.s / 2 + 0.02;
        if (d.y < rest) {
          d.y = rest;
          if (Math.abs(d.vy) > 1.2) { d.vy *= -0.28; d.vx *= 0.6; d.vz *= 0.6; }
          else { d.sleep = true; d.vy = 0; }
        }
        E.set(d.rx, 0, d.rz);
        Q.setFromEuler(E);
        M4.compose(new THREE.Vector3(d.x, d.y, d.z), Q, new THREE.Vector3(d.s, d.s, d.s));
        debris.setMatrixAt(i, M4);
      }
      debris.instanceMatrix.needsUpdate = true;

      // الغبار
      for (let i = 0; i < dps.length; i++) {
        const p = dps[i];
        if (!p.alive) { dust.hide(i); continue; }
        p.age += dt;
        if (p.age > p.max) { p.alive = false; dust.hide(i); continue; }
        p.vy -= 1.8 * dt;
        p.vx *= 1 - 0.8 * dt; p.vz *= 1 - 0.8 * dt;
        p.x += p.vx * dt; p.y = Math.max(0.25, p.y + p.vy * dt); p.z += p.vz * dt;
        const a01 = p.age / p.max;
        dust.set(i, p.x, p.y, p.z, 1.1 + p.age * 2.6, 0.4 * Math.min(1, a01 * 9) * (1 - a01), 0.66, 0.6, 0.5);
      }
      dust.commit();

      // الموجات
      for (let i = waves.length - 1; i >= 0; i--) {
        const w = waves[i];
        w.age += dt;
        if (w.age < 0) continue;
        const r = w.age * w.speed;
        if (w.age > w.max) {
          quakeWorld.remove(w.mesh);
          w.mesh.geometry.dispose();
          (w.mesh.material as THREE.Material).dispose();
          waves.splice(i, 1);
          continue;
        }
        w.mesh.scale.setScalar(Math.max(0.01, r));
        (w.mesh.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - w.age / w.max);
      }

      // السيزموجراف
      seismoTimer += dt;
      if (seismoTimer > 0.033) {
        seismoTimer = 0;
        const noise = quakeT >= 0 ? 0 : Math.sin(t * 8) * 0.02 + Math.sin(t * 23) * 0.012;
        seismoData[0].push(vel * 0.05 + noise);
        seismoData[1].push(disp * 0.65 + noise * 0.5);
        seismoData[2].push(vert * 0.8 + noise * 0.3);
        seismoData.forEach((ch) => { if (ch.length > 340) ch.shift(); });
        const cvs = seismoRef.current;
        if (cvs) {
          const g = cvs.getContext("2d")!;
          const W = cvs.width, H = cvs.height;
          g.fillStyle = "#0a0c10"; g.fillRect(0, 0, W, H);
          g.strokeStyle = "rgba(255,255,255,0.05)";
          g.lineWidth = 1;
          for (let x = 0; x < W; x += 20) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
          for (let y = 0; y < H; y += 15) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
          const cols = ["#38bdf8", "#fbbf24", "#ef4444"];
          const names = ["X", "Y", "Z"];
          seismoData.forEach((ch, ci) => {
            const cy = (H / 3) * ci + H / 6;
            g.strokeStyle = cols[ci];
            g.lineWidth = 1.4;
            g.beginPath();
            ch.forEach((v, i) => {
              const x = (i / 340) * W;
              const y = cy - Math.max(-1.6, Math.min(1.6, v)) * (H / 6.4);
              if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
            });
            g.stroke();
            g.fillStyle = cols[ci];
            g.font = "bold 9px Tajawal";
            g.fillText(names[ci], 4, cy - H / 6 + 11);
          });
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
      stopRumble();
      controls.dispose();
      dust.dispose();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Points) {
          o.geometry.dispose();
          const m = o.material as THREE.Material | THREE.Material[];
          (Array.isArray(m) ? m : [m]).forEach((mm) => mm.dispose());
        }
      });
      gTex.dispose(); sTex.dispose(); aTex.dispose(); rockTex.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="anim-page flex h-full flex-col">
      <PageHeader icon={Activity} title="محاكي الزلازل والفوالق" sub="اختبر أنواع الفوالق وشدة الزلزال وشاهد استجابة المباني الواقعية للهزات" accent="#ef4444" />
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/[0.07] bg-[#1a2030]">
        <div ref={mountRef} className="absolute inset-0" />

        {/* لوحة التحكم */}
        <div className="absolute right-3 top-3 w-[292px] max-w-[calc(100%-24px)] max-h-[calc(100%-24px)] overflow-y-auto">
          <Panel title="غرفة التحكم الزلزالي" icon={Gauge}>
            <div className="space-y-3">
              <div>
                <p className="mb-1.5 text-[13px] font-bold text-slate-300">نوع الفالق</p>
                <Seg<FaultType> value={fault} onChange={setFault}
                  options={[
                    { v: "strike", label: "انزلاقي", icon: MoveHorizontal },
                    { v: "normal", label: "عادي", icon: ArrowDownUp },
                    { v: "reverse", label: "معكوس", icon: ChevronsUp },
                  ]} />
                <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">{FAULT_INFO[fault].desc}</p>
              </div>
              <SliderRow label="مقياس ريختر (العزم Mw)" value={mag} display={`${mag.toFixed(1)} Mw`} min={1} max={9.5} step={0.1}
                onChange={setMag} tone="gold" hint="لوغاريتمي: كل درجة = 32 ضعف الطاقة" />
              <SliderRow label="عمق البؤرة (كم)" value={depth} display={`${depth} كم — ${depthLabel}`} min={5} max={700} step={5}
                onChange={setDepth} tone="cool"
                hint={depth <= 70 ? "بؤرة ضحلة: موجات سطحية قوية وأضرار مركّزة" : depth <= 300 ? "عمق متوسط: الموجات تتوهن أكثر" : "بؤرة عميقة: تُحس على مسافات بعيدة لكن أضرارها أقل"} />
              <SliderRow label="مدة الهزة (ثانية)" value={duration} display={`${duration} ث`} min={5} max={120} step={5}
                onChange={setDuration}
                hint="المدة تزيد الضرر التراكمي — زلزال تركيا 2023 استمر 75 ث" />
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-white/[0.04] p-2 text-center border border-white/[0.06]">
                  <div className="text-[10px] font-bold text-slate-500 flex items-center justify-center gap-1"><Gauge className="size-3" /> PGA المتوقع</div>
                  <div className="font-display text-sm font-black" style={{ color: mmi.color }}>{expectedPGA < 0.001 ? expectedPGA.toExponential(1) : expectedPGA.toFixed(3)} g</div>
                </div>
                <div className="rounded-xl bg-white/[0.04] p-2 text-center border border-white/[0.06]">
                  <div className="text-[10px] font-bold text-slate-500 flex items-center justify-center gap-1"><Clock className="size-3" /> مدة المحاكاة</div>
                  <div className="font-display text-sm font-black text-slate-200">{Math.round(Math.max(5, 3 + duration * 0.22))} ث</div>
                </div>
              </div>
              <div className="rounded-xl border p-2.5 text-center" style={{ borderColor: `${mmi.color}44`, background: `${mmi.color}11` }}>
                <div className="text-[10px] font-bold text-slate-400">الشدة المتوقعة على السطح</div>
                <div className="font-display text-[13px] font-black" style={{ color: mmi.color }}>{mmi.label}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => apiRef.current.trigger()} disabled={active} className="btn btn-danger flex-1">
                  <Zap className="size-4" /> {active ? "الأرض تهتز الآن..." : "إطلاق الزلزال"}
                </button>
                <button onClick={() => apiRef.current.reset()} className="btn btn-ghost" title="إعادة البناء">
                  <RotateCcw className="size-4" />
                </button>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-white/[0.04] px-3 py-2 border border-white/[0.06]">
                <span className="text-[11px] font-bold text-slate-400">التسارع الأرضي PGA الآن</span>
                <span className="font-display text-sm font-black text-red-300">{pga < 0.001 ? pga.toExponential(1) : pga.toFixed(3)} g</span>
              </div>
              {/* شريط تعليمي مختصر */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5 text-[10.5px] leading-relaxed text-slate-400">
                <ArrowDown className="inline size-3 text-wave ml-1" /> <b className="text-slate-300">عمق البؤرة</b> يخفف الموجات السطحية: 5 كم ← دمار مركّز، 300+ كم ← يُحس لكن دون أضرار تُذكر.
                <br /><Clock className="inline size-3 text-ember ml-1 mt-0.5" /> <b className="text-slate-300">المدة</b> تضاعف الضرر التراكمي: 10 ث قد تسقط بعض المباني، 90 ث تسقط الباقي.
              </div>
            </div>
          </Panel>

          {report && (
            <div className="mt-3 anim-fade-up">
              <Panel title="تقرير الأضرار" icon={FileWarning}>
                <p className="text-[12px] leading-relaxed text-slate-300">{report}</p>
              </Panel>
            </div>
          )}
        </div>

        {/* السيزموجراف */}
        <div className="absolute left-3 bottom-3 right-3 sm:right-auto sm:w-[400px]">
          <div className="glass rounded-2xl p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex size-2.5">
                  <span className={`absolute inline-flex h-full w-full rounded-full ${active ? "bg-red-500" : "bg-emerald-500"} opacity-60`} style={{ animation: "pingRing 1.6s infinite" }} />
                  <span className={`relative inline-flex size-2.5 rounded-full ${active ? "bg-red-500" : "bg-emerald-500"}`} />
                </span>
                <span className="text-[11px] font-black text-slate-200">راسم الموجات السيزمي — تسجيل مباشر</span>
              </div>
              <div className="flex gap-2 text-[9px] font-bold text-slate-400">
                <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-sky-400" />P/X</span>
                <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-amber-400" />S/Y</span>
                <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-red-400" />سطحي/Z</span>
              </div>
            </div>
            <canvas ref={seismoRef} width={380} height={120} className="w-full rounded-lg border border-white/[0.08]" />
          </div>
        </div>

        {/* مفتاح الموجات */}
        <div className="absolute left-3 top-3 hidden lg:block">
          <div className="glass rounded-xl px-3 py-2.5 space-y-1.5">
            <div className="text-[10px] font-black text-slate-400 mb-1">الموجات المنبعثة من البؤرة</div>
            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-300"><span className="size-2 rounded-full bg-sky-400" /> P — أولية سريعة</div>
            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-300"><span className="size-2 rounded-full bg-amber-400" /> S — ثانوية قصّية</div>
            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-300"><span className="size-2 rounded-full bg-red-500" /> سطحية — الأكثر تدميراً</div>
          </div>
        </div>
      </div>
    </div>
  );
}
