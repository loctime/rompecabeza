import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { db } from './firebaseConfig.js';

const COLLECTION_NAME = 'users';

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
