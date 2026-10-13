// Offline loudness / spectrum analysis for rendered audio (pure, no browser needed).
export interface Stats { /** loudness lost (dB) through a small-speaker model (4th-order high-pass at 220 Hz) */ phoneDrop: number; dur: number; peakDb: number; rmsDb: number; mMax: number; lufs: number; centroid: number; low: number; phone: number; high: number; clipped: number }
const db = (x: number): number => 20 * Math.log10(Math.max(1e-9, x));

/** ITU-R BS.1770 K-weighting (coefficients for 48 kHz). */
function kweight(x: Float32Array): Float64Array {
  const y = new Float64Array(x.length), z = new Float64Array(x.length);
  const b1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], a1 = [1, -1.69065929318241, 0.73248077421585];
  const b2 = [1, -2, 1], a2 = [1, -1.99004745483398, 0.99007225036621];
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const v = b1[0] * x[i] + b1[1] * x1 + b1[2] * x2 - a1[1] * y1 - a1[2] * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; }
  x1 = x2 = y1 = y2 = 0;
  for (let i = 0; i < y.length; i++) { const v = b2[0] * y[i] + b2[1] * x1 + b2[2] * x2 - a2[1] * y1 - a2[2] * y2; x2 = x1; x1 = y[i]; y2 = y1; y1 = v; z[i] = v; }
  return z;
}
function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k], vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}
/** Small phone speaker model: 4th-order Butterworth-ish high-pass at 220 Hz. */
function phoneSpeaker(x: Float32Array, sr: number): Float32Array {
  let y = Float32Array.from(x);
  const w0 = (2 * Math.PI * 220) / sr, cw = Math.cos(w0), al = Math.sin(w0) / (2 * 0.7071);
  const b0 = (1 + cw) / 2, b1 = -(1 + cw), b2 = (1 + cw) / 2, a0 = 1 + al, a1 = -2 * cw, a2 = 1 - al;
  for (let pass = 0; pass < 2; pass++) {
    const o = new Float32Array(y.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < y.length; i++) { const v = (b0 * y[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = y[i]; y2 = y1; y1 = v; o[i] = v; }
    y = o;
  }
  return y;
}
function momentaryMax(l: Float32Array, r: Float32Array, sr: number): number {
  const kl = kweight(l), kr = kweight(r), n = l.length, win = Math.round(sr * 0.3), hop = Math.round(sr * 0.05);
  let m = -120;
  for (let s = 0; s + win <= Math.max(n, win) + hop; s += hop) {
    let ml = 0, mr = 0;
    for (let i = s; i < Math.min(n, s + win); i++) { ml += kl[i] * kl[i]; mr += kr[i] * kr[i]; }
    if (s + win > n + hop) break;
    m = Math.max(m, -0.691 + 10 * Math.log10(Math.max(1e-12, (ml + mr) / win)));
  }
  return m;
}
export function analyze(l: Float32Array, r: Float32Array, sr: number): Stats {
  const n = l.length;
  let peak = 0, clipped = 0, first = n, last = 0;
  for (let i = 0; i < n; i++) {
    const a = Math.max(Math.abs(l[i]), Math.abs(r[i]));
    if (a > peak) peak = a;
    if (a >= 0.999) clipped++;
    if (a > 0.001) { if (i < first) first = i; last = i; }
  }
  if (last <= first) return { phoneDrop: 0, dur: 0, peakDb: -120, rmsDb: -120, mMax: -120, lufs: -120, centroid: 0, low: 0, phone: 0, high: 0, clipped };
  const kl = kweight(l), kr = kweight(r);
  const win = Math.round(sr * 0.3), hop = Math.round(sr * 0.05);
  let mMax = -120; const blocks: number[] = [];
  const total = Math.max(n, win);
  for (let s = 0; s + win <= total + hop; s += hop) {
    let ml = 0, mr = 0;
    for (let i = s; i < Math.min(n, s + win); i++) { ml += kl[i] * kl[i]; mr += kr[i] * kr[i]; }
    const lk = -0.691 + 10 * Math.log10(Math.max(1e-12, (ml + mr) / win));
    if (s + win > n + hop) break;
    blocks.push(lk); if (lk > mMax) mMax = lk;
  }
  const gated = blocks.filter((b) => b > -70);
  const rel = gated.length ? -0.691 + 10 * Math.log10(gated.reduce((a, b) => a + Math.pow(10, (b + 0.691) / 10), 0) / gated.length) - 10 : -70;
  const g2 = gated.filter((b) => b > rel);
  const lufs = g2.length ? -0.691 + 10 * Math.log10(g2.reduce((a, b) => a + Math.pow(10, (b + 0.691) / 10), 0) / g2.length) : -120;
  let sq = 0;
  for (let i = first; i <= last; i++) { const m = (l[i] + r[i]) / 2; sq += m * m; }
  const rms = Math.sqrt(sq / (last - first + 1));
  // averaged power spectrum of the mono mix over the active part
  const N = 4096, P = new Float64Array(N / 2), re = new Float64Array(N), im = new Float64Array(N);
  let frames = 0;
  for (let s = first; s + N <= Math.max(last + 1, first + N); s += N / 2) {
    for (let i = 0; i < N; i++) { const m = s + i < n ? (l[s + i] + r[s + i]) / 2 : 0; re[i] = m * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N)); im[i] = 0; }
    fft(re, im);
    for (let k = 0; k < N / 2; k++) P[k] += re[k] * re[k] + im[k] * im[k];
    frames++;
  }
  let tot = 0, cs = 0, lo = 0, ph = 0, hi = 0;
  for (let k = 1; k < N / 2; k++) { const f = (k * sr) / N, p = P[k]; tot += p; cs += p * f; if (f < 150) lo += p; else if (f < 4000) ph += p; else hi += p; }
  void frames;
  const phoneDrop = Math.max(0, mMax - momentaryMax(phoneSpeaker(l, sr), phoneSpeaker(r, sr), sr));
  return { phoneDrop, dur: (last - first) / sr, peakDb: db(peak), rmsDb: db(rms), mMax, lufs, centroid: tot ? cs / tot : 0, low: tot ? lo / tot : 0, phone: tot ? ph / tot : 0, high: tot ? hi / tot : 0, clipped };
}
export function wav(l: Float32Array, r: Float32Array, sr: number): Buffer {
  const n = l.length, buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) { buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, l[i])) * 32767), 44 + i * 4); buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, r[i])) * 32767), 46 + i * 4); }
  return buf;
}
