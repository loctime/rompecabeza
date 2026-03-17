import { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged as _onAuthStateChanged,
  GoogleAuthProvider 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { auth } from './firebaseConfig.js';

const googleProvider = new GoogleAuthProvider();

/**
 * Inicia sesión con Google
 * @returns {Promise<UserCredential|null>}
 */
export async function signInWithGoogle() {
  if (!auth) {
    console.warn('Auth no disponible - Firebase no inicializado');
    return null;
  }
  
  try {
    const result = await signInWithPopup(auth, googleProvider);
    console.log('Usuario logueado con Google:', result.user.email);
    return result;
  } catch (error) {
    console.error('Error en login con Google:', error.code, error.message);
    throw error;
  }
}

/**
 * Inicia sesión con email y password
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<UserCredential|null>}
 */
export async function signInWithEmail(email, password) {
  if (!auth) {
    console.warn('Auth no disponible - Firebase no inicializado');
    return null;
  }
  
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    console.log('Usuario logueado con email:', result.user.email);
    return result;
  } catch (error) {
    console.error('Error en login con email:', error.code, error.message);
    throw error;
  }
}

/**
 * Registra un nuevo usuario con email y password
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<UserCredential|null>}
 */
export async function signUpWithEmail(email, password) {
  if (!auth) {
    console.warn('Auth no disponible - Firebase no inicializado');
    return null;
  }
  
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    console.log('Usuario registrado con email:', result.user.email);
    return result;
  } catch (error) {
    console.error('Error en registro con email:', error.code, error.message);
    throw error;
  }
}

/**
 * Cierra sesión del usuario actual
 * @returns {Promise<void>}
 */
export async function signOutUser() {
  if (!auth) {
    console.warn('Auth no disponible - Firebase no inicializado');
    return;
  }
  
  try {
    await signOut(auth);
    console.log('Usuario desconectado');
  } catch (error) {
    console.error('Error al cerrar sesión:', error.code, error.message);
    throw error;
  }
}

/**
 * Escucha cambios en el estado de autenticación
 * @param {Function} callback - función que recibe (user|null)
 * @returns {Function} - función para cancelar la suscripción
 */
export function onAuthChange(callback) {
  if (!auth) {
    console.warn('Auth no disponible - Firebase no inicializado');
    callback(null);
    return () => {};
  }
  
  return _onAuthStateChanged(auth, callback);
}

/**
 * Obtiene el usuario actual
 * @returns {User|null}
 */
export function getCurrentUser() {
  return auth?.currentUser || null;
}

/**
 * Verifica si hay un usuario logueado
 * @returns {boolean}
 */
export function isUserLoggedIn() {
  return !!auth?.currentUser;
}
