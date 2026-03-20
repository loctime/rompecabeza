# Auditoría total — Puzzle web (HTML + Canvas + DOM)

## 0) Lectura ejecutiva

El proyecto tiene una base muy sana para un indie puzzle: separación clara entre lógica (`engine`) y UI (`ui`), audio aislado, nivel desacoplado y PWA funcional de base. El mayor riesgo no está en “que no funcione”, sino en **escalar features** (múltiples modos, progresión, métricas, monetización) con una arquitectura pensada hoy para “un nivel + una sesión”.

En términos de producto: ya existe un núcleo jugable y diferenciador (fusión automática + arrastre de grupos), pero faltan capas de retención (meta-progresión, objetivos diarios, ranking, colección) y una capa de crecimiento (share loops, challenges, UGC de imágenes, analytics).

---

## 1) FODA profundo

## Fortalezas
- **Arquitectura inicial limpia**: `PuzzleEngine` mantiene lógica sin dependencia del DOM, y `BoardUI` renderiza sin lógica de juego. Esto reduce acoplamiento accidental y facilita tests futuros.
- **Mecánica base sólida y entendible**: la fusión por adyacencia correcta (`getFusedEdges`) es simple de comunicar y difícil de romper.
- **PWA ya integrada**: service worker, manifest y fallback offline están presentes, lo que acelera distribución web/móvil.
- **Audio procedural offline**: evita dependencia de assets pesados en MVP.
- **Teardown explícito**: evita leaks por replay y da una base robusta para reinicialización.

## Oportunidades
- **Escalar a “plataforma de niveles”**: hoy el nivel es un objeto único; pasar a catálogo + progresión es directo con un LevelRegistry.
- **UGC (user generated content)**: permitir puzzle desde imagen propia puede disparar viralidad orgánica.
- **Segmentación por modo**: zen, crono, competitivo async y diario para aumentar retención por cohortes.
- **Monetización híbrida indie**: free con ads/recompensas + premium sin ads + packs temáticos.

## Debilidades
- **Engine no 100% puro**: `PuzzleEngine` crea canvases (`document.createElement`) para piezas; mezcla dominio con detalle de render.
- **Coste de render de tablero completo por movimiento**: se repinta todo tras cada evento; en grillas grandes puede penalizar FPS/energía.
- **Sin capa de datos de producto**: no hay persistencia de progreso, settings persistentes, métricas, ni telemetría de embudo.
- **Sin sistema de assets formal**: niveles e imágenes dependen de generación ad hoc.
- **Input no unificado por Pointer Events**: mouse/touch separados elevan complejidad y bugs cross-device.

## Amenazas
- **Competencia alta en puzzle casual**: sin loop meta ni identidad fuerte, riesgo de ser “prototipo divertido” y no producto retenible.
- **Coste de adquisición**: sin social hooks/challenges, la viralidad es limitada.
- **Escalabilidad técnica**: si se agregan muchos modos sin refactor base, se acumula deuda rápidamente.
- **PWA discoverability**: buena para fidelización, débil para adquisición si no se complementa con portales y distribución.

---

## 2) Análisis de arquitectura

## Estado actual
- Correcta separación macro: `main.js` orquesta engine/UI/audio.
- Buena higiene de ciclo de vida (`teardown`, `destroy`).
- Eventos del engine (`move`, `fuse`, `win`) bien planteados como contrato.

## Deuda técnica probable
1. **Representación de piezas acoplada a canvas** dentro del engine.
2. **Re-render total** y búsqueda DOM por selector en `dimGroup`.
3. **Cálculos repetidos** de fusiones/grupos en múltiples pasos sin cache temporal de frame.
4. **Estado global implícito** en `main.js`; falta una “Session/GameState Store”.

## Refactor recomendado (alto impacto)
1. **Separar dominio de presentación**:
   - Engine solo maneja IDs, posiciones, relaciones y reglas.
   - `BoardUI`/`AssetManager` resuelven bitmap/canvas por pieza.
2. **Introducir `GameSession`**:
   - encapsula engine + modeConfig + timer + score + persistence hooks.
3. **Event bus tipado o contrato estable**:
   - `MOVE_APPLIED`, `FUSION_GAINED`, `PUZZLE_SOLVED`, `TIMER_TICK`.
4. **Render incremental**:
   - actualizar solo celdas afectadas por move en vez de tablero completo.

## ¿Migrar a Canvas puro / WebGL / Three.js / React / ECS?
- **Canvas puro**: sí para board de alto rendimiento (un solo surface + hitmap), especialmente >8x8.
- **WebGL**: útil si quieres efectos/animaciones abundantes y móviles de gama media; no obligatorio en fase temprana.
- **Three.js**: solo si buscas estética 3D marcada; para puzzle 2D es sobrecoste.
- **React**: evitar para el loop de juego; sí opcional para shell (menús, tienda, perfil).
- **ECS**: recomendable cuando tengas múltiples entidades/estados (powerups, partículas, blockers). Prematuro hoy, pero ideal fase 2-3.
- **Game loop centralizado**: sí. Un loop con `requestAnimationFrame` para animaciones/timer y un canal de render invalidation.

## Organización engine vs UI ideal
- `engine/`: reglas puras, serialización, validación de movimientos, scoring.
- `runtime/`: sesión, loop, estados, timers, dificultad dinámica.
- `ui/`: render board/HUD, transiciones, accesibilidad.
- `data/`: niveles, progresión, assets manifest.
- `services/`: storage, analytics, monetización, leaderboard API.

---

## 3) Expansión a sistema de niveles

## Objetivo
Soportar dificultad variable, cronómetro, dark mode dinámico, historia e infinito procedural sin romper el core.

## JSON de nivel (propuesto)
```json
{
  "id": "mountain-night-01",
  "version": 1,
  "meta": {
    "title": "Noche en la Montaña",
    "author": "core",
    "theme": "night",
    "tags": ["intro", "relax"]
  },
  "board": {
    "rows": 4,
    "cols": 3,
    "aspect": "3:4",
    "snapTolerance": 0.22
  },
  "image": {
    "source": "procedural",
    "generator": "mountainNight",
    "fallbackAsset": "assets/mountain-night@1x.jpg"
  },
  "modes": {
    "classic": { "enabled": true },
    "timed": { "enabled": true, "seconds": 180 },
    "zen": { "enabled": true },
    "story": { "enabled": true, "chapter": 1 },
    "infinite": { "enabled": false }
  },
  "difficulty": {
    "tier": 1,
    "shuffleMinMoves": 18,
    "assistHints": 2
  },
  "rewards": {
    "stars": {
      "three": { "maxSeconds": 90 },
      "two": { "maxSeconds": 150 }
    },
    "coins": 25
  },
  "ui": {
    "darkMode": "auto",
    "musicPack": "calm-night"
  }
}
```

## Progresión
- Mundo → capítulo → nivel.
- Sistema 1-3 estrellas + monedas blandas.
- Desbloqueo por umbral de estrellas (no solo secuencial).
- Dailies y weekly challenge para retorno.

## Guardado
- **localStorage** para settings ligeros (mute, tema, última sesión).
- **IndexedDB** para progreso, estadísticas por nivel, replays/seed, imágenes del usuario.
- Snapshot por sesión:
  - `levelId`, `mode`, `boardState`, `elapsedMs`, `moves`, `fusedEdges`, `seed`.

---

## 4) Sistema de imágenes

## Subida de imágenes propias
- Input file + drag&drop + paste desde clipboard.
- Pipeline:
  1. validar MIME y tamaño,
  2. `createImageBitmap` para decode rápido,
  3. recorte inteligente (center/face-aware opcional),
  4. generar variantes (thumbnail, board-res, preview).

## Externas (URL)
- Solo via backend/proxy para evitar CORS impredecible y sanitizar.
- Descargar, recomprimir y cachear (hash por contenido).

## AssetManager (propuesto)
- API: `preload(levelConfig)`, `getPieceTexture(pieceId)`, `release(levelId)`.
- Cache en memoria por LRU + persistencia en IndexedDB para offline.
- Manifest versionado para invalidación limpia (`assets-vN`).

## Compresión / lazy / responsive
- WebP/AVIF cuando esté disponible; fallback JPEG.
- Calidad adaptativa según DPR y RAM estimada.
- Lazy load de niveles no activos.
- Resolución objetivo por device class (low/mid/high).

---

## 5) Sistema de sonido profesional

## Recomendación técnica
- Mantener **Web Audio API** como motor principal (mixing, gain nodes, efectos).
- `HTMLAudio` solo para fallback simple.

## Arquitectura
- `audio/`
  - `AudioEngine.js` (contexto + buses)
  - `SfxBank.js` (move/fuse/win/drag)
  - `MusicController.js` (ambient loops, crossfade)
  - `AudioSettingsStore.js` (persistencia)

## Features clave
- Buses separados: `master`, `music`, `sfx`, `ui`.
- Volumen por bus + mute persistente en storage.
- Ducking suave: bajar música al ganar o al fusionar cadena.
- Variantes de pitch aleatorio en drag/fuse para evitar fatiga auditiva.

---

## 6) Mejoras de game design (valor real vs gimmick)

## Alto valor real
1. **Modo cronometrado con medallas**: incrementa rejugabilidad y share de score.
2. **Logros + misiones diarias**: retención D1/D7.
3. **Leaderboard async por semilla diaria**: competencia sana sin sincronía en tiempo real.
4. **Hints limitados y bien costeados**: reduce frustración sin romper desafío.
5. **Modo zen/nocturno**: amplía audiencia (relax/casual).

## Valor medio
- Piezas bloqueadas y objetivos secundarios (agregan variedad).
- Fusión progresiva con animaciones (mejora percepción de calidad).

## Riesgo de gimmick (si se implementa aislado)
- Gravedad compleja sin rediseñar niveles.
- Rotación de piezas en todos los modos (eleva fricción y duración excesiva).
- Powerups “arcade” excesivos que desvirtúan la fantasía de puzzle calmado.

---

## 7) UX/UI profesional

## Diagnóstico
- Minimalismo correcto, pero aún “técnico” más que emocional.
- Falta una jerarquía de onboarding y feedback de progreso macro.

## Recomendaciones
- **Primera sesión guiada** (micro tutorial contextual, no modal largo).
- **Feedback multimodal**: glow + sonido + microvibración (si disponible) al fusionar.
- **Motion system consistente**: duraciones fijas (120/180/240ms) y easing uniforme.
- **Móvil**: hit targets >44px, evitar accidental scroll, HUD “thumb-friendly”.
- **Accesibilidad WCAG**:
  - contraste AA,
  - modo alto contraste,
  - texto escalable,
  - reducción de animaciones (`prefers-reduced-motion`).
- **Teclado/gamepad**:
  - navegación por foco de celdas,
  - pick/place con Enter/Space,
  - d-pad para mover selección.

---

## 8) Performance & optimización

## Riesgos actuales
- Render completo por `move`.
- Creación frecuente de estructuras temporales (arrays/map/filter) en hot paths.
- Cálculo repetido de fusiones y BFS por interacción.

## Plan técnico
1. **Dirty rectangles / updates incrementales** para celdas afectadas.
2. **Cache de fused graph** invalidado tras `applyMove`.
3. **Pool de arrays temporales** para reducir GC spikes.
4. **`requestAnimationFrame` loop** para animaciones, no para lógica discreta.
5. **OffscreenCanvas + Worker** para slicing/generación pesada de imagen.
6. **Perf budget**:
   - frame < 16ms en mid devices,
   - boot < 2.5s,
   - memoria estable en sesiones largas.

---

## 9) Conversión a producto serio

## Itch.io / web comercial
- Build web empaquetada + page bien curada (trailer corto, GIF loops, devlog).
- Demo gratis + versión “supporter” con packs estéticos.

## Monetización indie viable
- Free base + anuncios opcionales recompensados (hints/undo).
- Premium one-time purchase: sin ads + niveles exclusivos + temas.
- DLC ligero por temporadas artísticas.

## PWA instalable real
- Mejorar install prompt UX, offline-first robusto, versionado de cache y migraciones.
- Añadir analytics privacy-friendly (eventos agregados).

## App móvil / escritorio
- **Capacitor**: camino más directo para iOS/Android desde web app.
- **Tauri/Electron**: desktop builds; Tauri preferible por peso.
- **Steam ligera**: wrapper desktop + logros + cloud saves + trading cards (fase avanzada).

---

## 10) Roadmap en 4 fases

## Fase 1 — Mejoras inmediatas (2-4 semanas)
- Persistencia de settings (mute/tema) y progreso básico.
- Modo cronometrado + medallas.
- Optimización de render incremental inicial.
- Tutorial breve y mejoras de feedback.

## Fase 2 — Arquitectura sólida (4-8 semanas)
- Refactor engine puro + `GameSession` + `AssetManager`.
- Sistema de niveles JSON + registry + loader.
- IndexedDB para progreso/imagenes.
- Pipeline de métricas de producto (retención, completion rate).

## Fase 3 — Expansión creativa (6-10 semanas)
- Modo historia + diario por seed.
- Leaderboards async + logros.
- UGC de imágenes con moderación básica.
- Audio profesional por buses + música adaptativa.

## Fase 4 — Producto comercial (8-12 semanas)
- Packaging Itch + mobile wrappers.
- Monetización híbrida y tienda cosmética.
- Localización (EN/ES/PT al menos).
- Campaña de lanzamiento: comunidad + influencers nicho puzzle/relax.

---

## Priorización estratégica
1. **Retención primero** (modos + progresión + dailies).
2. **Performance segundo** (fluidez en móviles define reviews).
3. **Viral loops tercero** (challenges compartibles).
4. **Monetización después de validar engagement** (no antes).

Si ejecutas ese orden, maximizas probabilidad de pasar de “buen prototipo” a “producto rentable”.
