import { DragController } from './engine/DragController.js';
import { BoardUI } from './ui/BoardUI.js';
import { HUD } from './ui/HUD.js';
import { AudioManager } from './audio/AudioManager.js';
import { MusicController } from './audio/MusicController.js';
import { EventBus, EVENTS } from './runtime/events.js';
import { GameSession } from './runtime/GameSession.js';
import { AssetManager } from './runtime/AssetManager.js';
import { AppStore } from './runtime/store.js';
import { LocalPackProvider } from './runtime/providers/LocalPackProvider.js';
import { LevelManager } from './runtime/LevelManager.js';
import { onAuthChange, getCurrentUser } from './firebase/authService.js';
import { initSSOListener } from './firebase/sso.js';
import { getProgress, syncFromCloud, syncToCloud, markCompleted } from './storage/ProgressService.js';
import { initializeLevels, getLevelByIndex, getLevelCount, levelExists, CLASSIC_LEVELS } from './levels/index.js';

// SSO: escuchar token de ControlGames si Rompecoco está en un iframe
initSSOListener();

const bus = new EventBus();
const assetManager = new AssetManager();
const store = new AppStore();
const audio = new AudioManager();
const music = new MusicController();

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
let currentLevelIndex = 0;
let isUsingNewLevelSystem = false;
let boardScaleCleanup = null;
let lastPiecePlacedInfo = null;
let completionAAAStarted = false;
let currentUser = null;

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

function setupAuthListener() {
  const unsubscribeAuth = onAuthChange(async (user) => {
    currentUser = user;
    
    if (user) {
      console.log('Usuario logueado:', user.email);
      
      try {
        await syncFromCloud(user.uid);
        
        if (document.body.dataset.view === 'levels') {
          renderLevelGrid();
        }
        
        if (hud) {
          hud.updateUserInfo(user);
        }
      } catch (error) {
        console.error('Error sincronizando progreso:', error);
      }
    } else {
      console.log('Usuario deslogueado');
      
      if (hud) {
        hud.updateUserInfo(null);
      }
    }
  });
  
  unsubscribers.push(unsubscribeAuth);
}

function syncProgressOnWin() {
  if (currentUser && currentLevelId) {
    syncToCloud(currentUser.uid).catch(console.error);
  }
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function extractLevelIndex(levelId) {
  // El formato puede ser "pack:levelId" o solo "levelId"
  // Para el progreso, usamos el índice numérico del nivel
  if (!levelId) return null;
  
  // Si es un número directo
  const numIndex = parseInt(levelId);
  if (!isNaN(numIndex)) return numIndex;
  
  // Si tiene formato "pack:levelId", extraer el número del levelId
  if (levelId.includes(':')) {
    const parts = levelId.split(':');
    const levelPart = parts[1];
    const extracted = parseInt(levelPart);
    return !isNaN(extracted) ? extracted : null;
  }
  
  return null;
}

async function setMuteMuted(muted) {
  await store.setSetting('mute', muted);
  if (muted) {
    audio.mute();
    music.setVolume(0);
    return;
  }
  audio.unmute();
  music.setVolume(store.state.settings.musicVolume);
}

async function setMusicVolume(value) {
  const next = clamp01(value);
  await store.setSetting('musicVolume', next);
  if (!store.state.settings.mute) music.setVolume(next);
}

async function setSfxVolume(value) {
  const next = clamp01(value);
  await store.setSetting('sfxVolume', next);
  audio.setVolume(next);
}

function applyAudioSettings() {
  audio.setVolume(store.state.settings.sfxVolume);
  if (store.state.settings.mute) {
    audio.mute();
    music.setVolume(0);
    return;
  }
  audio.unmute();
  music.setVolume(store.state.settings.musicVolume);
}

function setupAudioHotkeys() {
  window.addEventListener('keydown', async (event) => {
    const target = event.target;
    const tag = target?.tagName?.toLowerCase?.();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) return;

    if (event.key === 'm' || event.key === 'M') {
      event.preventDefault();
      await setMuteMuted(!store.state.settings.mute);
      return;
    }

    if (event.key === '[') {
      event.preventDefault();
      await setMusicVolume(store.state.settings.musicVolume - 0.1);
      return;
    }

    if (event.key === ']') {
      event.preventDefault();
      await setMusicVolume(store.state.settings.musicVolume + 0.1);
      return;
    }

    if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      await setSfxVolume(store.state.settings.sfxVolume - 0.1);
      return;
    }

    if (event.key === '=' || event.key === '+') {
      event.preventDefault();
      await setSfxVolume(store.state.settings.sfxVolume + 0.1);
    }
  });
}

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
  music.play('home');
  currentLevelId = null;
  currentLevel = null;
}

function showLevelGrid() {
  document.body.dataset.view = 'levels';
  music.fadeTo('classic');
  currentMode = 'classic';
  currentLevelId = null;
  if (backGameBtn) backGameBtn.textContent = '? Atras';
  updateLevelsTitle();
}

function loadLevel(index) {
  if (!levelExists(index)) {
    console.error(`Nivel ${index} no existe`);
    return null;
  }
  
  const level = getLevelByIndex(index);
  currentLevelIndex = index;
  isUsingNewLevelSystem = true;
  
  // Adaptar nivel al formato que espera el engine
  const adaptedLevel = {
    id: level.id,
    packId: level.packId || 'classic',
    progressKey: `classic:${index}`,
    board: {
      cols: level.cols,
      rows: level.rows,
      boardW: level.boardW,
      boardH: level.boardH
    },
    image: {
      generate: () => level.generateImage()
    },
    meta: level.meta
  };
  
  return adaptedLevel;
}

async function startNewLevelSystem() {
  await initializeLevels();
  const progress = getProgress();
  currentLevelIndex = progress.lastLevel || 0;
  
  // Cargar primer nivel disponible
  const level = loadLevel(currentLevelIndex);
  if (level) {
    await boot(level);
  }
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

function getFusionPulseGroups(session, affected = []) {
  if (!session || !Array.isArray(affected) || !affected.length) return [];
  const fused = session.getFusedEdges();
  const seen = new Set();
  const groups = [];

  for (const pos of affected) {
    if (seen.has(pos)) continue;
    const group = session.getGroup(pos, fused);
    group.forEach((p) => seen.add(p));
    if (group.length >= 2) groups.push(group);
  }
  return groups;
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
    authContainer: document.getElementById('auth-container'),
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
  unsubscribers.push(bus.on(EVENTS.MOVE_APPLIED, ({ affected, fusionGained }) => {
    boardUI.render(session, pieceCanvases, affected);
    hud.update(session.getSnapshot());

    if (fusionGained) {
      audio.play('fuse');
      const groups = getFusionPulseGroups(session, affected);
      boardUI.playFusionMagnetPulse(groups);
    }
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
    
    if (payload.reason === 'win') {
      try {
        let levelIndex = null;
        
        // Para nuevo sistema de niveles
        if (isUsingNewLevelSystem && currentLevelIndex !== null) {
          levelIndex = currentLevelIndex;
        } else {
          // Para sistema antiguo
          levelIndex = extractLevelIndex(progressId);
        }
        
        if (levelIndex !== null) {
          markCompleted(levelIndex);
          syncProgressOnWin();
          
          // Auto-desbloquear siguiente nivel
          const nextLevelIndex = levelIndex + 1;
          if (levelExists(nextLevelIndex)) {
            console.log(`Nivel ${levelIndex} completado. Siguiente nivel (${nextLevelIndex}) desbloqueado.`);
          }
        }
      } catch (error) {
        console.error('Error guardando progreso:', error);
      }
    }
    
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
  music.fadeTo('daily');
  const level = levelManager.getDailyLevel(currentPackId);
  if (level) await boot(level);
}

async function startInfinite() {
  currentMode = 'infinite';
  music.fadeTo('infinite');
  levelManager.resetInfiniteProgress();
  await levelManager.refillQueue();
  const level = await levelManager.nextInfiniteLevel(currentPackId);
  if (level) await boot(level);
}

function renderLevelGrid() {
  levelGridEl.innerHTML = '';
  
  // Usar nuevo sistema de niveles si está disponible
  if (isUsingNewLevelSystem || CLASSIC_LEVELS.length > 0) {
    renderNewLevelGrid();
    return;
  }
  
  // Sistema antiguo como fallback
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
    card.classList.add('revealed');

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

function renderNewLevelGrid() {
  const progress = getProgress();
  const completedLevels = progress.completedLevels || [];
  
  for (let i = 0; i < CLASSIC_LEVELS.length; i++) {
    const level = CLASSIC_LEVELS[i];
    if (!level) continue;

    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'level-card';
    card.dataset.levelIndex = i;

    const num = String(i + 1).padStart(2, '0');
    card.dataset.levelNum = num;

    // Sistema de desbloqueo progresivo
    const isUnlocked = i === 0 || completedLevels.includes(i - 1);
    const isCompleted = completedLevels.includes(i);

    // Clases CSS para estados
    card.classList.add('revealed');
    if (!isUnlocked) {
      card.classList.add('locked');
    }
    if (isCompleted) {
      card.classList.add('completed');
    }

    const stars = '?'.repeat(level.difficulty ?? 1);
    
    if (!isUnlocked) {
      // Nivel bloqueado: no mostrar imagen, mostrar candado
      card.innerHTML = `
        <div class="level-lock-overlay">
          <span class="lock-icon">🔒</span>
          <span class="lock-text">Bloqueado</span>
        </div>
        <span class="level-num">${num}</span>
        <span class="level-title">${level.title || level.name || level.id}</span>
        <span class="level-diff">${stars}</span>
      `;
      
      // No permitir click en niveles bloqueados
      card.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Mostrar mensaje de desbloqueo
        if (i > 0) {
          const prevLevelName = CLASSIC_LEVELS[i - 1]?.title || CLASSIC_LEVELS[i - 1]?.name || `Nivel ${i}`;
          alert(`Completa "${prevLevelName}" para desbloquear este nivel`);
        }
      });
    } else {
      // Nivel desbloqueado: mostrar imagen normal
      const imgSrc = level._imageUrl || level.image || './assets/levels/nivel-01.jpg';
      card.innerHTML = `
        ${isCompleted ? '<div class="completed-badge">✅</div>' : ''}
        <img src="${imgSrc}" alt="" loading="lazy" />
        <span class="level-num">${num}</span>
        <span class="level-title">${level.title || level.name || level.id}</span>
        <span class="level-diff">${stars}</span>
      `;
      
      card.addEventListener('click', () => {
        const adaptedLevel = loadLevel(i);
        if (adaptedLevel) {
          boot(adaptedLevel);
        }
      });
    }
    
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

  // Cargar progreso inicial desde localStorage
  const progress = getProgress();
  currentLevelIndex = progress.lastLevel || 0;

  music.init();
  applyAudioSettings();
  setupAudioHotkeys();

  setupAuthListener();
  currentUser = getCurrentUser();

  populateCategorySelectors();
  currentPackId = getSelectedPackIdOrFallback(store.state.settings.selectedPackId || DEFAULT_CATEGORY_ID);
  syncCategorySelectors();
  updateLevelsTitle();

  showHome();
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
