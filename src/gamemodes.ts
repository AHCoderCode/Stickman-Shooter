import Phaser from 'phaser';
import { eventBus } from './core';
import { AIManager } from './ai';

export enum GameMode { Campaign='campaign', Survival='survival', Skirmish='skirmish', BossRush='boss', TimeTrial='trial' }
export interface GameModeConfig { mode: GameMode; levelKey?: string; difficulty?: string; botConfig?: any; waveConfig?: any; }

export class GameModeManager {
  private sub: any;
  constructor(private scene: Phaser.Scene, config: GameModeConfig) {
    switch (config.mode) {
      case GameMode.Survival: this.sub = new SurvivalManager(scene); break;
      case GameMode.Skirmish: this.sub = new SkirmishManager(scene); break;
      case GameMode.TimeTrial: this.sub = new TimeTrialManager(scene); break;
      case GameMode.BossRush: this.sub = new BossRushManager(scene); break;
      default: break;
    }
    this.sub?.start?.();
  }
  update(delta: number) { this.sub?.update?.(delta); }
}

class SurvivalManager {
  private currentWave = 0; private enemiesRemaining = 0; private waveTimer = 0; private waveInProgress = false;
  constructor(private scene: Phaser.Scene) { eventBus.on('entity-died', this.onEnemyDeath); }
  start() { this.nextWave(); }
  update(delta: number) { if (!this.waveInProgress && this.waveTimer > 0) { this.waveTimer -= delta/1000; if (this.waveTimer <= 0) this.nextWave(); } }
  private nextWave() {
    this.currentWave++; this.enemiesRemaining = 5 + Math.floor(this.currentWave/2); this.waveInProgress = true;
    const ai = this.scene.data.get('aiManager') as AIManager;
    for (let i=0; i<this.enemiesRemaining; i++) ai.spawnAI('grunt', Phaser.Math.Between(200,1000), Phaser.Math.Between(200,500), 'normal');
  }
  private onEnemyDeath = () => { this.enemiesRemaining--; if (this.enemiesRemaining <= 0) { this.waveInProgress = false; this.waveTimer = 10; } };
  destroy() { eventBus.off('entity-died', this.onEnemyDeath); }
}

class SkirmishManager {
  private score = 0;
  constructor(private scene: Phaser.Scene) { eventBus.on('entity-died', this.onEnemyDeath); }
  start() { const ai = this.scene.data.get('aiManager') as AIManager; for (let i=0;i<3;i++) ai.spawnAI('grunt', Phaser.Math.Between(200,1000), 400, 'normal'); }
  private onEnemyDeath = () => { this.score += 100; };
  update(delta: number) {}
  destroy() { eventBus.off('entity-died', this.onEnemyDeath); }
}

class TimeTrialManager {
  private startTime = 0; private elapsed = 0;
  start() { this.startTime = this.scene.time.now; }
  update(delta: number) { if (this.startTime) this.elapsed = this.scene.time.now - this.startTime; }
}

class BossRushManager {
  constructor(private scene: Phaser.Scene) {}
  start() { const ai = this.scene.data.get('aiManager') as AIManager; ai.spawnAI('boss', 800, 300, 'hard'); }
  update(delta: number) {}
}
