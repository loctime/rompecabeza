export class HUD {
  constructor({ statusEl, winEl, shuffleBtn, replayBtn }) {
    this.statusEl = statusEl;
    this.winEl = winEl;
    this.shuffleBtn = shuffleBtn;
    this.replayBtn = replayBtn;
  }

  update(snapshot) {
    const seconds = Math.floor(snapshot.elapsedMs / 1000);
    this.statusEl.textContent = `${snapshot.fusedEdges}/${snapshot.totalEdges} fusionadas · mov:${snapshot.moveCount} · t:${seconds}s · score:${snapshot.score}`;
  }

  showWin() { this.winEl.classList.add('show'); }
  hideWin() { this.winEl.classList.remove('show'); }

  onShuffle(fn) { this.shuffleBtn.onclick = fn; }
  onReplay(fn) { this.replayBtn.onclick = fn; }
}
