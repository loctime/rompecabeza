# Validación post-auditoría PWA

## 1. No hay leaks de listeners

- Abre la app, juega, pulsa **Jugar de nuevo** varias veces.
- En DevTools → Performance/Memory, toma un heap snapshot antes y después de 3–4 replays.
- Comprueba que el número de nodos DOM y de listeners no crece de forma desproporcionada (teardown + `destroy()` evitan duplicados).

## 2. App funciona offline

- Carga la app una vez con red.
- En DevTools → Application → Service Workers, verifica que el SW está activo.
- En Network, marca **Offline** y recarga o navega a la URL de la app.
- Debe cargar el puzzle desde cache; si falla la navegación, debe mostrarse `offline.html`.

## 3. Iconos en Android/iOS

- **Android (Chrome)**: Menú → “Añadir a la pantalla de inicio”; el icono debe verse (PNG si existen en `/icons/`, si no SVG).
- **iOS (Safari)**: Compartir → “Añadir a la pantalla de inicio”; comprobar que el icono y el splash se ven bien. Para mejor resultado, añade `icon-192.png` e `icon-512.png` en `/icons/`.

## 4. SW se actualiza y notifica

- Despliega una versión con `CACHE_VERSION` incrementado en `sw.js`.
- Con la app abierta, cuando el nuevo SW esté en “waiting”, debe aparecer el toast “Nueva versión disponible. Recargar”.
- Al pulsar **Recargar**, la página debe recargar y usar la nueva versión (sin `skipWaiting` automático hasta que el usuario pulse).

## 5. Touch y replay

- En móvil o con emulación táctil: arrastrar piezas debe funcionar sin que el body capture el gesto (solo `#board-wrap` tiene `touch-action: none`).
- Pulsar “Jugar de nuevo” no debe duplicar listeners ni dejar el tab colgado.

## 6. Audio tras instalar

- Instala la PWA (Añadir a pantalla de inicio).
- Abre la app desde el icono; en el primer toque o clic debe hacerse el warmup del AudioContext.
- Los sonidos (movimiento, fusión, victoria) deben reproducirse después de ese primer gesto.
