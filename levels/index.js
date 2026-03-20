/**
 * Sistema escalable de niveles para Puzzle Platform
 * Importa niveles de packs y los exporta como CLASSIC_LEVELS
 */

import { mountainNight } from './mountainNight.js';

// Niveles clásicos importados desde archivos JS
const JS_LEVELS = [
  mountainNight,
];

// Función para convertir niveles JSON al formato esperado
function convertJsonLevel(jsonLevel, index) {
  const gridSize = jsonLevel.grid || 3;
  const boardSize = 120 * gridSize; // 120px por pieza
  
  return {
    id: jsonLevel.id,
    name: jsonLevel.title || jsonLevel.id,
    title: jsonLevel.title || jsonLevel.id,
    cols: gridSize,
    rows: gridSize,
    boardW: boardSize,
    boardH: boardSize,
    difficulty: jsonLevel.difficulty || 1,
    theme: jsonLevel.theme || 'clasico',
    packId: 'clasico',
    
    // Función para generar imagen desde URL
    async generateImage() {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = this.boardW;
          canvas.height = this.boardH;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, this.boardW, this.boardH);
          resolve(canvas);
        };
        img.onerror = () => reject(new Error(`No se pudo cargar imagen: ${jsonLevel.image}`));
        img.src = jsonLevel.image;
      });
    },
    
    // Metadata para UI
    meta: {
      title: jsonLevel.title || jsonLevel.id,
      difficulty: jsonLevel.difficulty || 1,
      theme: jsonLevel.theme || 'clasico'
    }
  };
}

// Cargar niveles desde packs JSON (simulado asíncrono)
async function loadJsonLevels() {
  try {
    // En un entorno real, esto podría ser fetch dinámico
    // Por ahora, incluimos los datos del pack-clasico.json directamente
    const classicPackData = {
      "id": "clasico",
      "name": "Clásico",
      "levels": [
        { "id": "nivel-01", "image": "/assets/levels/nivel-01.jpg", "grid": 3, "theme": "clasico", "title": "Montaña", "difficulty": 1 },
        { "id": "nivel-02", "image": "/assets/levels/nivel-02.jpg", "grid": 3, "theme": "clasico", "title": "Playa", "difficulty": 1 },
        { "id": "nivel-03", "image": "/assets/levels/nivel-03.jpg", "grid": 3, "theme": "clasico", "title": "Bosque", "difficulty": 1 },
        { "id": "nivel-04", "image": "/assets/levels/nivel-04.jpg", "grid": 4, "theme": "clasico", "title": "Desierto", "difficulty": 2 },
        { "id": "nivel-05", "image": "/assets/levels/nivel-05.jpg", "grid": 4, "theme": "clasico", "title": "Cascada", "difficulty": 2 },
        { "id": "nivel-06", "image": "/assets/levels/nivel-06.jpg", "grid": 4, "theme": "clasico", "title": "Lago", "difficulty": 2 },
        { "id": "nivel-07", "image": "/assets/levels/nivel-07.jpg", "grid": 5, "theme": "clasico", "title": "Atardecer", "difficulty": 3 },
        { "id": "nivel-08", "image": "/assets/levels/nivel-08.jpg", "grid": 5, "theme": "clasico", "title": "Cañón", "difficulty": 3 },
        { "id": "nivel-09", "image": "/assets/levels/nivel-09.jpg", "grid": 5, "theme": "clasico", "title": "Nieve", "difficulty": 3 },
        { "id": "nivel-10", "image": "/assets/levels/nivel-10.jpg", "grid": 6, "theme": "clasico", "title": "Valle", "difficulty": 4 }
      ]
    };
    
    return classicPackData.levels.map((level, index) => convertJsonLevel(level, index));
  } catch (error) {
    console.error('Error cargando niveles JSON:', error);
    return [];
  }
}

// Niveles clásicos combinados (JS + JSON)
export let CLASSIC_LEVELS = [...JS_LEVELS];

// Inicializar niveles JSON asíncronamente
export async function initializeLevels() {
  try {
    const jsonLevels = await loadJsonLevels();
    CLASSIC_LEVELS = [...JS_LEVELS, ...jsonLevels];
    console.log(`Niveles inicializados: ${CLASSIC_LEVELS.length} niveles totales`);
    return CLASSIC_LEVELS;
  } catch (error) {
    console.error('Error inicializando niveles:', error);
    return CLASSIC_LEVELS;
  }
}

// Obtener nivel por índice
export function getLevelByIndex(index) {
  return CLASSIC_LEVELS[index] || null;
}

// Obtener nivel por ID
export function getLevelById(id) {
  return CLASSIC_LEVELS.find(level => level.id === id) || null;
}

// Contar niveles totales
export function getLevelCount() {
  return CLASSIC_LEVELS.length;
}

// Verificar si un nivel existe
export function levelExists(index) {
  return index >= 0 && index < CLASSIC_LEVELS.length;
}

// Exportar niveles individuales para compatibilidad
export { mountainNight };
