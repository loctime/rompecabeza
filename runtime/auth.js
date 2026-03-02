import { UserRepository } from '../storage/persistence.js';

const ACTIVE_USER_KEY = 'identity:activeUserId';

/** @interface */
export class AuthProvider {
  async init() {}
  async listUsers() { return []; }
  async getCurrentUser() { return null; }
  async login() {}
  async logout() {}
  async createUser() { return null; }
  onChange() { return () => {}; }
}

export class LocalAuthProvider extends AuthProvider {
  constructor() {
    super();
    this.userRepo = new UserRepository();
    this.currentUser = null;
    this.listeners = new Set();
  }

  async init() {
    let users = await this.userRepo.listUsers();
    if (!users.length) {
      const defaultUser = { userId: 'default', displayName: 'Jugador local' };
      await this.userRepo.upsertUser(defaultUser);
      users = [await this.userRepo.getUser('default')];
    }
    const storedId = localStorage.getItem(ACTIVE_USER_KEY) || users[0].userId;
    const selected = users.find((u) => u.userId === storedId) || users[0];
    this.currentUser = selected;
    localStorage.setItem(ACTIVE_USER_KEY, selected.userId);
    this._emit();
    return selected;
  }

  async listUsers() {
    return this.userRepo.listUsers();
  }

  async getCurrentUser() {
    return this.currentUser;
  }

  async login(userId) {
    const user = await this.userRepo.getUser(userId);
    if (!user) return null;
    this.currentUser = user;
    localStorage.setItem(ACTIVE_USER_KEY, user.userId);
    this._emit();
    return user;
  }

  async logout() {
    return this.login('default');
  }

  async createUser(displayName) {
    const clean = String(displayName || '').trim();
    if (!clean) return null;
    const userId = `u-${clean.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${Date.now().toString(36)}`;
    await this.userRepo.upsertUser({ userId, displayName: clean });
    return this.login(userId);
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _emit() {
    this.listeners.forEach((fn) => fn(this.currentUser));
  }
}
