import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { db } from './firebaseConfig.js';

const COLLECTION_NAME = 'users';

/**
 * Guarda el progreso del usuario en Firestore
 * @param {string} userId 
 * @param {Object} progress - { completedLevels: number[], lastLevel: number }
 * @returns {Promise<boolean>}
 */
export async function saveUserProgress(userId, progress) {
  if (!db) {
    console.warn('Firestore no disponible - Firebase no inicializado');
    return false;
  }
  
  try {
    const userRef = doc(db, COLLECTION_NAME, userId);
    const data = {
      ...progress,
      updatedAt: serverTimestamp()
    };
    
    await setDoc(userRef, data, { merge: true });
    console.log('Progreso guardado en Firestore para usuario:', userId);
    return true;
  } catch (error) {
    console.error('Error al guardar progreso en Firestore:', error.code, error.message);
    return false;
  }
}

/**
 * Obtiene el progreso del usuario desde Firestore
 * @param {string} userId 
 * @returns {Promise<Object|null>} - { completedLevels: number[], lastLevel: number } o null
 */
export async function getUserProgress(userId) {
  if (!db) {
    console.warn('Firestore no disponible - Firebase no inicializado');
    return null;
  }
  
  try {
    const userRef = doc(db, COLLECTION_NAME, userId);
    const docSnap = await getDoc(userRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      console.log('Progreso recuperado desde Firestore para usuario:', userId);
      return {
        completedLevels: data.completedLevels || [],
        lastLevel: data.lastLevel || 0
      };
    } else {
      console.log('No hay progreso guardado para usuario:', userId);
      return null;
    }
  } catch (error) {
    console.error('Error al obtener progreso desde Firestore:', error.code, error.message);
    return null;
  }
}

/**
 * Actualiza parcialmente el progreso del usuario
 * @param {string} userId 
 * @param {Object} updates - campos a actualizar
 * @returns {Promise<boolean>}
 */
export async function updateUserProgress(userId, updates) {
  if (!db) {
    console.warn('Firestore no disponible - Firebase no inicializado');
    return false;
  }
  
  try {
    const userRef = doc(db, COLLECTION_NAME, userId);
    const data = {
      ...updates,
      updatedAt: serverTimestamp()
    };
    
    await updateDoc(userRef, data);
    console.log('Progreso actualizado en Firestore para usuario:', userId);
    return true;
  } catch (error) {
    console.error('Error al actualizar progreso en Firestore:', error.code, error.message);
    return false;
  }
}

/**
 * Marca un nivel como completado para el usuario
 * @param {string} userId 
 * @param {number} levelIndex 
 * @returns {Promise<boolean>}
 */
export async function markLevelCompleted(userId, levelIndex) {
  if (!db) {
    console.warn('Firestore no disponible - Firebase no inicializado');
    return false;
  }
  
  try {
    const userRef = doc(db, COLLECTION_NAME, userId);
    const docSnap = await getDoc(userRef);
    
    let completedLevels = [];
    if (docSnap.exists()) {
      completedLevels = docSnap.data().completedLevels || [];
    }
    
    // Evitar duplicados
    if (!completedLevels.includes(levelIndex)) {
      completedLevels.push(levelIndex);
    }
    
    await updateDoc(userRef, {
      completedLevels,
      lastLevel: Math.max(...completedLevels, levelIndex),
      updatedAt: serverTimestamp()
    });
    
    console.log(`Nivel ${levelIndex} marcado como completado para usuario:`, userId);
    return true;
  } catch (error) {
    console.error('Error al marcar nivel como completado:', error.code, error.message);
    return false;
  }
}
