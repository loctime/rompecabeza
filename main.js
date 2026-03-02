import { DragController } from './engine/DragController.js';
import { BoardUI } from './ui/BoardUI.js';
import { HUD } from './ui/HUD.js';
import { levels, getLevelById } from './data/levels.js';
import { EventBus, EVENTS } from './runtime/events.js';
import { GameSession } from './runtime/GameSession.js';
import { AssetManager } from './runtime/AssetManager.js';
import { AppStore } from './runtime/store.js';
import { AudioEngine } from './audio/AudioEngine.js';
import { SfxBank } from './audio/SfxBank.js';
import { MusicController } from './audio/MusicController.js';

const bus = new EventBus();
const assetManager = new AssetManager();
const store = new AppStore();
const audioEngine = new AudioEngine();
const sfx = new SfxBank(audioEngine);
const music = new MusicController(audioEngine);

let session;
let boardUI;
let hud;
let drag;
let pieceCanvases = [];
let unsubscribers = [];

function teardown() {
  drag?.destroy();
  boardUI?.destroy();
  unsubscribers.forEach((u) => u());
  unsubscribers = [];
  session?.stop();
}

async function boot({ levelId, mode }) {
  teardown();
  const level = getLevelById(levelId);
  const image = await assetManager.preload(level) || await assetManager.restore(level.id) || await level.image.generate();
  const sliced = assetManager.buildPieces(image, level.board.cols, level.board.rows);
  pieceCanvases = sliced.pieces.map((p) => p.canvas);

  session = new GameSession({ level, mode, bus });
  await session.restoreProgress();

  boardUI = new BoardUI({
    wrapEl: document.getElementById('board-wrap'),
    ghostEl: document.getElementById('ghost'),
    hoverEl: document.getElementById('hover-overlay'),
    gridOverlayEl: document.getElementById('grid-overlay'),
    boardW: level.board.boardW,
    boardH: level.board.boardH,
    cols: level.board.cols,
    rows: level.board.rows,
  });
  boardUI.setPieceCanvases(pieceCanvases);

  hud = new HUD({
    statusEl: document.getElementById('status'),
    winEl: document.getElementById('win-overlay'),
    shuffleBtn: document.getElementById('shuffle-btn'),
    replayBtn: document.getElementById('replay-btn'),
    levelSelectEl: document.getElementById('level-select'),
    modeSelectEl: document.getElementById('mode-select'),
    muteBtn: document.getElementById('mute-btn'),
  });

  drag = new DragController({ session, boardUI });
  boardUI.render(session, pieceCanvases);
  hud.update(session.getSnapshot());

  hud.onShuffle(() => session.shuffle());
  hud.onReplay(() => { hud.hideWin(); boot({ levelId, mode }); });
  hud.onLevelChange((nextLevelId) => boot({ levelId: nextLevelId, mode }));
  hud.onModeChange((nextMode) => boot({ levelId, mode: nextMode }));
  hud.onMute(async () => {
    const muted = !store.state.settings.mute;
    await store.setSetting('mute', muted);
    audioEngine.setMuted(muted);
    hud.setMuteLabel(muted);
  });

  unsubscribers.push(bus.on(EVENTS.MOVE_APPLIED, ({ affected }) => {
    boardUI.render(session, pieceCanvases, affected);
    hud.update(session.getSnapshot());
    sfx.playMove();
  }));
  unsubscribers.push(bus.on(EVENTS.FUSION_GAINED, () => sfx.playFusion()));
  unsubscribers.push(bus.on(EVENTS.PUZZLE_SOLVED, () => { sfx.playWin(); hud.showWin(); }));
  unsubscribers.push(bus.on(EVENTS.TIMER_TICK, () => hud.update(session.getSnapshot())));
  unsubscribers.push(bus.on(EVENTS.SESSION_END, async (payload) => {
    await store.markLevelResult(payload.levelId, {
      bestScore: Math.max(store.state.progress[payload.levelId]?.bestScore || 0, payload.score),
      lastMode: payload.mode,
      solved: payload.reason === 'win',
    });
  }));

  session.start();
  audioEngine.warmup();
  music.startAmbient();
}

async function init() {
  await store.hydrate();
  const levelSelect = document.getElementById('level-select');
  levelSelect.innerHTML = levels.map((l) => `<option value="${l.id}">${l.meta.title}</option>`).join('');
  levelSelect.value = store.state.uiPrefs.levelId;
  document.getElementById('mode-select').value = store.state.uiPrefs.mode;
  audioEngine.setMuted(store.state.settings.mute);
  hud?.setMuteLabel?.(store.state.settings.mute);

  await boot({ levelId: store.state.uiPrefs.levelId, mode: store.state.uiPrefs.mode });

  document.addEventListener('click', () => audioEngine.warmup(), { once: true });
  document.addEventListener('touchstart', () => audioEngine.warmup(), { once: true, passive: true });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try { await navigator.serviceWorker.register(new URL('service-worker.js', document.baseURI).href); }
    catch (e) { console.warn('SW registration failed', e); }
  });
}

init();
