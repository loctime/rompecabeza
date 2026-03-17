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

    // Crear estructura básica del UI de autenticación
    this.authContainer.innerHTML = `
      <div class="auth-section">
        <div id="auth-login" class="auth-login">
          <button id="google-login-btn" class="auth-btn google-btn">
            <span class="btn-icon">🔗</span>
            Continuar con Google
          </button>
          <div class="auth-divider">o</div>
          <div class="email-login">
            <input type="email" id="email-input" placeholder="Email" class="auth-input">
            <input type="password" id="password-input" placeholder="Contraseña" class="auth-input">
            <button id="email-login-btn" class="auth-btn email-btn">Iniciar sesión</button>
            <button id="email-signup-btn" class="auth-btn signup-btn">Registrarse</button>
          </div>
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

    // Agregar event listeners
    this.setupAuthEventListeners();
  }

  setupAuthEventListeners() {
    const googleBtn = document.getElementById('google-login-btn');
    const emailLoginBtn = document.getElementById('email-login-btn');
    const emailSignupBtn = document.getElementById('email-signup-btn');
    const logoutBtn = document.getElementById('logout-btn');

    googleBtn?.addEventListener('click', () => this.handleGoogleLogin());
    emailLoginBtn?.addEventListener('click', () => this.handleEmailLogin());
    emailSignupBtn?.addEventListener('click', () => this.handleEmailSignup());
    logoutBtn?.addEventListener('click', () => this.handleLogout());

    // Enter key para login
    const passwordInput = document.getElementById('password-input');
    passwordInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.handleEmailLogin();
    });
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

  async handleEmailLogin() {
    const emailInput = document.getElementById('email-input');
    const passwordInput = document.getElementById('password-input');
    
    const email = emailInput?.value?.trim();
    const password = passwordInput?.value;

    if (!email || !password) {
      this.showAuthError('Por favor ingresa email y contraseña');
      return;
    }

    this.showAuthLoading(true);
    this.hideAuthError();

    try {
      const { signInWithEmail } = await import('../firebase/authService.js');
      await signInWithEmail(email, password);
    } catch (error) {
      let message = 'Error al iniciar sesión';
      if (error.code === 'auth/user-not-found') message = 'Usuario no encontrado';
      else if (error.code === 'auth/wrong-password') message = 'Contraseña incorrecta';
      else if (error.code === 'auth/invalid-email') message = 'Email inválido';
      
      this.showAuthError(message);
      console.error('Email login error:', error);
    } finally {
      this.showAuthLoading(false);
    }
  }

  async handleEmailSignup() {
    const emailInput = document.getElementById('email-input');
    const passwordInput = document.getElementById('password-input');
    
    const email = emailInput?.value?.trim();
    const password = passwordInput?.value;

    if (!email || !password) {
      this.showAuthError('Por favor ingresa email y contraseña');
      return;
    }

    if (password.length < 6) {
      this.showAuthError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    this.showAuthLoading(true);
    this.hideAuthError();

    try {
      const { signUpWithEmail } = await import('../firebase/authService.js');
      await signUpWithEmail(email, password);
    } catch (error) {
      let message = 'Error al registrarse';
      if (error.code === 'auth/email-already-in-use') message = 'El email ya está registrado';
      else if (error.code === 'auth/weak-password') message = 'Contraseña muy débil';
      else if (error.code === 'auth/invalid-email') message = 'Email inválido';
      
      this.showAuthError(message);
      console.error('Email signup error:', error);
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
