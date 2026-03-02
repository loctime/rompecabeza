# Testing checklist (Fase 1 + Fase 2)

## 1) Multiusuario local
1. Abrir app.
2. Crear usuario A con botón `+ usuario`.
3. Jugar 1 nivel y ganar/guardar progreso.
4. Crear usuario B y jugar otro nivel.
5. Volver a usuario A desde el selector.
6. Esperado:
   - progreso de A y B está aislado,
   - setting `mute` es independiente por usuario,
   - `logout` vuelve a `default` sin recargar la web.

## 2) Migración IndexedDB v1 -> v2
1. En una build anterior, generar datos legacy (`progress`, `history`, `settings`).
2. Abrir esta versión.
3. En DevTools > Application > IndexedDB > `puzzle-platform-db`, validar stores:
   - `users`
   - `progressV2`
   - `sessions`
   - `settingsV2`
   - `assetsV2`
   - `syncQueue`
4. Esperado:
   - existe usuario `default`,
   - settings legacy aparecen en `settingsV2` para `default`,
   - `history` legacy se convirtió a filas append-only en `sessions`,
   - no se rompe la carga de progreso.

## 3) Persistencia masiva (modelo append-only)
1. Completar/reiniciar partidas repetidas (20+ sesiones).
2. Validar en `sessions` que cada sesión es una fila (`sessionId` único).
3. Esperado: no hay arrays gigantes por clave.

## 4) Regresión de jugabilidad
1. Arrastrar grupos, fusionar, ganar y reintentar.
2. Cambiar modo (`classic/timed/zen`).
3. Esperado: comportamiento jugable sin cambios funcionales.

## 5) Sanity tests automáticos
Ejecutar:
```bash
node --test tests/sanity.test.mjs
```
Esperado: 3/3 tests en verde.

## 6) Preparación backend (stubs)
1. Verificar que existen:
   - `runtime/auth.js` (`AuthProvider` + `LocalAuthProvider`)
   - `runtime/sync.js` (`SyncOrchestrator`)
   - `runtime/leaderboard.js` (`LeaderboardService` placeholder)
2. Esperado: capa preparada para integrar Firebase/Auth0/backend propio sin romper contrato local.
