/**
 * main.js — Orchestrator
 * Wires engine, level, audio and UI together.
 * To add a new game: swap the level config and re-call init().
 * Teardown previo en cada init/replay para evitar listeners duplicados.
 */

import { PuzzleEngine } from './engine/PuzzleEngine.js';
import { DragController } from './engine/DragController.js';
import { mountainNight }  from './levels/mountainNight.js';
import { AudioManager }   from './audio/AudioManager.js';
import { BoardUI }        from './ui/BoardUI.js';
import { HUD }            from './ui/HUD.js';

// ── Active level config (swap this to change game) ───────────────────────────
const LEVEL = mountainNight;

// ── Module instances ──────────────────────────────────────────────────────────
let engine, drag, audio, boardUI, hud;
let _onMove, _onFuse, _onWin;

/**
 * Limpia instancias anteriores: destroy de controladores, remove de listeners del engine.
 * Llamar antes de cada init() para que replay/no duplique listeners ni renders.
 */
function teardown() {
  if (drag) {
    drag.destroy();
    drag = null;
  }
  if (hud) {
    hud.destroy();
    hud = null;
  }
  if (boardUI) {
    boardUI.destroy();
    boardUI = null;
  }
  if (engine && _onMove !== undefined) {
    engine.off('move', _onMove);
    engine.off('fuse', _onFuse);
    engine.off('win', _onWin);
    _onMove = _onFuse = _onWin = undefined;
  }
  engine = null;
  audio = null;
}

async function init() {
  teardown();

  // 1. Generate / load the source image for this level
  const image = await LEVEL.generateImage();

  // 2. Boot the engine with level config
  engine = new PuzzleEngine({
    cols:   LEVEL.cols,
    rows:   LEVEL.rows,
    image,
  });
  engine.shuffle();

  // 3. Boot UI
  boardUI = new BoardUI({
    wrapEl:        document.getElementById('board-wrap'),
    ghostEl:       document.getElementById('ghost'),
    hoverEl:       document.getElementById('hover-overlay'),
    gridOverlayEl: document.getElementById('grid-overlay'),
    boardW:        LEVEL.boardW,
    boardH:        LEVEL.boardH,
    cols:          LEVEL.cols,
    rows:          LEVEL.rows,
  });

  hud = new HUD({
    statusEl:   document.getElementById('status'),
    winEl:      document.getElementById('win-overlay'),
    shuffleBtn: document.getElementById('shuffle-btn'),
    replayBtn:  document.getElementById('replay-btn'),
    cols:       LEVEL.cols,
    rows:       LEVEL.rows,
  });

  // 4. Boot audio (warmup se hace en primer gesto del usuario)
  audio = new AudioManager();

  // 5. Boot drag controller — connects engine ↔ UI
  drag = new DragController({ engine, boardUI, audio });

  // 6. Initial render
  boardUI.render(engine);
  hud.update(engine);

  // 7. Wire HUD buttons (HUD guarda refs y los remueve en destroy)
  hud.onShuffle(() => {
    engine.shuffle();
    boardUI.render(engine);
    hud.update(engine);
  });

  hud.onReplay(() => {
    hud.hideWin();
    init();
  });

  // 8. Wire engine events → HUD / audio (refs para poder hacer off en teardown)
  _onMove = () => {
    boardUI.render(engine);
    hud.update(engine);
    audio.play('move');
  };
  _onFuse = () => { audio.play('fuse'); };
  _onWin = () => {
    audio.play('win');
    setTimeout(() => hud.showWin(), 350);
  };
  engine.on('move', _onMove);
  engine.on('fuse', _onFuse);
  engine.on('win', _onWin);

  // Warmup de AudioContext en primer gesto (políticas autoplay)
  const warmup = () => {
    if (audio) audio.warmup();
  };
  document.addEventListener('click', warmup, { once: true });
  document.addEventListener('touchstart', warmup, { once: true, passive: true });
}

// PWA: registrar Service Worker y notificación cuando hay nueva versión
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swUrl = new URL('sw.js', document.baseURI || window.location.href).href;
    navigator.serviceWorker.register(swUrl).then((reg) => {
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w.addEventListener('statechange', () => {
          if (w.state === 'installed' && reg.waiting) {
            notifyNewVersion(reg);
          }
        });
      });
      if (reg.waiting) notifyNewVersion(reg);
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });
    }).catch((err) => {
      console.warn('Service Worker registration failed:', err);
    });
  });
}

function notifyNewVersion(reg) {
  if (document.getElementById('sw-update-toast')) return;
  const msg = document.createElement('div');
  msg.id = 'sw-update-toast';
  msg.innerHTML = 'Nueva versión disponible. <button id="sw-reload-btn">Recargar</button>';
  msg.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:#0f0e0c;color:#e8e0d0;border:1px solid #c9a84c;padding:10px 16px;border-radius:8px;font-size:0.85rem;z-index:10000;';
  document.body.appendChild(msg);
  document.getElementById('sw-reload-btn').onclick = () => {
    if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
  };
}

init();
