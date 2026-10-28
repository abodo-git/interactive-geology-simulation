import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Globe2, RotateCw, Tags, Gauge, Navigation2 } from "lucide-react";
import { plates, boundaries, boundaryTypeAr, boundaryColors, type Plate } from "../data/content";
import { simState } from "../store";
import { PageHeader, Panel, Badge } from "./ui";
import earthTex from "../assets/earth.jpg";

const R = 10;
function llToVec(lat: number, lon: number, r: number): THREE.Vector3 {
  const phi = (lat * Math.PI) / 180;
  const lam = (lon * Math.PI) / 180;
  return new THREE.Vector3(r * Math.cos(phi) * Math.cos(lam), r * Math.sin(phi), -r * Math.cos(phi) * Math.sin(lam));
}
function makeLabel(text: string, color: string): THREE.Sprite {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "rgba(6,8,12,0.82)";
  g.beginPath();
  g.roundRect(64, 26, 384, 76, 22);
  g.fill();
  g.strokeStyle = color; g.lineWidth = 3;
  g.beginPath(); g.roundRect(64, 26, 384, 76, 22); g.stroke();
  g.fillStyle = "#f1f5f9";
  g.font = "bold 40px Cairo, Tajawal, sans-serif";
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(text, 256, 66);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
  s.scale.set(6.4, 1.6, 1);
  return s;
}

export default function Plates() {
  const mountRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<THREE.Mesh | null>(null);
  const [selected, setSelected] = useState<Plate | null>(null);
  const selectedRef = useRef<Plate | null>(null);
  const [spin, setSpin] = useState(true);
  const [labels, setLabels] = useState(true);
  const labelsGroupRef = useRef<THREE.Group | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  useEffect(() => {
    const mount = mountRef.current!;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x04060b);

    const camera = new THREE.PerspectiveCamera(42, mount.clientWidth / mount.clientHeight, 0.1, 800);
    camera.position.set(2, 12, 26);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 13;
    controls.maxDistance = 60;
    controls.autoRotate = spin;
    controls.autoRotateSpeed = 0.55;
    controlsRef.current = controls;

    scene.add(new THREE.AmbientLight(0xaabbdd, 0.85));
    const sun = new THREE.DirectionalLight(0xfff1d6, 2.6);
    sun.position.set(26, 14, 18);
    scene.add(sun);

    // نجوم
    {
      const n = 1100;
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(220 + Math.random() * 260); pos.set([v.x, v.y, v.z], i * 3); }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xb8c8e8, size: 0.9, transparent: true, opacity: 0.85 })));
    }

    // الكرة الأرضية
    const tex = new THREE.TextureLoader().load(earthTex);
    tex.colorSpace = THREE.SRGBColorSpace;
    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(R, 128, 96),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0.05 })
    );
    globeRef.current = globe;
    scene.add(globe);

    // الغلاف الجوي
    const atmo = new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.055, 64, 48),
      new THREE.MeshBasicMaterial({ color: 0x3d7bd6, transparent: true, opacity: 0.12, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    scene.add(atmo);

    const overlay = new THREE.Group();
    globe.add(overlay);

    // حدود الصفائح
    const slerpPts = (a: THREE.Vector3, b: THREE.Vector3, n: number, r: number) => {
      const out: THREE.Vector3[] = [];
      const an = a.clone().normalize(), bn = b.clone().normalize();
      const angle = an.angleTo(bn);
      if (angle < 1e-4) return [a.clone()];
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const s1 = Math.sin((1 - t) * angle) / Math.sin(angle);
        const s2 = Math.sin(t * angle) / Math.sin(angle);
        out.push(an.clone().multiplyScalar(s1).add(bn.clone().multiplyScalar(s2)).normalize().multiplyScalar(r));
      }
      return out;
    };
    boundaries.forEach((b) => {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i < b.pts.length - 1; i++) {
        const seg = slerpPts(llToVec(b.pts[i][0], b.pts[i][1], 1), llToVec(b.pts[i + 1][0], b.pts[i + 1][1], 1), 10, R * 1.012);
        pts.push(...(i === 0 ? seg : seg.slice(1)));
      }
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: boundaryColors[b.type], transparent: true, opacity: 0.95 }));
      overlay.add(line);
      // نقاط متوهجة على الحدود
      const pg = new THREE.BufferGeometry().setFromPoints(pts.filter((_, i) => i % 3 === 0));
      const pm = new THREE.PointsMaterial({ color: boundaryColors[b.type], size: 0.16, transparent: true, opacity: 0.9 });
      overlay.add(new THREE.Points(pg, pm));
    });

    // أسهم الاتجاهات والتسميات
    const labelsGroup = new THREE.Group();
    labelsGroupRef.current = labelsGroup;
    globe.add(labelsGroup);
    plates.forEach((p) => {
      const center = llToVec(p.lat, p.lon, R * 1.02);
      // الاتجاه على المستوي المماسي
      const east = new THREE.Vector3(-Math.sin((p.lon * Math.PI) / 180), 0, -Math.cos((p.lon * Math.PI) / 180)).normalize();
      const north = new THREE.Vector3().crossVectors(center.clone().normalize(), east).negate().normalize();
      const rad = (p.dirDeg * Math.PI) / 180;
      const dir = east.clone().multiplyScalar(Math.sin(rad)).add(north.clone().multiplyScalar(Math.cos(rad))).normalize();
      const spd = parseFloat(p.speed);
      const len = 1.6 + Math.min(2.4, spd * 0.26);
      const arrow = new THREE.ArrowHelper(dir, center, len, 0xffa94d, len * 0.34, len * 0.2);
      (arrow.line.material as THREE.LineBasicMaterial).linewidth = 3;
      overlay.add(arrow);
      const lbl = makeLabel(p.name, "#f97316");
      lbl.position.copy(center.clone().normalize().multiplyScalar(R * 1.14));
      lbl.position.y += 0.9;
      labelsGroup.add(lbl);
    });

    // النقر للاختيار
    const ray = new THREE.Raycaster();
    const ptr = new THREE.Vector2();
    const onClick = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      ptr.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ptr.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      ray.setFromCamera(ptr, camera);
      const hit = ray.intersectObject(globe, false)[0];
      if (!hit) return;
      const local = globe.worldToLocal(hit.point.clone()).normalize();
      let best: Plate | null = null;
      let bestD = 1e9;
      plates.forEach((p) => {
        const d = local.angleTo(llToVec(p.lat, p.lon, 1));
        if (d < bestD) { bestD = d; best = p; }
      });
      if (best) {
        const bb = best as Plate;
        if (selectedRef.current?.id === bb.id) {
          setSelected(null); selectedRef.current = null; simState.plate = null;
        } else {
          setSelected(bb); selectedRef.current = bb; simState.plate = bb.name;
        }
      }
    };
    renderer.domElement.addEventListener("click", onClick);

    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
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
      renderer.domElement.removeEventListener("click", onClick);
      controls.dispose();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Points || o instanceof THREE.Line || o instanceof THREE.Sprite) {
          (o.geometry as THREE.BufferGeometry)?.dispose?.();
          const m = o.material as THREE.Material | THREE.Material[];
          (Array.isArray(m) ? m : [m]).forEach((mm) => mm.dispose());
        }
      });
      tex.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (controlsRef.current) controlsRef.current.autoRotate = spin; }, [spin]);
  useEffect(() => { if (labelsGroupRef.current) labelsGroupRef.current.visible = labels; }, [labels]);

  return (
    <div className="anim-page flex h-full flex-col">
      <PageHeader icon={Globe2} title="الصفائح التكتونية والانجراف القاري" sub="كرة أرضية تفاعلية — انقر على أي موقع لاستكشاف الصفيحة وحركتها وسرعتها" accent="#38bdf8" />
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/[0.07] bg-[#04060b]">
        <div ref={mountRef} className="absolute inset-0" />

        <div className="absolute right-3 top-3 w-[270px] max-w-[calc(100%-24px)] space-y-3 max-h-[calc(100%-24px)] overflow-y-auto">
          <Panel title="أنواع الحدود" icon={Navigation2}>
            <div className="space-y-2">
              {(Object.keys(boundaryTypeAr) as (keyof typeof boundaryTypeAr)[]).map((k) => (
                <div key={k} className="flex items-center gap-2.5">
                  <span className="h-1.5 w-7 rounded-full" style={{ background: boundaryColors[k], boxShadow: `0 0 10px ${boundaryColors[k]}` }} />
                  <div>
                    <div className="text-[12px] font-black text-slate-200">{boundaryTypeAr[k]}</div>
                    <div className="text-[10px] text-slate-500">{k === "divergent" ? "توليد قشرة جديدة — ظهور محيطية" : k === "convergent" ? "انغماس — خنادق وجبال وبراكين" : "انزلاق جانبي — زلازل ضحلة عنيفة"}</div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
          <div className="flex gap-2">
            <button className={`btn flex-1 ${spin ? "btn-primary" : "btn-ghost"}`} onClick={() => setSpin(!spin)}>
              <RotateCw className="size-4" /> دوران
            </button>
            <button className={`btn flex-1 ${labels ? "btn-primary" : "btn-ghost"}`} onClick={() => setLabels(!labels)}>
              <Tags className="size-4" /> الأسماء
            </button>
          </div>
          {selected && (
            <div className="anim-fade-up">
              <Panel className="border-sky-400/20">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <h3 className="font-display text-[15px] font-black text-white">{selected.name}</h3>
                  <Badge color="#38bdf8">{selected.kind}</Badge>
                </div>
                <div className="mb-2 flex items-center gap-2 text-[12px] font-bold text-amber-300">
                  <Gauge className="size-3.5" /> سرعة الانجراف: {selected.speed}
                </div>
                <p className="text-[12px] leading-relaxed text-slate-300">{selected.note}</p>
              </Panel>
            </div>
          )}
        </div>

        <div className="absolute bottom-3 right-3 left-3 sm:left-auto">
          <div className="scene-tag !px-3.5 !py-2 text-[12px]">
            <Navigation2 className="size-4 text-ember" /> الأسهم البرتقالية تُظهر اتجاه حركة كل صفيحة وطولها يعبّر عن السرعة
          </div>
        </div>
      </div>
    </div>
  );
}
