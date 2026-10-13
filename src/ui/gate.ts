// A casual gate for the Lab tab (tuning, dev grants). It is client-side only, so it keeps curious fingers out; it is not security.
// Only a salted SHA-256 hash is stored here. The unlock lasts for the browser session (sessionStorage).
const SALT = 'gp-lab-7f3a91c2';
const HASH = 'a120bfaad1b02004a7549f69d40a85d9599d5b17ab21f7d7125c45542a50be0a';
const FLAG = 'gp_lab_ok';

/** Pure-JS SHA-256 (hex) for browsers without crypto.subtle (plain http pages, old webviews). */
export function sha256Js(msg: string): string {
  const K = new Uint32Array(64);
  for (let i = 0, n = 2; i < 64; n++) { let p = true; for (let d = 2; d * d <= n; d++) if (n % d === 0) { p = false; break; } if (p) { K[i++] = (Math.cbrt(n) % 1) * 4294967296; } }
  const H = new Uint32Array(8);
  for (let i = 0, n = 2; i < 8; n++) { let p = true; for (let d = 2; d * d <= n; d++) if (n % d === 0) { p = false; break; } if (p) { H[i++] = (Math.sqrt(n) % 1) * 4294967296; } }
  const bytes = Array.from(new TextEncoder().encode(msg));
  const bits = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (bits >>> (i * 8)) & 255);
  const rotr = (x: number, n: number): number => (x >>> n) | (x << (32 - n));
  const w = new Uint32Array(64);
  for (let o = 0; o < bytes.length; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = (bytes[o + i * 4] << 24) | (bytes[o + i * 4 + 1] << 16) | (bytes[o + i * 4 + 2] << 8) | bytes[o + i * 4 + 3];
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
  }
  return Array.from(H, (x) => x.toString(16).padStart(8, '0')).join('');
}
export async function sha256Hex(text: string): Promise<string> {
  try {
    const sub = globalThis.crypto?.subtle;
    if (sub) {
      const buf = await sub.digest('SHA-256', new TextEncoder().encode(text));
      return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch { /* fall through to the JS version */ }
  return sha256Js(text);
}
/** Is this the Lab password? */
export async function checkLabPass(input: string): Promise<boolean> { return (await sha256Hex(SALT + input)) === HASH; }
export function labUnlocked(): boolean { try { return sessionStorage.getItem(FLAG) === '1'; } catch { return false; } }
export function unlockLab(): void { try { sessionStorage.setItem(FLAG, '1'); } catch { /* the unlock then lasts until the next render only */ } memo = true; }
let memo = false;
export const labOpen = (): boolean => memo || labUnlocked();
/** The prompt shown instead of the Lab. */
export function gateHTML(err = ''): string {
  return `<section class="panel lab-gate"><h2 class="h">Lab</h2>
    <p class="dim small">Developer tools: tuning, test grants and previews. Enter the password to open them.</p>
    <form class="gate-form" id="labGate" autocomplete="off"><label class="gate-l" for="labPw">Password</label>
      <input id="labPw" class="gate-in" type="password" inputmode="text" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="go" aria-describedby="labErr">
      <button class="btn go" type="submit">Unlock</button></form>
    <p class="gate-err" id="labErr" role="alert" aria-live="assertive">${err}</p></section>`;
}
