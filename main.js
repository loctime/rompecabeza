import { DragController } from './engine/DragController.js';
import { BoardUI } from './ui/BoardUI.js';
import { HUD } from './ui/HUD.js';
import { AudioManager } from './audio/AudioManager.js';
import { EventBus, EVENTS } from './runtime/events.js';
import { GameSession } from './runtime/GameSession.js';
import { AssetManager } from './runtime/AssetManager.js';
import { AppStore } from './runtime/store.js';
import { LocalPackProvider } from './runtime/providers/LocalPackProvider.js';
import { LevelManager } from './runtime/LevelManager.js';

const bus = new EventBus();
const assetManager = new AssetManager();
const store = new AppStore();
const audio = new AudioManager();

const localProvider = new LocalPackProvider({ catalogUrl: '/levels/catalog.json' });
const levelManager = new LevelManager({
  localProvider,
  queueMin: 4,
  queueTarget: 10,
  infinitePackId: 'infinito',
});

let session;
let boardUI;
let hud;
let drag;
let pieceCanvases = [];
let unsubscribers = [];
let currentLevel = null;
let currentLevelId = null;
let boardScaleCleanup = null;
let lastPiecePlacedInfo = null;
let completionAAAStarted = false;

const INFINITE_PACK_ID = 'infinito';
const DEFAULT_CATEGORY_ID = 'variado';

/** 'daily' | 'classic' | 'infinite' */
let currentMode = 'classic';
let currentPackId = DEFAULT_CATEGORY_ID;

const levelGridEl = document.getElementById('level-grid');
const boardContainerEl = document.getElementById('board-container');
const boardWrapEl = document.getElementById('board-wrap');
const backGameBtn = document.getElementById('back-levels-btn');
const levelsTitleEl = document.getElementById('levels-title');
const categorySelectHomeEl = document.getElementById('category-select-home');
const categorySelectLevelsEl = document.getElementById('category-select-levels');

function getPlayablePacks() {
  return levelManager.listPlayablePacks();
}

function getPackName(packId) {
  const pack = levelManager.listPacks().find((p) => p.id === packId);
  return pack?.name || packId;
}

function getSelectedPackIdOrFallback(packId) {
  const packs = getPlayablePacks();
  if (!packs.length) return DEFAULT_CATEGORY_ID;
  return packs.some((p) => p.id === packId) ? packId : packs[0].id;
}

function syncCategorySelectors() {
  if (categorySelectHomeEl) categorySelectHomeEl.value = currentPackId;
  if (categorySelectLevelsEl) categorySelectLevelsEl.value = currentPackId;
}

function updateLevelsTitle() {
  if (!levelsTitleEl) return;
  levelsTitleEl.textContent = `Elige nivel - ${getPackName(currentPackId)}`;
}

async function setCurrentPackId(packId, { rerenderLevels = false } = {}) {
  currentPackId = getSelectedPackIdOrFallback(packId);
  syncCategorySelectors();
  updateLevelsTitle();
  await store.setSetting('selectedPackId', currentPackId);
  if (rerenderLevels && document.body.dataset.view === 'levels') {
    renderLevelGrid();
  }
}

function showHome() {
  document.body.dataset.view = 'home';
  currentLevelId = null;
  currentLevel = null;
}

function showLevelGrid() {
  document.body.dataset.view = 'levels';
  currentMode = 'classic';
  currentLevelId = null;
  if (backGameBtn) backGameBtn.textContent = '? Atras';
  updateLevelsTitle();
}

function showGame() {
  document.body.dataset.view = 'game';
  if (backGameBtn) {
    backGameBtn.textContent = currentMode === 'classic' ? '? Niveles' : '? Inicio';
  }
}

function teardown() {
  completionAAAStarted = false;
  lastPiecePlacedInfo = null;
  boardScaleCleanup?.();
  boardScaleCleanup = null;
  drag?.destroy();
  boardUI?.endGhost?.();
  boardUI?.destroy();
  unsubscribers.forEach((u) => u());
  unsubscribers = [];
  session?.stop();
  const ghostEl = document.getElementById('ghost');
  if (ghostEl) ghostEl.style.display = 'none';
  const winEl = document.getElementById('win-overlay');
  if (winEl) winEl.classList.remove('show');
  hud?.showGameHUD();
}

function getNextLevelForClassic() {
  if (!currentLevel?.id) return null;
  return levelManager.getNextLevelInPack(currentPackId, currentLevel.id);
}

function showBlackOverlay() {
  const el = document.getElementById('transition-overlay');
  if (el) {
    el.classList.add('show');
    el.style.opacity = '0';
    requestAnimationFrame(() => { el.style.opacity = '1'; });
  }
}

function hideBlackOverlay() {
  const el = document.getElementById('transition-overlay');
  if (el) {
    const removeOverlay = () => el.classList.remove('show');
    el.style.opacity = '0';
    el.addEventListener('transitionend', removeOverlay, { once: true });
    setTimeout(removeOverlay, 500);
  }
}

async function transitionToLevel(nextLevel) {
  if (!nextLevel) return;
  showBlackOverlay();
  try {
    await new Promise((r) => setTimeout(r, 400));
    hud?.hideWin();
    teardown();
    await boot(nextLevel);
  } catch (error) {
    console.error('No se pudo cargar el siguiente nivel:', error);
    if (currentMode === 'classic') {
      renderLevelGrid();
      showLevelGrid();
    } else {
      showHome();
    }
  } finally {
    hideBlackOverlay();
  }
}

function applyBoardScale(boardW, boardH) {
  if (!boardContainerEl || !boardWrapEl) return;
  const padding = 24;
  const isGame = document.body.dataset.view === 'game';
  const topGap = isGame ? 8 : 80;
  let bottomGap = padding;
  if (isGame) {
    const bar = document.querySelector('.game-bottom-bar');
    const barH = bar ? bar.getBoundingClientRect().height : 0;
    bottomGap = (barH > 0 ? barH : 52) + 12;
  }
  const availW = Math.min(document.documentElement.clientWidth, window.innerWidth) - padding;
  const availH = Math.min(document.documentElement.clientHeight, window.innerHeight) - topGap - bottomGap;
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

async function boot(level) {
  if (!level) return;
  teardown();
  showGame();

  const levelCacheId = level.progressKey || `${level.packId || 'legacy'}:${level.id}`;
  const image = await assetManager.preload(level) || await assetManager.restore(levelCacheId) || await level.image.generate();
  const sliced = assetManager.buildPieces(image, level.board.cols, level.board.rows);
  pieceCanvases = sliced.pieces.map((p) => p.canvas);

  session = new GameSession({ level, mode: currentMode, bus, userId: 'default' });
  await session.restoreProgress();

  document.body.dataset.hideBoardBorders = store.state.settings.hideBoardBorders ? 'true' : 'false';

  const wrapEl = document.getElementById('board-wrap');
  let gridOverlayEl = document.getElementById('grid-overlay') || (wrapEl && wrapEl.querySelector('canvas'));
  let hoverEl = document.getElementById('hover-overlay');
  const ghostEl = document.getElementById('ghost');

  if (wrapEl && !gridOverlayEl) {
    gridOverlayEl = document.createElement('canvas');
    gridOverlayEl.id = 'grid-overlay';
    wrapEl.prepend(gridOverlayEl);
  }
  if (wrapEl && !hoverEl) {
    hoverEl = document.createElement('div');
    hoverEl.id = 'hover-overlay';
    wrapEl.appendChild(hoverEl);
  }

  if (!wrapEl || !gridOverlayEl) {
    console.error('BoardUI: board-wrap o grid-overlay no encontrados');
    return;
  }

  boardUI = new BoardUI({
    wrapEl,
    ghostEl,
    hoverEl,
    gridOverlayEl,
    boardW: level.board.boardW,
    boardH: level.board.boardH,
    cols: level.board.cols,
    rows: level.board.rows,
    hideBoardBorders: store.state.settings.hideBoardBorders !== true,
  });
  boardUI.setPieceCanvases(pieceCanvases);
  setupBoardScale(level);

  hud = new HUD({
    statusEl: document.getElementById('status'),
    winEl: document.getElementById('win-overlay'),
    shuffleBtn: document.getElementById('shuffle-btn'),
    replayBtn: document.getElementById('replay-btn'),
    nextLevelBtn: document.getElementById('next-level-btn'),
    levelsBtn: document.getElementById('win-levels-btn'),
    downloadBtn: document.getElementById('download-btn'),
    winStatsEl: document.getElementById('win-stats'),
  });

  drag = new DragController({ session, boardUI });
  boardUI.render(session, pieceCanvases);
  hud.update(session.getSnapshot());

  hud.onShuffle(() => session.shuffle());
  hud.onReplay(() => { hud.hideWin(); boot(currentLevel); });
  audio.warmup();

  unsubscribers.push(bus.on(EVENTS.PIECE_PLACED, (payload) => {
    lastPiecePlacedInfo = payload;
  }));
  unsubscribers.push(bus.on(EVENTS.MOVE_REJECTED, () => audio.play('invalid')));
  unsubscribers.push(bus.on(EVENTS.MOVE_APPLIED, ({ affected }) => {
    boardUI.render(session, pieceCanvases, affected);
    hud.update(session.getSnapshot());
  }));
  unsubscribers.push(bus.on(EVENTS.PUZZLE_COMPLETED, (stats) => {
    if (completionAAAStarted) return;
    completionAAAStarted = true;
    hud.hideGameHUD();
    boardUI.setCinematicMode(true);
    audio.playVictoryChime();
    const placed = lastPiecePlacedInfo?.placed || [];
    const lastPositions = placed.map((p) => p.to);
    const lastIds = placed.map((p) => p.pieceId);
    for (let i = 0; i < Math.min(3, lastIds.length); i++) {
      setTimeout(() => audio.playSnapTick(0.4 + (i + 1) * 0.2), 120 + i * 80);
    }
    const nextLevelClassic = currentMode === 'classic' ? getNextLevelForClassic() : null;
    const hasNextLevel = currentMode === 'infinite' ? true : !!nextLevelClassic;
    const onNextLevel = currentMode === 'infinite'
      ? () => levelManager.nextInfiniteLevel(currentPackId).then((next) => transitionToLevel(next))
      : () => transitionToLevel(nextLevelClassic);

    boardUI.playCompletionAAA(stats, { lastPlacedPositions: lastPositions, lastPlacedPieceIds: lastIds })
      .then(() => {
        hud.showCompletionBanner(stats, {
          hasNextLevel,
          onNextLevel,
          onReplay: () => { hud.hideWin(); boot(currentLevel); },
          onLevels: () => {
            hud.hideWin();
            teardown();
            if (currentMode === 'classic') {
              renderLevelGrid();
              showLevelGrid();
            } else {
              showHome();
            }
          },
          onDownload: () => {
            const url = boardUI.exportSolvedImage();
            if (url) {
              const a = document.createElement('a');
              a.download = `puzzle-${currentLevelId}.png`;
              a.href = url;
              a.click();
            }
          },
        });
      });
  }));
  unsubscribers.push(bus.on(EVENTS.TIMER_TICK, () => hud.update(session.getSnapshot())));
  unsubscribers.push(bus.on(EVENTS.SESSION_END, async (payload) => {
    const progressId = payload.progressLevelId || payload.levelId;
    await store.markLevelResult(progressId, payload.mode, {
      bestScore: Math.max(store.state.progress[progressId]?.bestScore || 0, payload.score),
      solved: payload.reason === 'win',
    });
    if (document.body.dataset.view === 'levels') {
      renderLevelGrid();
    }
  }));

  session.start();
  currentLevel = level;
  currentLevelId = level.id;
}

async function startDaily() {
  currentMode = 'daily';
  const level = levelManager.getDailyLevel(currentPackId);
  if (level) await boot(level);
}

async function startInfinite() {
  currentMode = 'infinite';
  levelManager.resetInfiniteProgress();
  await levelManager.refillQueue();
  const level = await levelManager.nextInfiniteLevel(currentPackId);
  if (level) await boot(level);
}

function renderLevelGrid() {
  levelGridEl.innerHTML = '';
  const count = levelManager.getPackLevelCount(currentPackId);

  for (let i = 0; i < count; i++) {
    const level = levelManager.getLevelFromPack(currentPackId, i);
    if (!level) continue;

    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'level-card';
    card.dataset.levelId = level.id;

    const num = String(i + 1).padStart(2, '0');
    card.dataset.levelNum = num;

    const progressKey = level.progressKey || level.id;
    const isCompleted = store.state.progress[progressKey]?.solved;
    if (isCompleted) card.classList.add('revealed');

    const imgSrc = level._imageUrl || './assets/levels/nivel-01.jpg';
    const stars = '?'.repeat(level.meta?.difficulty ?? 1);
    card.innerHTML = `
      <img src="${imgSrc}" alt="" loading="lazy" />
      <span class="level-num">${num}</span>
      <span class="level-title">${level.meta?.title ?? level.id}</span>
      <span class="level-diff">${stars}</span>
    `;
    card.addEventListener('click', () => boot(level));
    levelGridEl.appendChild(card);
  }
}

function populateCategorySelectors() {
  const packs = getPlayablePacks();
  const selects = [categorySelectHomeEl, categorySelectLevelsEl].filter(Boolean);

  selects.forEach((selectEl) => {
    selectEl.innerHTML = '';
    packs.forEach((pack) => {
      const option = document.createElement('option');
      option.value = pack.id;
      option.textContent = pack.name || pack.id;
      selectEl.appendChild(option);
    });
  });

  syncCategorySelectors();
}

async function init() {
  store.setUser('default');
  await store.hydrate();
  await levelManager.init();

  populateCategorySelectors();
  currentPackId = getSelectedPackIdOrFallback(store.state.settings.selectedPackId || DEFAULT_CATEGORY_ID);
  syncCategorySelectors();
  updateLevelsTitle();

  document.body.dataset.view = 'home';
  document.body.dataset.hideBoardBorders = store.state.settings.hideBoardBorders !== true ? 'false' : 'true';

  categorySelectHomeEl?.addEventListener('change', async (event) => {
    await setCurrentPackId(event.target.value);
  });

  categorySelectLevelsEl?.addEventListener('change', async (event) => {
    await setCurrentPackId(event.target.value, { rerenderLevels: true });
  });

  document.getElementById('mode-daily').addEventListener('click', () => startDaily());
  document.getElementById('mode-clasico').addEventListener('click', () => {
    renderLevelGrid();
    showLevelGrid();
  });
  document.getElementById('mode-infinito').addEventListener('click', () => startInfinite());

  document.getElementById('back-home-btn').addEventListener('click', () => showHome());

  document.getElementById('back-levels-btn').addEventListener('click', () => {
    teardown();
    hud?.hideWin();
    if (currentMode === 'classic') {
      renderLevelGrid();
      showLevelGrid();
    } else {
      showHome();
    }
  });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try { await navigator.serviceWorker.register(new URL('service-worker.js', document.baseURI).href); }
    catch (e) { console.warn('SW registration failed', e); }
  });
}

init();
