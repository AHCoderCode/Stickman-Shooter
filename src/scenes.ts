import Phaser from 'phaser';
import { eventBus, serviceLocator, SaveSystem, AudioManager, ProgressionManager, AchievementManager, ParticleManager } from './core';
import { PlayerController, AIStickman, WeaponPickup, Destructible, Hazard } from './entities';
import { AIManager } from './ai';
import { LevelLoader } from './levels';
import { GameModeManager, GameMode } from './gamemodes';
import { ButtonFactory } from './ui';
import { weaponConfigs } from './config';

export class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }
  create() {
    new SaveSystem(); new AudioManager(); new ProgressionManager(); new AchievementManager();
    this.scene.start('PreloadScene');
  }
}

export class PreloadScene extends Phaser.Scene {
  constructor() { super('PreloadScene'); }
  preload() { this.load.json('level_001', 'assets/data/levels/level_001.json'); /* load more if needed */ }
  create() {
    // Generate placeholder textures
    this.generateTextures();
    this.scene.start('MainMenuScene');
  }
  private generateTextures() {
    if (!this.textures.exists('stickman')) { const g = this.add.graphics(); g.fillStyle(0xffffff); g.fillRoundedRect(0,0,32,48,4); g.generateTexture('stickman',32,48); g.destroy(); }
    if (!this.textures.exists('stickman_ai')) { const g = this.add.graphics(); g.fillStyle(0xff6666); g.fillRoundedRect(0,0,32,48,4); g.generateTexture('stickman_ai',32,48); g.destroy(); }
    if (!this.textures.exists('ground')) { const g = this.add.graphics(); g.fillStyle(0x444444); g.fillRect(0,0,64,64); g.generateTexture('ground',64,64); g.destroy(); }
    if (!this.textures.exists('wall')) { const g = this.add.graphics(); g.fillStyle(0x888888); g.fillRect(0,0,40,300); g.generateTexture('wall',40,300); g.destroy(); }
    if (!this.textures.exists('dummy')) { const g = this.add.graphics(); g.fillStyle(0xff4444); g.fillRoundedRect(0,0,30,60,4); g.generateTexture('dummy',30,60); g.destroy(); }
    if (!this.textures.exists('bullet')) { const g = this.add.graphics(); g.fillStyle(0xffff00); g.fillCircle(2,2,2); g.generateTexture('bullet',4,4); g.destroy(); }
    if (!this.textures.exists('particle')) { const g = this.add.graphics(); g.fillStyle(0xffffff); g.fillCircle(2,2,2); g.generateTexture('particle',4,4); g.destroy(); }
    if (!this.textures.exists('weapon_pickup')) { const g = this.add.graphics(); g.fillStyle(0x00ff00); g.fillRoundedRect(0,0,20,20,4); g.generateTexture('weapon_pickup',20,20); g.destroy(); }
    if (!this.textures.exists('destructible_crate')) { const g = this.add.graphics(); g.fillStyle(0xaa6633); g.fillRect(0,0,40,40); g.generateTexture('destructible_crate',40,40); g.destroy(); }
    if (!this.textures.exists('hazard_spikes')) { const g = this.add.graphics(); g.fillStyle(0xff0000); g.fillTriangle(0,0,10,0,5,20); g.generateTexture('hazard_spikes',10,20); g.destroy(); }
  }
}

export class MainMenuScene extends Phaser.Scene {
  constructor() { super('MainMenuScene'); }
  create() {
    const { width, height } = this.scale;
    this.add.text(width/2, 100, 'STICKMAN SHOOTER', { fontSize: '48px', color: '#fff' }).setOrigin(0.5);
    ButtonFactory.create(this, width/2, 250, 'Campaign', () => this.scene.start('LevelSelectScene'));
    ButtonFactory.create(this, width/2, 330, 'Survival', () => this.scene.start('GameScene', { modeConfig: { mode: GameMode.Survival } }));
    ButtonFactory.create(this, width/2, 410, 'Skirmish', () => this.scene.start('GameScene', { modeConfig: { mode: GameMode.Skirmish } }));
    ButtonFactory.create(this, width/2, 490, 'Shop', () => this.scene.start('ShopScene'));
    ButtonFactory.create(this, width/2, 570, 'Settings', () => this.scene.start('SettingsScene'));
    ButtonFactory.create(this, width/2, 650, 'Achievements', () => this.scene.start('AchievementsScene'));
  }
}

export class LevelSelectScene extends Phaser.Scene {
  constructor() { super('LevelSelectScene'); }
  create() {
    this.add.text(640, 100, 'Select Level', { fontSize: '36px', color: '#fff' }).setOrigin(0.5);
    for (let i=1; i<=5; i++) {
      ButtonFactory.create(this, 200 + (i%5)*200, 300 + Math.floor(i/5)*100, `Level ${i}`, () => {
        this.scene.start('GameScene', { modeConfig: { mode: GameMode.Campaign, levelKey: `level_00${i}` } });
      });
    }
    ButtonFactory.create(this, 640, 650, 'Back', () => this.scene.start('MainMenuScene'));
  }
}

export class GameScene extends Phaser.Scene {
  private player!: PlayerController;
  private aiManager!: AIManager;
  private modeManager!: GameModeManager;
  private debugOverlay?: Phaser.GameObjects.Text;

  constructor() { super('GameScene'); }
  init(data: any) { this.data.set('modeConfig', data.modeConfig); }
  create() {
    const config = this.data.get('modeConfig') || { mode: GameMode.Campaign, levelKey: 'level_001' };
    const levelData = LevelLoader.loadLevel(this, config.levelKey || 'level_001');

    this.aiManager = new AIManager(this);
    this.data.set('aiManager', this.aiManager);
    this.data.set('aiGroup', this.physics.add.group());

    this.player = new PlayerController(this, 100, 500, 'stickman');
    this.data.set('player', this.player);

    const staticGroup = this.data.get('staticGroup') as Phaser.Physics.Arcade.StaticGroup;
    this.physics.add.collider(this.player, staticGroup);
    this.physics.add.collider(this.aiManager as any, staticGroup);

    // Spawn level entities
    levelData.enemySpawns.forEach((spawn: any) => this.aiManager.spawnAI(spawn.type, spawn.x, spawn.y, spawn.difficulty || 'normal'));
    levelData.weaponPickups.forEach((p: any) => { const pickup = new WeaponPickup(this, p.x, p.y, p.type); this.physics.add.overlap(this.player, pickup, (a, b) => { this.player.getWeaponManager().addWeapon((b as WeaponPickup).getWeaponId()); b.destroy(); }); });
    levelData.healthPickups.forEach((p: any) => { /* add health pickup later */ });
    levelData.destructibles.forEach((d: any) => { const dest = new Destructible(this, d.x, d.y, d.type); this.physics.add.collider(this.player, dest); });
    levelData.hazards.forEach((h: any) => { const hazard = new Hazard(this, h.x, h.y, h.width, h.height, h.type); this.physics.add.overlap(this.player, hazard); });

    // Setup colliders for AI group
    const aiGroup = this.data.get('aiGroup') as Phaser.Physics.Arcade.Group;
    this.physics.add.collider(this.player, aiGroup);
    this.physics.add.collider(aiGroup, staticGroup);
    this.physics.add.collider(aiGroup, aiGroup);

    this.modeManager = new GameModeManager(this, config);

    // HUD
    const hud = this.add.text(10, 10, 'HP: 100', { fontSize: '16px', color: '#fff' }).setScrollFactor(0).setDepth(100);
    eventBus.on('health-changed', (payload: any) => { if (payload.source === this.player) hud.setText(`HP: ${payload.current.toFixed(0)}`); });
    const ammoText = this.add.text(10, 35, 'Ammo: 8/24', { fontSize: '16px', color: '#fff' }).setScrollFactor(0).setDepth(100);
    eventBus.on('weapon-fired', (payload: any) => { ammoText.setText(`Ammo: ${payload.ammo}/24`); });
    eventBus.on('weapon-switched', () => { const d = this.player.getWeaponManager().getWeaponData(); if (d) ammoText.setText(`Ammo: ${d.ammo}/${d.reserve}`); });

    // Camera follow
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    // Pause on ESC
    this.input.keyboard!.on('keydown-ESC', () => { this.scene.pause(); this.scene.launch('PauseScene'); });

    // Game over on player death
    eventBus.on('entity-died', this.handleDeath);
  }

  update(time: number, delta: number) {
    this.player.update(time, delta);
    this.aiManager.update(delta);
    this.modeManager.update(delta);
  }

  private handleDeath = (payload: any) => {
    if (payload.target === this.player.getHealthSystem()) {
      this.scene.pause();
      this.scene.launch('GameOverScene', { victory: false, score: 0, xp: 0, coins: 0 });
      eventBus.off('entity-died', this.handleDeath);
    }
  };
}

export class SettingsScene extends Phaser.Scene {
  constructor() { super('SettingsScene'); }
  create() {
    this.add.text(640, 100, 'Settings', { fontSize: '36px', color: '#fff' }).setOrigin(0.5);
    ButtonFactory.create(this, 640, 300, 'Toggle Blood', () => { /* placeholder */ });
    ButtonFactory.create(this, 640, 400, 'Back', () => this.scene.start('MainMenuScene'));
  }
}

export class ShopScene extends Phaser.Scene {
  constructor() { super('ShopScene'); }
  create() {
    const prog = serviceLocator.get<ProgressionManager>('ProgressionManager');
    this.add.text(640, 100, 'Shop', { fontSize: '36px', color: '#fff' }).setOrigin(0.5);
    this.add.text(640, 150, `Coins: ${prog.data.coins}`, { fontSize: '20px', color: '#ff0' }).setOrigin(0.5);
    weaponConfigs.filter(w => w.unlockRequirements.coins).forEach((w, i) => {
      ButtonFactory.create(this, 300 + (i%3)*300, 300 + Math.floor(i/3)*100, `${w.name} (${w.unlockRequirements.coins})`, () => {
        if (prog.data.coins >= w.unlockRequirements.coins!) { prog.addCoins(-w.unlockRequirements.coins!); prog.unlockWeapon(w.id); this.scene.restart(); }
      });
    });
    ButtonFactory.create(this, 640, 650, 'Back', () => this.scene.start('MainMenuScene'));
  }
}

export class AchievementsScene extends Phaser.Scene {
  constructor() { super('AchievementsScene'); }
  create() {
    this.add.text(640, 100, 'Achievements', { fontSize: '36px', color: '#fff' }).setOrigin(0.5);
    this.add.text(640, 200, 'None yet. Play to unlock!', { fontSize: '24px', color: '#0f0' }).setOrigin(0.5);
    ButtonFactory.create(this, 640, 400, 'Back', () => this.scene.start('MainMenuScene'));
  }
}

export class PauseScene extends Phaser.Scene {
  constructor() { super('PauseScene'); }
  create() {
    this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.7);
    this.add.text(640, 200, 'PAUSED', { fontSize: '48px', color: '#fff' }).setOrigin(0.5);
    ButtonFactory.create(this, 640, 300, 'Resume', () => { this.scene.stop(); this.scene.resume('GameScene'); });
    ButtonFactory.create(this, 640, 400, 'Quit', () => { this.scene.stop(); this.scene.start('MainMenuScene'); });
  }
}

export class GameOverScene extends Phaser.Scene {
  constructor() { super('GameOverScene'); }
  init(data: any) { this.data.set('results', data); }
  create() {
    const res = this.data.get('results') as any;
    this.add.text(640, 200, res.victory ? 'VICTORY' : 'DEFEAT', { fontSize: '64px', color: res.victory ? '#0f0' : '#f00' }).setOrigin(0.5);
    ButtonFactory.create(this, 640, 400, 'Continue', () => this.scene.start('MainMenuScene'));
  }
}
