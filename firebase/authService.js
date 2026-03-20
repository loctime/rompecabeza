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

export function onAuthChange(callback) {
  if (!auth) {
    console.warn('Auth no disponible - Firebase no inicializado');
    callback(null);
    return () => {};
  }
  
  return _onAuthStateChanged(auth, callback);
}

export function getCurrentUser() {
  return auth?.currentUser || null;
}

export function isUserLoggedIn() {
  return !!auth?.currentUser;
}
