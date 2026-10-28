import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Layers, RotateCw, MousePointerClick, Thermometer, Gauge, Ruler, FlaskConical, Info } from "lucide-react";
import { earthLayers, type EarthLayer } from "../data/content";
import { simState } from "../store";
import { PageHeader, SliderRow, Panel, InfoRow, Badge } from "./ui";
import earthTex from "../assets/earth.jpg";

export default function EarthLayers() {
  const mountRef = useRef<HTMLDivElement>(null);
  const groupsRef = useRef<THREE.Group[]>([]);
  const pickablesRef = useRef<THREE.Mesh[]>([]);
  const matByLayer = useRef<Map<string, THREE.MeshStandardMaterial[]>>(new Map());
  const [explode, setExplode] = useState(0);
  const explodeTarget = useRef(0);
  const [selected, setSelected] = useState<EarthLayer | null>(null);
  const selectedRef = useRef<string | null>(null);
  const [spin, setSpin] = useState(true);
  const controlsRef = useRef<OrbitControls | null>(null);

  const select = useCallback((layer: EarthLayer | null) => {
    setSelected(layer);
    selectedRef.current = layer ? layer.id : null;
    simState.earthLayer = layer ? layer.name : null;
    // تحديث التوهج
    matByLayer.current.forEach((mats, id) => {
      const on = layer && id === layer.id;
      mats.forEach((m) => {
        m.emissiveIntensity = on ? 0.85 : (id === "inner-core" ? 0.7 : id === "outer-core" ? 0.45 : 0.05);
      });
    });
  }, []);

  useEffect(() => {
    const mount = mountRef.current!;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05060a);

    const camera = new THREE.PerspectiveCamera(42, mount.clientWidth / mount.clientHeight, 0.1, 600);
    camera.position.set(17, 9, 20);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 12;
    controls.maxDistance = 90;
    controls.autoRotate = spin;
    controls.autoRotateSpeed = 0.7;
    controlsRef.current = controls;

    // إضاءة
    scene.add(new THREE.AmbientLight(0x8899bb, 0.75));
    const key = new THREE.DirectionalLight(0xfff2dd, 2.4);
    key.position.set(14, 10, 18);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x3b6ea5, 1.1);
    rim.position.set(-16, 4, -14);
    scene.add(rim);

    // نجوم
    {
      const n = 900;
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const v = new THREE.Vector3().randomDirection().multiplyScalar(190 + Math.random() * 120);
        pos.set([v.x, v.y, v.z], i * 3);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const m = new THREE.PointsMaterial({ color: 0x9fb4d8, size: 0.55, sizeAttenuation: true, transparent: true, opacity: 0.8 });
      scene.add(new THREE.Points(g, m));
    }

    // نسيج القشرة
    const tex = new THREE.TextureLoader().load(earthTex);
    tex.colorSpace = THREE.SRGBColorSpace;

    const PHI = Math.PI * 0.22;
    const PLEN = Math.PI * 1.56;

    groupsRef.current = [];
    pickablesRef.current = [];
    matByLayer.current.clear();

    earthLayers.forEach((layer, i) => {
      const group = new THREE.Group();
      const rO = layer.rOuter;
      const rI = layer.rInner;
      const isCore = layer.id === "inner-core" || layer.id === "outer-core";

      // الغلاف الخارجي
      const outerGeo = new THREE.SphereGeometry(rO, 96, 64, PHI, PLEN);
      const outerMat = new THREE.MeshStandardMaterial({
        color: layer.id === "crust" ? 0xffffff : layer.color,
        map: layer.id === "crust" ? tex : null,
        roughness: 0.9, metalness: 0.05, side: THREE.FrontSide,
        emissive: new THREE.Color(layer.color),
        emissiveIntensity: isCore ? (layer.id === "inner-core" ? 0.7 : 0.45) : 0.05,
      });
      const outer = new THREE.Mesh(outerGeo, outerMat);
      outer.userData.layerId = layer.id;
      group.add(outer);
      pickablesRef.current.push(outer);

      // الوجه الداخلي للغلاف (لإيهام السماكة)
      const innerGeo = new THREE.SphereGeometry(rO, 64, 42, PHI, PLEN);
      const innerMat = new THREE.MeshStandardMaterial({
        color: layer.innerColor, roughness: 1, side: THREE.BackSide,
        emissive: new THREE.Color(layer.innerColor),
        emissiveIntensity: isCore ? 0.55 : 0.12,
      });
      group.add(new THREE.Mesh(innerGeo, innerMat));

      // وجها المقطع — حلقات ملونة
      if (rI > 0) {
        const ringGeo = new THREE.RingGeometry(rI, rO, 72, 1, -Math.PI / 2, Math.PI);
        const ringMat = new THREE.MeshStandardMaterial({
          color: layer.color, roughness: 0.75, side: THREE.DoubleSide,
          emissive: new THREE.Color(layer.color),
          emissiveIntensity: isCore ? 0.6 : 0.12,
        });
        const r1 = new THREE.Mesh(ringGeo, ringMat);
        r1.rotation.y = -PHI;
        group.add(r1);
        const r2 = new THREE.Mesh(ringGeo.clone(), ringMat.clone());
        r2.rotation.y = -(PHI + PLEN);
        group.add(r2);
        matByLayer.current.set(layer.id, [...(matByLayer.current.get(layer.id) || []), outerMat, ringMat]);
      } else {
        matByLayer.current.set(layer.id, [outerMat]);
      }

      group.userData.index = i;
      groupsRef.current.push(group);
      scene.add(group);
    });

    // توهج شمسي خلفي خفيف
    const glowGeo = new THREE.SphereGeometry(0.1, 8, 8);
    glowGeo.dispose();

    // النقر
    const ray = new THREE.Raycaster();
    const ptr = new THREE.Vector2();
    const onClick = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      ptr.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ptr.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      ray.setFromCamera(ptr, camera);
      const hits = ray.intersectObjects(pickablesRef.current, false);
      if (hits.length > 0) {
        const id = hits[0].object.userData.layerId as string;
        const layer = earthLayers.find((l) => l.id === id) || null;
        select(selectedRef.current === id ? null : layer);
      }
    };
    renderer.domElement.addEventListener("click", onClick);

    // حلقة الرسم
    let raf = 0;
    let prevMs = performance.now();
    const startMs = prevMs;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const nowMs = performance.now();
      prevMs = nowMs;
      const t = (nowMs - startMs) / 1000;
      // تفكيك مرن
      const cur = groupsRef.current[0]?.userData.ex ?? 0;
      const next = cur + (explodeTarget.current - cur) * 0.08;
      groupsRef.current.forEach((g, i) => {
        g.userData.ex = next;
        g.position.x = i === 0 ? 0 : next * i * 2.6;
        g.position.y = Math.sin(t * 0.8 + i) * 0.05;
      });
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
        if (o instanceof THREE.Mesh || o instanceof THREE.Points) {
          o.geometry.dispose();
          const m = o.material as THREE.Material | THREE.Material[];
          (Array.isArray(m) ? m : [m]).forEach((mm) => mm.dispose());
        }
      });
      tex.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [select]);

  useEffect(() => { explodeTarget.current = explode; simState.explode = explode; }, [explode]);
  useEffect(() => { if (controlsRef.current) controlsRef.current.autoRotate = spin; }, [spin]);

  return (
    <div className="anim-page flex h-full flex-col">
      <PageHeader icon={Layers} title="محاكاة طبقات الأرض" sub="نموذج مقطعي ثلاثي الأبعاد — اسحب للتدوير، وانقر على أي طبقة لاستكشافها" />

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/[0.07] bg-[#05060a]">
        <div ref={mountRef} className="absolute inset-0" />

        {/* لوحة التحكم */}
        <div className="absolute right-3 top-3 w-[270px] max-w-[calc(100%-24px)]">
          <Panel title="غرفة التحكم" icon={Gauge}>
            <div className="space-y-4">
              <SliderRow label="مقياس التفكيك الطبقي" value={explode} display={`${Math.round(explode * 100)}%`}
                min={0} max={1} step={0.01} onChange={setExplode} hint="وسّع الطبقات في الفضاء لرؤية بنيتها الداخلية" />
              <button className={`btn w-full ${spin ? "btn-primary" : "btn-ghost"}`} onClick={() => setSpin(!spin)}>
                <RotateCw className="size-4" /> {spin ? "إيقاف الدوران التلقائي" : "تشغيل الدوران التلقائي"}
              </button>
              <div className="space-y-1.5 border-t border-white/[0.07] pt-3">
                <p className="text-[11px] font-bold text-slate-400">اختر طبقة لعرض بياناتها:</p>
                <div className="flex flex-wrap gap-1.5">
                  {earthLayers.map((l) => (
                    <button key={l.id} onClick={() => select(selected?.id === l.id ? null : l)}
                      className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-bold transition-all cursor-pointer border ${selected?.id === l.id ? "border-magma/60 bg-magma/15 text-orange-200" : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"}`}>
                      <span className="size-2.5 rounded-full" style={{ background: l.color, boxShadow: `0 0 8px ${l.color}` }} />
                      {l.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Panel>
        </div>

        {/* بطاقة معلومات الطبقة */}
        {selected && (
          <div key={selected.id} className="anim-fade-up absolute left-3 top-3 w-[290px] max-w-[calc(100%-24px)]">
            <Panel className="border-white/[0.12]">
              <div className="mb-2 flex items-center gap-2">
                <span className="size-4 rounded-full shrink-0" style={{ background: selected.color, boxShadow: `0 0 14px ${selected.color}` }} />
                <h3 className="font-display text-base font-black text-white">{selected.name}</h3>
              </div>
              <div className="mb-2 flex gap-1.5 flex-wrap">
                <Badge color={selected.color}>{selected.state}</Badge>
                <Badge color="#38bdf8">عمق: {selected.depthKm}</Badge>
              </div>
              <div className="space-y-1.5">
                <InfoRow icon={Thermometer} k="درجة الحرارة" v={selected.temp} />
                <InfoRow icon={Gauge} k="الضغط" v={selected.pressure} />
                <InfoRow icon={Ruler} k="السماكة" v={selected.thickness} />
                <InfoRow icon={FlaskConical} k="التركيب" v={selected.composition} />
              </div>
              <div className="mt-2.5 rounded-xl border border-ember/25 bg-ember/[0.07] p-2.5">
                <p className="text-[12px] leading-relaxed text-amber-100/90"><span className="font-black text-ember">هل تعلم؟ </span>{selected.fact}</p>
              </div>
            </Panel>
          </div>
        )}

        {!selected && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
            <div className="scene-tag !px-3.5 !py-2 text-[12px]">
              <MousePointerClick className="size-4 text-magma" /> انقر على أي طبقة داخل النموذج لاستكشاف خصائصها
            </div>
          </div>
        )}

        {/* مقياس الحرارة */}
        <div className="absolute bottom-3 right-3 hidden md:block">
          <div className="glass rounded-xl px-3 py-2">
            <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold text-slate-400"><Info className="size-3" /> مقياس الحرارة نحو المركز</div>
            <div className="flex items-center gap-0.5" dir="ltr">
              {["#38bdf8", "#4ade80", "#fbbf24", "#f97316", "#ef4444", "#fde68a"].map((c) => (
                <span key={c} className="h-2 w-6 rounded-sm" style={{ background: c }} />
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[9px] font-bold text-slate-500" dir="ltr"><span>15°م</span><span>6000°م</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
