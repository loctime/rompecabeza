/**
 * main.js — Orchestrator
 * Wires engine, level, audio and UI together.
 * To add a new game: swap the level config and re-call init().
 */

// PWA: registrar Service Worker (no bloquea la app si falla)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Service Worker registration failed:', err);
    });
  });
}

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

async function init() {
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

  // 4. Boot audio
  audio = new AudioManager();

  // 5. Boot drag controller — connects engine ↔ UI
  drag = new DragController({ engine, boardUI, audio });

  // 6. Initial render
  boardUI.render(engine);
  hud.update(engine);

  // 7. Wire HUD buttons
  hud.onShuffle(() => {
    engine.shuffle();
    boardUI.render(engine);
    hud.update(engine);
  });

  hud.onReplay(() => {
    hud.hideWin();
    init();
  });

  // 8. Wire engine events → HUD / audio
  engine.on('move',  () => { boardUI.render(engine); hud.update(engine); audio.play('move'); });
  engine.on('fuse',  () => { audio.play('fuse'); });
  engine.on('win',   () => { audio.play('win'); setTimeout(() => hud.showWin(), 350); });
}

init();
