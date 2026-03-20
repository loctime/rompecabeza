/**
 * sso.js — ControlGames SSO bridge
 *
 * Recibe un Firebase ID token desde el shell ControlGames via postMessage,
 * lo intercambia por un custom token llamando a una Cloud Function,
 * y autentica al usuario en Rompecoco sin pedirle login de nuevo.
 *
 * Flujo:
 *   ControlGames (parent) → postMessage CONTROLGAMES_AUTH { idToken }
 *   Rompecoco (iframe)    → llama /mintCustomToken con el idToken
 *   Firebase Functions    → verifica el idToken, devuelve customToken
 *   Rompecoco             → signInWithCustomToken(customToken)
 *
 * Requiere la Cloud Function desplegada (ver functions/index.js).
 */

import { auth } from './firebaseConfig.js';
import { signInWithCustomToken } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

const CONTROLGAMES_ORIGIN = 'https://juegos.controldoc.app';
const MINT_TOKEN_URL = 'https://us-central1-controlstorage-eb796.cloudfunctions.net/mintCustomToken';

let ssoHandled = false;

export function initSSOListener() {
  window.addEventListener('message', async (event) => {
    // Solo aceptar mensajes del shell ControlGames
    if (event.origin !== CONTROLGAMES_ORIGIN) return;
    if (!event.data || event.data.type !== 'CONTROLGAMES_AUTH') return;
    if (ssoHandled) return; // Solo procesar una vez por sesión

    const { idToken } = event.data;
    if (!idToken) return;

    try {
      // Intercambiar ID token por custom token via Cloud Function
      const response = await fetch(MINT_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      if (!response.ok) throw new Error('mintCustomToken failed');

      const { customToken } = await response.json();
      await signInWithCustomToken(auth, customToken);

      ssoHandled = true;
      console.log('[SSO] Autenticación ControlGames completada');
    } catch (err) {
      console.warn('[SSO] No se pudo autenticar via ControlGames:', err.message);
    }
  });
}
