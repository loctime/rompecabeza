import { getUserProgress, saveUserProgress } from '../firebase/firestoreService.js';

const STORAGE_KEY = 'puzzleProgress';

export function getLocalProgress() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return { completedLevels: [], lastLevel: 0 };
    }
    
    const progress = JSON.parse(stored);
    return {
      completedLevels: Array.isArray(progress.completedLevels) ? progress.completedLevels : [],
      lastLevel: typeof progress.lastLevel === 'number' ? progress.lastLevel : 0
    };
  } catch (error) {
    console.error('Error al leer progreso local:', error);
    return { completedLevels: [], lastLevel: 0 };
  }
}

export function saveLocalProgress(progress) {
  try {
    const data = {
      completedLevels: Array.isArray(progress.completedLevels) ? progress.completedLevels : [],
      lastLevel: typeof progress.lastLevel === 'number' ? progress.lastLevel : 0
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    console.log('Progreso guardado en localStorage');
  } catch (error) {
    console.error('Error al guardar progreso local:', error);
  }
}

export function markCompleted(levelIndex) {
  const progress = getLocalProgress();
  
  if (!progress.completedLevels.includes(levelIndex)) {
    progress.completedLevels.push(levelIndex);
    progress.lastLevel = Math.max(...progress.completedLevels, levelIndex);
    saveLocalProgress(progress);
    console.log(`Nivel ${levelIndex} marcado como completado localmente`);
  }
}

export function getProgress() {
  return getLocalProgress();
}

export async function syncToCloud(userId) {
  if (!userId) {
    console.warn('syncToCloud: userId es requerido');
    return false;
  }
  
  try {
    const localProgress = getLocalProgress();
    const success = await saveUserProgress(userId, localProgress);
    
    if (success) {
      console.log('Progreso sincronizado con la nube');
    } else {
      console.warn('No se pudo sincronizar con la nube');
    }
    
    return success;
  } catch (error) {
    console.error('Error en syncToCloud:', error);
    return false;
  }
}

export async function syncFromCloud(userId) {
  if (!userId) {
    console.warn('syncFromCloud: userId es requerido');
    return false;
  }
  
  try {
    const remoteProgress = await getUserProgress(userId);
    
    if (!remoteProgress) {
      console.log('No hay progreso remoto para sincronizar');
      return false;
    }
    
    const localProgress = getLocalProgress();
    const mergedProgress = mergeProgress(localProgress, remoteProgress);
    saveLocalProgress(mergedProgress);
    
    console.log('Progreso sincronizado desde la nube');
    return true;
  } catch (error) {
    console.error('Error en syncFromCloud:', error);
    return false;
  }
}

export function mergeProgress(local, remote) {
  const localLevels = new Set(local.completedLevels || []);
  const remoteLevels = new Set(remote.completedLevels || []);
  
  const mergedLevels = new Set([...localLevels, ...remoteLevels]);
  
  const lastLevel = Math.max(
    local.lastLevel || 0,
    remote.lastLevel || 0,
    ...mergedLevels
  );
  
  return {
    completedLevels: Array.from(mergedLevels).sort((a, b) => a - b),
    lastLevel
  };
}

export function isLevelCompleted(levelIndex) {
  const progress = getLocalProgress();
  return progress.completedLevels.includes(levelIndex);
}

export function getCompletedCount() {
  const progress = getLocalProgress();
  return progress.completedLevels.length;
}

export function clearLocalProgress() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    console.log('Progreso local eliminado');
  } catch (error) {
    console.error('Error al limpiar progreso local:', error);
  }
}
