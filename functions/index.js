/**
 * Cloud Function: mintCustomToken
 *
 * Recibe un Firebase ID token generado por ControlGames,
 * lo verifica, y devuelve un custom token para que Rompecoco
 * pueda autenticar al usuario sin pedirle login de nuevo.
 *
 * Deploy:
 *   cd functions
 *   npm install firebase-admin firebase-functions
 *   firebase deploy --only functions
 *
 * La función queda en:
 *   https://us-central1-controlstorage-eb796.cloudfunctions.net/mintCustomToken
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

exports.mintCustomToken = functions.https.onRequest(async (req, res) => {
  // CORS — solo permitir el origen del shell ControlGames
  const allowedOrigin = 'https://juegos.controldoc.app';
  res.set('Access-Control-Allow-Origin', allowedOrigin);
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { idToken } = req.body;
  if (!idToken || typeof idToken !== 'string') {
    res.status(400).json({ error: 'idToken requerido' });
    return;
  }

  try {
    // Verificar que el ID token es válido y pertenece a este proyecto Firebase
    const decoded = await admin.auth().verifyIdToken(idToken);

    // Generar custom token para el mismo uid
    const customToken = await admin.auth().createCustomToken(decoded.uid);

    res.status(200).json({ customToken });
  } catch (err) {
    console.error('mintCustomToken error:', err.message);
    res.status(401).json({ error: 'Token inválido' });
  }
});
