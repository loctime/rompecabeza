export class HUD {
  constructor({ statusEl, winEl, shuffleBtn, replayBtn, nextLevelBtn, levelsBtn, downloadBtn, winStatsEl, authContainer }) {
    this.statusEl = statusEl;
    this.winEl = winEl;
    this.shuffleBtn = shuffleBtn;
    this.replayBtn = replayBtn;
    this.nextLevelBtn = nextLevelBtn;
    this.levelsBtn = levelsBtn;
    this.downloadBtn = downloadBtn;
    this.winStatsEl = winStatsEl;
    this.authContainer = authContainer;
    this.currentUser = null;
    
    this.setupAuthUI();
  }

  update(snapshot) {
    if (!this.statusEl) return;
    const seconds = Math.floor(snapshot.elapsedMs / 1000);
    this.statusEl.textContent = `${snapshot.fusedEdges}/${snapshot.totalEdges} · mov:${snapshot.moveCount} · t:${seconds}s · score:${snapshot.score}`;
  }

  showWin() { this.winEl.classList.add('show'); }
  hideWin() { this.winEl.classList.remove('show'); }

  /** Oculta status y botón mezclar (HUD de juego) para la secuencia AAA. */
  hideGameHUD() {
    if (this.statusEl) this.statusEl.style.visibility = 'hidden';
    if (this.shuffleBtn) this.shuffleBtn.style.visibility = 'hidden';
  }

  /** Muestra de nuevo el HUD de juego. */
  showGameHUD() {
    if (this.statusEl) this.statusEl.style.visibility = '';
    if (this.shuffleBtn) this.shuffleBtn.style.visibility = '';
  }

  /**
   * Muestra el banner de completado con stats y CTAs (después de la cinemática).
   * options = { hasNextLevel, onNextLevel, onReplay, onLevels, onDownload }
   */
  showCompletionBanner(stats, options = {}) {
    if (this.winStatsEl) {
      const sec = Math.floor((stats.elapsedMs || 0) / 1000);
      this.winStatsEl.textContent = `Movimientos: ${stats.moveCount ?? 0} · Tiempo: ${sec}s · Puntos: ${stats.score ?? 0}`;
    }
    if (this.nextLevelBtn) {
      this.nextLevelBtn.style.display = options.hasNextLevel ? '' : 'none';
      this.nextLevelBtn.onclick = options.onNextLevel || null;
    }
    if (this.replayBtn) this.replayBtn.onclick = () => options.onReplay?.();
    if (this.levelsBtn) this.levelsBtn.onclick = () => options.onLevels?.();
    if (this.downloadBtn) this.downloadBtn.onclick = () => options.onDownload?.();
    this.winEl.classList.add('show');
  }

  onShuffle(fn) { if (this.shuffleBtn) this.shuffleBtn.onclick = fn; }
  onReplay(fn) { if (this.replayBtn) this.replayBtn.onclick = fn; }

  setupAuthUI() {
    if (!this.authContainer) return;

    this.authContainer.innerHTML = `
      <div class="auth-section">
        <div id="auth-login" class="auth-login">
          <button id="google-login-btn" class="auth-btn google-btn">
            <span class="btn-icon">🔗</span>
            Login con Google
          </button>
        </div>
        <div id="auth-user" class="auth-user" style="display: none;">
          <div class="user-info">
            <span id="user-email" class="user-email"></span>
            <span class="sync-indicator" id="sync-indicator">☁️</span>
          </div>
          <button id="logout-btn" class="auth-btn logout-btn">Cerrar sesión</button>
        </div>
        <div id="auth-loading" class="auth-loading" style="display: none;">
          <span>Cargando...</span>
        </div>
        <div id="auth-error" class="auth-error" style="display: none;"></div>
      </div>
    `;

    this.setupAuthEventListeners();
  }

  setupAuthEventListeners() {
    const googleBtn = document.getElementById('google-login-btn');
    const logoutBtn = document.getElementById('logout-btn');

    googleBtn?.addEventListener('click', () => this.handleGoogleLogin());
    logoutBtn?.addEventListener('click', () => this.handleLogout());
  }

  async handleGoogleLogin() {
    this.showAuthLoading(true);
    this.hideAuthError();
    
    try {
      const { signInWithGoogle } = await import('../firebase/authService.js');
      await signInWithGoogle();
    } catch (error) {
      this.showAuthError('Error al iniciar sesión con Google');
      console.error('Google login error:', error);
    } finally {
      this.showAuthLoading(false);
    }
  }

  async handleLogout() {
    this.showAuthLoading(true);
    
    try {
      const { signOutUser } = await import('../firebase/authService.js');
      await signOutUser();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.showAuthLoading(false);
    }
  }

  updateUserInfo(user) {
    this.currentUser = user;
    const loginSection = document.getElementById('auth-login');
    const userSection = document.getElementById('auth-user');
    const userEmail = document.getElementById('user-email');

    if (user) {
      loginSection.style.display = 'none';
      userSection.style.display = 'flex';
      if (userEmail) userEmail.textContent = user.email;
    } else {
      loginSection.style.display = 'block';
      userSection.style.display = 'none';
    }
  }

  showAuthLoading(show) {
    const loadingEl = document.getElementById('auth-loading');
    if (loadingEl) {
      loadingEl.style.display = show ? 'block' : 'none';
    }
  }

  showAuthError(message) {
    const errorEl = document.getElementById('auth-error');
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.style.display = 'block';
    }
  }

  hideAuthError() {
    const errorEl = document.getElementById('auth-error');
    if (errorEl) {
      errorEl.style.display = 'none';
    }
  }

  showSyncIndicator(show) {
    const indicator = document.getElementById('sync-indicator');
    if (indicator) {
      indicator.style.display = show ? 'inline' : 'none';
    }
  }
}
