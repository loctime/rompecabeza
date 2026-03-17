import { getUserProgress, saveUserProgress } from '../firebase/firestoreService.js';

const STORAGE_KEY = 'puzzleProgress';

/**
 * Obtiene el progreso desde localStorage
 * @returns {Object} - { completedLevels: number[], lastLevel: number }
 */
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

/**
 * Guarda el progreso en localStorage
 * @param {Object} progress - { completedLevels: number[], lastLevel: number }
 */
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

/**
 * Marca un nivel como completado (localStorage)
 * @param {number} levelIndex 
 */
export function markCompleted(levelIndex) {
  const progress = getLocalProgress();
  
  // Evitar duplicados
  if (!progress.completedLevels.includes(levelIndex)) {
    progress.completedLevels.push(levelIndex);
    progress.lastLevel = Math.max(...progress.completedLevels, levelIndex);
    saveLocalProgress(progress);
    console.log(`Nivel ${levelIndex} marcado como completado localmente`);
  }
}

/**
 * Obtiene el progreso actual (siempre desde localStorage para velocidad)
 * @returns {Object} - { completedLevels: number[], lastLevel: number }
 */
export function getProgress() {
  return getLocalProgress();
}

/**
 * Sincroniza el progreso local con Firestore
 * @param {string} userId 
 * @returns {Promise<boolean>}
 */
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

/**
 * Descarga el progreso desde Firestore y lo fusiona con el local
 * @param {string} userId 
 * @returns {Promise<boolean>}
 */
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

/**
 * Fusiona progreso local y remoto sin perder datos
 * @param {Object} local 
 * @param {Object} remote 
 * @returns {Object} - progreso fusionado
 */
export function mergeProgress(local, remote) {
  // Usar Set para evitar duplicados y combinar niveles completados
  const localLevels = new Set(local.completedLevels || []);
  const remoteLevels = new Set(remote.completedLevels || []);
  
  // Unir ambos sets
  const mergedLevels = new Set([...localLevels, ...remoteLevels]);
  
  // El último nivel es el máximo de ambos
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

/**
 * Verifica si un nivel está completado
 * @param {number} levelIndex 
 * @returns {boolean}
 */
export function isLevelCompleted(levelIndex) {
  const progress = getLocalProgress();
  return progress.completedLevels.includes(levelIndex);
}

/**
 * Obtiene la cantidad de niveles completados
 * @returns {number}
 */
export function getCompletedCount() {
  const progress = getLocalProgress();
  return progress.completedLevels.length;
}

/**
 * Limpia todo el progreso local
 */
export function clearLocalProgress() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    console.log('Progreso local eliminado');
  } catch (error) {
    console.error('Error al limpiar progreso local:', error);
  }
}

// Debounce para evitar múltiples sincronizaciones rápidas
let syncTimeout = null;
const SYNC_DELAY = 2000; // 2 segundos

/**
 * Sincronización con debounce
 * @param {string} userId 
 * @returns {Promise<void>}
 */
export function debouncedSyncToCloud(userId) {
  if (!userId) return Promise.resolve();
  
  return new Promise((resolve) => {
    // Limpiar timeout anterior
    if (syncTimeout) {
      clearTimeout(syncTimeout);
    }
    
    // Configurar nuevo timeout
    syncTimeout = setTimeout(async () => {
      try {
        await syncToCloud(userId);
        resolve();
      } catch (error) {
        console.error('Error en sync debounced:', error);
        resolve();
      }
    }, SYNC_DELAY);
  });
}
