export class HUD {
  constructor({ statusEl, winEl, shuffleBtn, replayBtn, levelSelectEl, modeSelectEl, muteBtn }) {
    this.statusEl = statusEl;
    this.winEl = winEl;
    this.shuffleBtn = shuffleBtn;
    this.replayBtn = replayBtn;
    this.levelSelectEl = levelSelectEl;
    this.modeSelectEl = modeSelectEl;
    this.muteBtn = muteBtn;
  }

  update(snapshot) {
    const seconds = Math.floor(snapshot.elapsedMs / 1000);
    this.statusEl.textContent = `${snapshot.fusedEdges}/${snapshot.totalEdges} fusionadas · mov:${snapshot.moveCount} · t:${seconds}s · score:${snapshot.score}`;
  }

  showWin() { this.winEl.classList.add('show'); }
  hideWin() { this.winEl.classList.remove('show'); }

  onShuffle(fn) { this.shuffleBtn.onclick = fn; }
  onReplay(fn) { this.replayBtn.onclick = fn; }
  onLevelChange(fn) { this.levelSelectEl.onchange = () => fn(this.levelSelectEl.value); }
  onModeChange(fn) { this.modeSelectEl.onchange = () => fn(this.modeSelectEl.value); }
  onMute(fn) { this.muteBtn.onclick = fn; }

  setMuteLabel(muted) { this.muteBtn.textContent = muted ? 'sonido: off' : 'sonido: on'; }
}
