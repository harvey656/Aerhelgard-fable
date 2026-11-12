// Tiny synthesized sound effects (no audio files).
let ctx = null, noiseBuf = null;
export const audio = { vol: 0.6 };
function ac() {
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
function tone(f0, f1, dur, type = 'square', vol = 0.2, delay = 0) {
  const c = ac(); if (!c) return; const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol * audio.vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, freq, vol = 0.2, q = 1, delay = 0) {
  const c = ac(); if (!c) return; const t = c.currentTime + delay, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q; g.gain.setValueAtTime(vol * audio.vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f).connect(g).connect(c.destination); s.start(t); s.stop(t + dur + 0.02);
}
const S = {
  step: () => noise(0.06, 300 + Math.random() * 200, 0.07, 0.8), splash: () => noise(0.14, 900, 0.1, 0.6), swing: () => noise(0.14, 1400, 0.12, 0.7),
  hit: () => { noise(0.08, 500, 0.3, 1); tone(140, 60, 0.1, 'square', 0.15); }, hurt: () => tone(220, 80, 0.22, 'sawtooth', 0.2), block: () => { noise(0.07, 2400, 0.25, 3); tone(520, 300, 0.08, 'square', 0.1); },
  bow: () => { tone(300, 120, 0.12, 'triangle', 0.25); noise(0.1, 2000, 0.08, 1); }, cast: () => { tone(300, 900, 0.25, 'sine', 0.2); tone(450, 1300, 0.25, 'sine', 0.1, 0.05); },
  boom: () => { noise(0.4, 160, 0.5, 0.5); tone(120, 30, 0.35, 'sawtooth', 0.25); }, coin: () => { tone(1200, 1200, 0.05, 'square', 0.1); tone(1700, 1700, 0.09, 'square', 0.1, 0.05); },
  pick: () => tone(700, 950, 0.06, 'square', 0.1), equip: () => noise(0.08, 1100, 0.12, 2), drink: () => { tone(400, 300, 0.08, 'sine', 0.2); tone(360, 260, 0.08, 'sine', 0.2, 0.1); tone(320, 240, 0.1, 'sine', 0.2, 0.2); },
  skill: () => { tone(520, 520, 0.09, 'square', 0.12); tone(780, 780, 0.14, 'square', 0.12, 0.09); }, level: () => [392, 523, 659, 784].forEach((f, i) => tone(f, f, 0.16, 'square', 0.14, i * 0.11)),
  quest: () => [523, 659, 784].forEach((f, i) => tone(f, f, 0.2, 'triangle', 0.2, i * 0.12)), deny: () => tone(160, 110, 0.14, 'square', 0.14), door: () => { noise(0.2, 240, 0.25, 1); tone(90, 70, 0.2, 'triangle', 0.2); },
  die: () => tone(260, 50, 0.4, 'sawtooth', 0.16), growl: () => tone(110, 70, 0.35, 'sawtooth', 0.12), forge: () => { noise(0.05, 3000, 0.25, 4); tone(900, 700, 0.12, 'square', 0.08); }, heal: () => [440, 554, 659, 880].forEach((f, i) => tone(f, f, 0.3, 'sine', 0.14, i * 0.08)),
};
export function sfx(name) { const f = S[name]; if (f && audio.vol > 0) { try { f(); } catch { /* audio unavailable */ } } }
