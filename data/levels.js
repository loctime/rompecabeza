import { mountainNight } from '../levels/mountainNight.js';

const dawnValley = {
  id: 'dawn-valley',
  meta: { title: 'Valle del Alba', difficulty: 2 },
  board: { cols: 4, rows: 4, boardW: 400, boardH: 400 },
  image: {
    type: 'generator',
    generate: async () => {
      const cv = document.createElement('canvas');
      cv.width = 400;
      cv.height = 400;
      const ctx = cv.getContext('2d');
      const sky = ctx.createLinearGradient(0, 0, 0, 400);
      sky.addColorStop(0, '#1f2b5e');
      sky.addColorStop(1, '#e98b6d');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, 400, 400);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      for (let i = 0; i < 60; i++) ctx.fillRect(Math.random() * 400, Math.random() * 210, 2, 2);
      ctx.fillStyle = '#243b55';
      ctx.beginPath();
      ctx.moveTo(0, 320); ctx.lineTo(100, 170); ctx.lineTo(220, 310); ctx.lineTo(340, 180); ctx.lineTo(400, 300); ctx.lineTo(400, 400); ctx.lineTo(0, 400); ctx.closePath();
      ctx.fill();
      return cv;
    },
  },
};

export const levels = [
  {
    id: mountainNight.id,
    meta: { title: mountainNight.title, difficulty: 1 },
    board: { cols: mountainNight.cols, rows: mountainNight.rows, boardW: mountainNight.boardW, boardH: mountainNight.boardH },
    image: { type: 'generator', generate: mountainNight.generateImage.bind(mountainNight) },
  },
  dawnValley,
];

export function getLevelById(id) {
  return levels.find((l) => l.id === id) || levels[0];
}
