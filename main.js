import { DragController } from './engine/DragController.js';
import { BoardUI } from './ui/BoardUI.js';
import { HUD } from './ui/HUD.js';
import { levels, getLevelById } from './data/levels.js';
import { EventBus, EVENTS } from './runtime/events.js';
import { GameSession } from './runtime/GameSession.js';
import { AssetManager } from './runtime/AssetManager.js';
import { AppStore } from './runtime/store.js';

const bus = new EventBus();
const assetManager = new AssetManager();
const store = new AppStore();

let session;
let boardUI;
let hud;
let drag;
let pieceCanvases = [];
let unsubscribers = [];
let currentLevelId = null;
let boardScaleCleanup = null;

const levelGridEl = document.getElementById('level-grid');
const gameAreaEl = document.getElementById('game-area');
const boardContainerEl = document.getElementById('board-container');
const boardWrapEl = document.getElementById('board-wrap');

function showLevelGrid() {
  levelGridEl.classList.remove('hidden');
  gameAreaEl.classList.add('hidden');
  currentLevelId = null;
}

function showGame() {
  levelGridEl.classList.add('hidden');
  gameAreaEl.classList.remove('hidden');
}

function teardown() {
  boardScaleCleanup?.();
  boardScaleCleanup = null;
  drag?.destroy();
  boardUI?.destroy();
  unsubscribers.forEach((u) => u());
  unsubscribers = [];
  session?.stop();
}

function applyBoardScale(boardW, boardH) {
  if (!boardContainerEl || !boardWrapEl) return;
  const padding = 24;
  const headerGap = 80;
  const availW = Math.min(document.documentElement.clientWidth, window.innerWidth) - padding;
  const availH = Math.min(document.documentElement.clientHeight, window.innerHeight) - headerGap - padding;
  const scale = Math.min(1, availW / boardW, availH / boardH);
  boardContainerEl.style.setProperty('--board-scale', String(scale));
  boardWrapEl.style.width = boardW + 'px';
  boardWrapEl.style.height = boardH + 'px';
  boardWrapEl.style.transform = `scale(${scale})`;
  boardContainerEl.style.width = boardW * scale + 'px';
  boardContainerEl.style.height = boardH * scale + 'px';
}

function setupBoardScale(level) {
  boardScaleCleanup?.();
  const { boardW, boardH } = level.board;
  applyBoardScale(boardW, boardH);
  const onResize = () => applyBoardScale(boardW, boardH);
  window.addEventListener('resize', onResize);
  boardScaleCleanup = () => window.removeEventListener('resize', onResize);
}

async function boot(levelId) {
  teardown();
  const level = getLevelById(levelId);
  const image = await assetManager.preload(level) || await assetManager.restore(level.id) || await level.image.generate();
  const sliced = assetManager.buildPieces(image, level.board.cols, level.board.rows);
  pieceCanvases = sliced.pieces.map((p) => p.canvas);

  session = new GameSession({ level, mode: 'classic', bus, userId: 'default' });
  await session.restoreProgress();

  document.body.dataset.hideBoardBorders = store.state.settings.hideBoardBorders ? 'true' : 'false';
  boardUI = new BoardUI({
    wrapEl: boardWrapEl,
    ghostEl: document.getElementById('ghost'),
    hoverEl: document.getElementById('hover-overlay'),
    gridOverlayEl: document.getElementById('grid-overlay'),
    boardW: level.board.boardW,
    boardH: level.board.boardH,
    cols: level.board.cols,
    rows: level.board.rows,
    hideBoardBorders: store.state.settings.hideBoardBorders !== false,
  });
  boardUI.setPieceCanvases(pieceCanvases);
  setupBoardScale(level);

  hud = new HUD({
    statusEl: document.getElementById('status'),
    winEl: document.getElementById('win-overlay'),
    shuffleBtn: document.getElementById('shuffle-btn'),
    replayBtn: document.getElementById('replay-btn'),
  });

  drag = new DragController({ session, boardUI });
  boardUI.render(session, pieceCanvases);
  hud.update(session.getSnapshot());

  hud.onShuffle(() => session.shuffle());
  hud.onReplay(() => { hud.hideWin(); boot(levelId); });

  unsubscribers.push(bus.on(EVENTS.MOVE_APPLIED, ({ affected }) => {
    boardUI.render(session, pieceCanvases, affected);
    hud.update(session.getSnapshot());
  }));
  unsubscribers.push(bus.on(EVENTS.PUZZLE_SOLVED, () => hud.showWin()));
  unsubscribers.push(bus.on(EVENTS.TIMER_TICK, () => hud.update(session.getSnapshot())));
  unsubscribers.push(bus.on(EVENTS.SESSION_END, async (payload) => {
    await store.markLevelResult(payload.levelId, payload.mode, {
      bestScore: Math.max(store.state.progress[payload.levelId]?.bestScore || 0, payload.score),
      solved: payload.reason === 'win',
    });
  }));

  session.start();
  currentLevelId = levelId;
  showGame();
}

function renderLevelGrid() {
  levelGridEl.innerHTML = '';
  levels.forEach((level) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'level-card';
    card.dataset.levelId = level.id;
    const num = level.id.replace('nivel-', '');
    const stars = '★'.repeat(level.meta.difficulty);
    card.innerHTML = `
      <img src="./assets/levels/${level.id}.jpg" alt="" loading="lazy" />
      <span class="level-num">${num}</span>
      <span class="level-title">${level.meta.title}</span>
      <span class="level-diff">${stars}</span>
    `;
    card.addEventListener('click', () => boot(level.id));
    levelGridEl.appendChild(card);
  });
}

async function init() {
  store.setUser('default');
  await store.hydrate();
  document.body.dataset.hideBoardBorders = store.state.settings.hideBoardBorders !== false ? 'true' : 'false';
  renderLevelGrid();

  document.getElementById('back-levels-btn').addEventListener('click', () => {
    teardown();
    hud?.hideWin();
    showLevelGrid();
  });

  document.getElementById('win-levels-btn').addEventListener('click', () => {
    hud?.hideWin();
    teardown();
    showLevelGrid();
  });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try { await navigator.serviceWorker.register(new URL('service-worker.js', document.baseURI).href); }
    catch (e) { console.warn('SW registration failed', e); }
  });
}

init();
