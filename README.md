# Puzzle Platform

Base arquitectónica para una plataforma de juegos de puzzle.

## Estructura

```
puzzle-platform/
├── index.html              # Shell HTML, sin lógica
├── main.js                 # Orquestador — conecta todos los módulos
│
├── engine/
│   ├── PuzzleEngine.js     # Lógica pura del juego (sin DOM)
│   └── DragController.js   # Input de drag (mouse + touch)
│
├── levels/
│   └── mountainNight.js    # Nivel 1: imagen procedural de montañas
│
├── audio/
│   └── AudioManager.js     # Sonidos sintetizados (Web Audio API)
│
└── ui/
    ├── BoardUI.js          # Renderizado del tablero
    ├── HUD.js              # Status, win overlay, botones
    └── styles.css          # Estilos globales
```

## Cómo agregar un nivel

1. Copia `levels/mountainNight.js` → `levels/miNivel.js`
2. Cambia `cols`, `rows`, `boardW`, `boardH` según necesites
3. Reemplaza `generateImage()` con tu propia imagen:
   - **Procedural:** dibuja en canvas con la API 2D
   - **Foto:** carga una imagen con `new Image()` y pégala en canvas
4. En `main.js`, cambia la importación:
   ```js
   import { miNivel } from './levels/miNivel.js';
   const LEVEL = miNivel;
   ```

## Cómo agregar un sonido

En `audio/AudioManager.js`, agrega una entrada en `this._sounds`:
```js
this._sounds = {
  move: ...,
  fuse: ...,
  win:  ...,
  tuSonido: (ctx) => this._synthTuSonido(ctx),
};
```
Luego implementa `_synthTuSonido(ctx)` y llama `audio.play('tuSonido')` desde donde necesites.

## Uso

Sirve la carpeta con cualquier servidor HTTP (requerido por ES modules):

```bash
npx serve .
# o
python3 -m http.server 8080
```

Abre `http://localhost:8080` en el navegador.

> **Nota:** No funciona abriendo `index.html` directamente como `file://` por las restricciones CORS de ES modules. Usa siempre un servidor local.

## Eventos del engine

`PuzzleEngine` emite eventos que puedes escuchar:

```js
engine.on('move', () => { /* pieza movida */ });
engine.on('fuse', () => { /* nueva fusión */ });
engine.on('win',  () => { /* puzzle completo */ });
```

## Escalabilidad pensada

- **Múltiples juegos:** cada nivel es un archivo independiente
- **Temas visuales:** solo cambia `ui/styles.css`
- **Mecánicas nuevas:** extiende `PuzzleEngine` o crea un nuevo engine
- **Audio real:** en `AudioManager`, reemplaza los métodos `_synth*` con `fetch` + `decodeAudioData`
- **Persistencia:** agrega un módulo `storage/` que lea/escriba `localStorage`
- **Multijugador:** el engine es puro — serializa `board` y sincroniza vía WebSocket
