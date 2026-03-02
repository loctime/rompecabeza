/**
 * levels/mountainNight.js
 *
 * Level definition for "Mountain Night".
 * A level exports a config object that main.js consumes.
 *
 * To create a new level, copy this file and change:
 *   - cols, rows, boardW, boardH
 *   - generateImage() — return any HTMLCanvasElement
 *
 * You can also replace generateImage() with an image loader:
 *   async function generateImage() {
 *     return new Promise(resolve => {
 *       const img = new Image();
 *       img.onload = () => {
 *         const cv = document.createElement('canvas');
 *         cv.width = boardW; cv.height = boardH;
 *         cv.getContext('2d').drawImage(img, 0, 0, boardW, boardH);
 *         resolve(cv);
 *       };
 *       img.src = './assets/my-photo.jpg';
 *     });
 *   }
 */

export const mountainNight = {
  id:     'mountain-night',
  title:  'Noche en la Montaña',
  cols:   3,
  rows:   4,
  boardW: 360,
  boardH: 480,

  /** Returns a Promise<HTMLCanvasElement> with the full puzzle image. */
  async generateImage() {
    return _drawMountainNight(this.boardW, this.boardH);
  },
};

// ── Procedural image renderer ─────────────────────────────────────────────────

function _drawMountainNight(W, H) {
  const c   = document.createElement('canvas');
  c.width   = W; c.height = H;
  const ctx = c.getContext('2d');

  // Sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0,    '#0d0821');
  sky.addColorStop(0.55, '#16213e');
  sky.addColorStop(1,    '#0f3460');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Stars
  for (let i = 0; i < 140; i++) {
    ctx.beginPath();
    ctx.arc(Math.random() * W, Math.random() * H * 0.62, Math.random() * 1.4 + 0.2, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,220,${Math.random() * 0.7 + 0.3})`;
    ctx.fill();
  }

  // Moon
  const mx = W * 0.73, my = H * 0.17, mr = 36;
  const mg = ctx.createRadialGradient(mx, my, 0, mx, my, mr * 2.8);
  mg.addColorStop(0, 'rgba(255,240,180,0.2)');
  mg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = mg;
  ctx.beginPath(); ctx.arc(mx, my, mr * 2.8, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2);
  ctx.fillStyle = '#fff9e8'; ctx.fill();
  [[mx-9,my-7,5],[mx+11,my+4,3.5],[mx-4,my+11,2.5]].forEach(([cx,cy,cr]) => {
    ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(180,160,100,0.35)'; ctx.fill();
  });

  // Mountains
  function mtn(pts, color) {
    ctx.beginPath(); ctx.moveTo(pts[0][0], H);
    pts.forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.lineTo(pts[pts.length - 1][0], H);
    ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  }
  mtn([[-20,H*.72],[W*.12,H*.31],[W*.28,H*.56],[W*.5,H*.27],[W*.65,H*.48],[W+20,H*.7]], '#0d1b2a');
  mtn([[0,H*.8],[W*.22,H*.42],[W*.38,H*.62],[W*.58,H*.38],[W*.78,H*.55],[W,H*.75]], '#112233');
  mtn([[0,H*.82],[W*.15,H*.52],[W*.32,H*.7],[W*.52,H*.48],[W*.72,H*.62],[W,H*.8]], '#162840');

  // Snow caps
  function snow(x, y) {
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x-16, y+20); ctx.lineTo(x+16, y+20);
    ctx.closePath(); ctx.fillStyle = 'rgba(255,255,255,0.82)'; ctx.fill();
  }
  snow(W*.12, H*.31); snow(W*.5, H*.27); snow(W*.22, H*.42); snow(W*.52, H*.48);

  // Water
  const wY = H * 0.7;
  const wg  = ctx.createLinearGradient(0, wY, 0, H);
  wg.addColorStop(0, '#091422'); wg.addColorStop(1, '#040b14');
  ctx.fillStyle = wg; ctx.fillRect(0, wY, W, H - wY);

  // Shimmer
  for (let i = 0; i < 35; i++) {
    ctx.fillStyle = `rgba(255,240,150,${Math.random() * .12})`;
    ctx.fillRect(Math.random() * W, wY + Math.random() * (H - wY), Math.random() * 35 + 4, 1);
  }

  // Moon reflection
  const mref = ctx.createRadialGradient(mx, H-30, 0, mx, H-30, 55);
  mref.addColorStop(0, 'rgba(255,240,180,0.28)'); mref.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = mref;
  ctx.beginPath(); ctx.ellipse(mx, H-30, 18, 55, 0, 0, Math.PI*2); ctx.fill();

  // Pine trees
  function tree(x, base, h) {
    const w2 = h * .38;
    ctx.fillStyle = '#050d18';
    ctx.beginPath(); ctx.moveTo(x,base-h); ctx.lineTo(x-w2,base); ctx.lineTo(x+w2,base); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x,base-h*1.35); ctx.lineTo(x-w2*.65,base-h*.48); ctx.lineTo(x+w2*.65,base-h*.48); ctx.closePath(); ctx.fill();
  }
  for (let tx = -10; tx < W + 30; tx += 26) {
    tree(tx, H*.705 + Math.sin(tx*.27)*12, 50 + Math.sin(tx*.5)*16);
  }

  // Foreground
  ctx.fillStyle = '#02070f';
  ctx.fillRect(0, H * .86, W, H * .14);

  return c;
}
