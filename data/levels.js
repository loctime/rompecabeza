const BOARD_W = 480;
const BOARD_H = 360;

// Títulos amigables para los 50 niveles (coinciden con las imágenes descargadas).
const TITLES = [
  'Montaña', 'Playa', 'Bosque', 'Desierto', 'Cascada',
  'Lago', 'Atardecer', 'Cañón', 'Nieve', 'Valle',
  'Río', 'Acantilado', 'Aurora', 'Pradera', 'Volcán',
  'Selva', 'Tundra', 'Sabana', 'Isla', 'Niebla',
  'León', 'Elefante', 'Águila', 'Lobo', 'Delfín',
  'Tigre', 'Oso', 'Zorro', 'Pingüino', 'Ciervo',
  'Ballena', 'Mariposa', 'Jirafa', 'Loro', 'Caballo',
  'Guepardo', 'Flamenco', 'Tortuga', 'Koala', 'Búho',
  'Cactus', 'Rosa', 'Bambú', 'Girasol', 'Helecho',
  'Cerezo', 'Orquídea', 'Hongo', 'Lavanda', 'Loto',
];

// Ciclo de tamaños de rejilla: vuelve a empezar cada 5 niveles.
const GRID_PATTERNS = [
  { cols: 3, rows: 4 }, // paso 0  → niveles 1,6,11,...
  { cols: 4, rows: 4 }, // paso 1
  { cols: 4, rows: 5 }, // paso 2
  { cols: 5, rows: 5 }, // paso 3
  { cols: 5, rows: 6 }, // paso 4
];

async function loadImageCanvas(path, width, height) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement('canvas');
      cv.width = width;
      cv.height = height;
      const ctx = cv.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      resolve(cv);
    };
    img.onerror = (err) => reject(err || new Error(`No se pudo cargar la imagen ${path}`));
    img.src = path;
  });
}

export const levels = Array.from({ length: 50 }, (_, idx) => {
  const n = idx + 1;
  const pattern = GRID_PATTERNS[idx % GRID_PATTERNS.length];
  const id = `nivel-${String(n).padStart(2, '0')}`;
  const title = TITLES[idx] || `Nivel ${n}`;
  const difficulty = (idx % GRID_PATTERNS.length) + 1; // 1..5
  const imagePath = `./assets/levels/${id}.jpg`;

  return {
    id,
    meta: { title, difficulty },
    board: { cols: pattern.cols, rows: pattern.rows, boardW: BOARD_W, boardH: BOARD_H },
    image: {
      type: 'file',
      generate: () => loadImageCanvas(imagePath, BOARD_W, BOARD_H),
    },
  };
});

export function getLevelById(id) {
  return levels.find((l) => l.id === id) || levels[0];
}

