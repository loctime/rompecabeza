import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { firebaseEnv } from './firebaseEnv.js';

let app = null;
let auth = null;
let db = null;

try {
  app = initializeApp(firebaseEnv);
  auth = getAuth(app);
  db = getFirestore(app);
  console.log('Firebase inicializado');
} catch (error) {
  console.warn('Firebase no disponible, modo offline:', error);
}

export { app, auth, db };
