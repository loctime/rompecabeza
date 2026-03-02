# Guía de testing de sanidad (arquitectura escalable)

## 1) Replay múltiple sin leaks
1. Abrir app y jugar 3-5 movimientos.
2. Pulsar **Jugar de nuevo** 8-10 veces.
3. En DevTools Memory, comparar heap snapshots (inicio vs final).
4. Esperado: sin crecimiento sostenido de listeners ni nodos `.cell`.

## 2) Offline con assets + niveles
1. Cargar app online una vez.
2. Verificar en Application > Service Workers que `service-worker.js` está activo.
3. En Application > Cache Storage validar `static-*` y `data-*`.
4. Forzar modo Offline y recargar.
5. Esperado: abre juego desde cache; si falla navegación, muestra `offline.html`.

## 3) Persistencia de progreso
1. Completar parcialmente un nivel.
2. Recargar la página.
3. Esperado: sesión recuperada (board, score, modo).
4. Revisar Application > IndexedDB > `puzzle-platform-db` (stores `progress`, `history`, `settings`).

## 4) Timer y medallas base (modo timed)
1. Seleccionar `timed`.
2. Confirmar avance de tiempo en status.
3. Esperado: al superar límite se dispara `SESSION_END` con `reason=timeout` y guarda historial.

## 5) Multi-niveles
1. Cambiar nivel con selector.
2. Verificar que cambia tamaño de tablero y piezas.
3. Repetir entre niveles para confirmar reinicialización limpia.

## 6) Deploy en subpath
1. Servir app en ruta no raíz (ej: `/games/puzzle/`).
2. Verificar `start_url: "."`, `scope: "."` y registro SW relativo.
3. Esperado: carga correcta y offline sin rutas rotas.

## 7) Actualización SW
1. Incrementar `CACHE_VERSION` de `service-worker.js`.
2. Publicar y abrir app existente.
3. Esperado: nueva versión instala, caches viejos se invalidan en `activate`.

## 8) Fallback offline
1. Bloquear red y navegar a ruta no cacheada.
2. Esperado: fallback a `offline.html` o `index.html` cacheado.
