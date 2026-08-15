import Phaser from 'phaser';
import { eventBus } from './core'; // circular? We'll define eventBus here.
export class Game extends Phaser.Game {
  constructor(config: Phaser.Types.Core.GameConfig) { super(config); }
}

// Event Bus
type Handler<T> = (payload: T) => void;
class EventBus {
  private handlers = new Map<string, Set<Function>>();
  on<T>(event: string, handler: Handler<T>) { if (!this.handlers.has(event)) this.handlers.set(event, new Set()); this.handlers.get(event)!.add(handler); return () => this.off(event, handler); }
  off<T>(event: string, handler: Handler<T>) { this.handlers.get(event)?.delete(handler); }
  emit<T>(event: string, payload: T) { this.handlers.get(event)?.forEach(h => (h as Handler<T>)(payload)); }
  clear() { this.handlers.clear(); }
}
export const eventBus = new EventBus();

// Service Locator
export class ServiceLocator {
  private services = new Map<string, unknown>();
  register<T>(name: string, service: T) { this.services.set(name, service); return service; }
  get<T>(name: string): T { const s = this.services.get(name); if (!s) throw new Error(`Service ${name} not found`); return s as T; }
  has(name: string) { return this.services.has(name); }
  clear() { this.services.clear(); }
}
export const serviceLocator = new ServiceLocator();

// Object Pool
export class ObjectPool<T> {
  private pool: T[] = [];
  constructor(private factory: () => T, private reset?: (item: T) => void, initialSize = 10) { for (let i = 0; i < initialSize; i++) this.pool.push(factory()); }
  acquire() { return this.pool.pop() ?? this.factory(); }
  release(item: T) { this.reset?.(item); this.pool.push(item); }
}

// Damage Types and Interfaces
export enum DamageType { Bullet='bullet', Explosion='explosion', Melee='melee', Fire='fire', Poison='poison', Environment='environment' }
export interface DamageInfo { amount: number; source?: unknown; bodyPartMultiplier?: number; damageType: DamageType; }
export interface IDamageable { maxHealth: number; readonly currentHealth: number; readonly isAlive: boolean; takeDamage(info: DamageInfo): void; heal(amount: number): void; }

// Health System
export class HealthSystem implements IDamageable {
  maxHealth: number; private _currentHealth: number;
  get currentHealth() { return this._currentHealth; }
  get isAlive() { return this._currentHealth > 0; }
  constructor(maxHealth = 100) { this.maxHealth = maxHealth; this._currentHealth = maxHealth; }
  takeDamage(info: DamageInfo) {
    if (!this.isAlive) return;
    const mult = info.bodyPartMultiplier ?? 1;
    this._currentHealth = Math.max(0, this._currentHealth - info.amount * mult);
    eventBus.emit('health-changed', { current: this._currentHealth, max: this.maxHealth, source: info.source });
    if (this._currentHealth <= 0) eventBus.emit('entity-died', { target: this, source: info.source });
  }
  heal(amount: number) { if (!this.isAlive) return; this._currentHealth = Math.min(this.maxHealth, this._currentHealth + amount); eventBus.emit('health-changed', { current: this._currentHealth, max: this.maxHealth, source: null }); }
}

// Save System (simplified, no encryption for brevity)
export class SaveSystem {
  private prefix = 'stickman-save-';
  constructor() { serviceLocator.register('SaveSystem', this); }
  saveSync(slot: number, data: any) { localStorage.setItem(this.prefix + slot, JSON.stringify(data)); }
  loadSync(slot: number): any { const d = localStorage.getItem(this.prefix + slot); return d ? JSON.parse(d) : null; }
}

// Audio Manager (procedural)
export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  constructor() { serviceLocator.register('AudioManager', this); document.addEventListener('click', () => this.init(), { once: true }); }
  private init() {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.5;
    this.masterGain.connect(this.ctx.destination);
    // Start ambient music
    const osc = this.ctx.createOscillator(); osc.frequency.value = 220; osc.type = 'sine';
    const gain = this.ctx.createGain(); gain.gain.value = 0.1;
    osc.connect(gain); gain.connect(this.masterGain); osc.start();
  }
  playUI() { this.playTone(800, 0.05); }
  playGunshot() { this.playNoise(0.1, 0.2); }
  playExplosion() { this.playNoise(0.5, 0.5); }
  setVolume(channel: string, value: number) { if (this.masterGain) this.masterGain.gain.value = value; }
  private playTone(freq: number, duration: number) { if (!this.ctx || !this.masterGain) return; const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain(); osc.frequency.value = freq; gain.gain.setValueAtTime(0.1, this.ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration); osc.connect(gain); gain.connect(this.masterGain); osc.start(); osc.stop(this.ctx.currentTime + duration); }
  private playNoise(duration: number, volume: number) { if (!this.ctx || !this.masterGain) return; const bufferSize = this.ctx.sampleRate * duration; const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate); const data = buffer.getChannelData(0); for (let i = 0; i < bufferSize; i++) data[i] = (Math.random()*2-1)*volume; const src = this.ctx.createBufferSource(); src.buffer = buffer; src.connect(this.masterGain); src.start(); }
}

// Particle Manager (basic, will be extended in entities)
export class ParticleManager {
  constructor(private scene: Phaser.Scene) {}
  emitMuzzleFlash(x: number, y: number) {
    const particles = this.scene.add.particles(x, y, 'particle', { speed: {min:50,max:150}, angle: {min:0,max:360}, lifespan:100, quantity:5, tint: [0xffff00,0xffaa00] });
    this.scene.time.delayedCall(200, () => particles.destroy());
  }
  emitBlood(x: number, y: number) {
    const particles = this.scene.add.particles(x, y, 'particle', { speed: {min:100,max:300}, angle: {min:0,max:360}, gravityY:800, lifespan:400, quantity:10, tint: [0xff0000,0x990000] });
    this.scene.time.delayedCall(500, () => particles.destroy());
  }
  emitExplosion(x: number, y: number, radius: number) {
    const particles = this.scene.add.particles(x, y, 'particle', { speed: {min:200,max:500}, angle: {min:0,max:360}, lifespan:600, quantity:30, tint: [0xff6600,0xff3300,0xffff00] });
    this.scene.time.delayedCall(800, () => particles.destroy());
  }
}

// Progression Manager
export class ProgressionManager {
  data: any = { xp:0, rank:1, coins:0, gems:0, unlockedWeapons:['m1911','knife'], stats:{} };
  private saveSystem: SaveSystem;
  constructor() { this.saveSystem = serviceLocator.get('SaveSystem'); const saved = this.saveSystem.loadSync(0); if (saved?.playerProfile) this.data = saved.playerProfile; serviceLocator.register('ProgressionManager', this); }
  addXP(amount: number) { this.data.xp += amount; this.data.rank = Math.floor(this.data.xp/1000)+1; this.save(); }
  addCoins(amount: number) { this.data.coins += amount; this.save(); }
  addGems(amount: number) { this.data.gems += amount; this.save(); }
  unlockWeapon(id: string) { if (!this.data.unlockedWeapons.includes(id)) { this.data.unlockedWeapons.push(id); this.save(); } }
  isWeaponUnlocked(id: string) { return this.data.unlockedWeapons.includes(id); }
  save() { const save = this.saveSystem.loadSync(0) || {}; save.playerProfile = this.data; this.saveSystem.saveSync(0, save); }
}

// Achievement Manager (simplified)
export class AchievementManager {
  constructor() { serviceLocator.register('AchievementManager', this); }
  check(stats: Record<string, number>) { /* minimal */ }
}
