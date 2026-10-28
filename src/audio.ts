// محرك صوتي فيزيائي مولّد بالكامل عبر Web Audio API — بدون ملفات خارجية
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

// عناصر الهدير المستمر
let rumbleGain: GainNode | null = null;
let rumbleFilter: BiquadFilterNode | null = null;
let rumbleLfo: OscillatorNode | null = null;
let rumbleLfoGain: GainNode | null = null;

function ensure(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export function initAudio() {
  ensure();
}

export function setMuted(m: boolean) {
  muted = m;
  if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.05);
}
export function isMuted() { return muted; }

function noiseBuffer(c: AudioContext, seconds: number, brown = false): AudioBuffer {
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    } else d[i] = w;
  }
  return buf;
}

/** هدير أرضي مستمر منخفض التردد — v من 0 إلى 1 */
export function setRumble(v: number, lfoRate = 0) {
  const c = ensure();
  if (!c || !master) return;
  const t = c.currentTime;
  if (!rumbleGain) {
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c, 3, true);
    src.loop = true;
    rumbleFilter = c.createBiquadFilter();
    rumbleFilter.type = "lowpass";
    rumbleFilter.frequency.value = 90;
    rumbleFilter.Q.value = 0.8;
    rumbleGain = c.createGain();
    rumbleGain.gain.value = 0;
    src.connect(rumbleFilter); rumbleFilter.connect(rumbleGain); rumbleGain.connect(master);
    src.start();
    rumbleLfo = c.createOscillator();
    rumbleLfo.frequency.value = 0;
    rumbleLfoGain = c.createGain();
    rumbleLfoGain.gain.value = 0;
    rumbleLfo.connect(rumbleLfoGain); rumbleLfoGain.connect(rumbleGain.gain);
    rumbleLfo.start();
  }
  const g = Math.min(0.85, v * 0.7);
  rumbleGain.gain.setTargetAtTime(g, t, 0.12);
  rumbleFilter!.frequency.setTargetAtTime(50 + v * 160, t, 0.2);
  if (rumbleLfo && rumbleLfoGain) {
    rumbleLfo.frequency.setTargetAtTime(lfoRate, t, 0.2);
    rumbleLfoGain.gain.setTargetAtTime(lfoRate > 0 ? g * 0.5 : 0, t, 0.2);
  }
}

export function stopRumble() {
  if (ctx && rumbleGain) rumbleGain.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
}

/** انفجار بركاني — قوة من 0 إلى 1 */
export function explosion(power: number) {
  const c = ensure();
  if (!c || !master || muted) return;
  const t = c.currentTime;
  const p = Math.max(0.05, Math.min(1, power));

  // ضجيج الانفجار
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, 2.4);
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(3200 * p + 400, t);
  lp.frequency.exponentialRampToValueAtTime(120, t + 1.6);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.55 * p + 0.08, t + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8 + p);
  src.connect(lp); lp.connect(g); g.connect(master);
  src.start(t); src.stop(t + 3);

  // موجة تحت صوتية هابطة
  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(120 + 60 * p, t);
  osc.frequency.exponentialRampToValueAtTime(28, t + 1.4);
  const og = c.createGain();
  og.gain.setValueAtTime(0.5 * p, t);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
  osc.connect(og); og.connect(master);
  osc.start(t); osc.stop(t + 1.7);
}

/** فرقعة/تمرّر صخري قصير */
export function crash() {
  const c = ensure();
  if (!c || !master || muted) return;
  const t = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, 0.6);
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 300 + Math.random() * 500;
  bp.Q.value = 0.7;
  const g = c.createGain();
  g.gain.setValueAtTime(0.35, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
  src.connect(bp); bp.connect(g); g.connect(master);
  src.start(t); src.stop(t + 0.6);

  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(90, t);
  osc.frequency.exponentialRampToValueAtTime(35, t + 0.35);
  const og = c.createGain();
  og.gain.setValueAtTime(0.3, t);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
  osc.connect(og); og.connect(master);
  osc.start(t); osc.stop(t + 0.45);
}

/** نقرة واجهة خفيفة */
export function blip(freq = 660) {
  const c = ensure();
  if (!c || !master || muted) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  o.type = "triangle";
  o.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(0.07, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + 0.14);
}
