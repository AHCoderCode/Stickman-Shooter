import Phaser from 'phaser';
import { BootScene, PreloadScene, MainMenuScene, LevelSelectScene, GameScene, SettingsScene, ShopScene, AchievementsScene, PauseScene, GameOverScene } from './scenes';

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: '#1a1a2e',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 1280, height: 720 },
  physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 1200 }, debug: false } },
  scene: [BootScene, PreloadScene, MainMenuScene, LevelSelectScene, GameScene, SettingsScene, ShopScene, AchievementsScene, PauseScene, GameOverScene]
};

export interface PlayerMovementConfig {
  maxSpeed: number; acceleration: number; deceleration: number; airControl: number;
  jumpForce: number; jumpCutMultiplier: number; coyoteTime: number; jumpBufferTime: number;
  doubleJumpForce: number; doubleJumpUnlocked: boolean;
  wallSlideSpeed: number; wallJumpForceX: number; wallJumpForceY: number; wallJumpLockTime: number;
  dashSpeed: number; dashDuration: number; dashCooldown: number; dashInvincibilityDuration: number;
  ledgeGrabDistance: number; ledgeClimbDuration: number;
  slideSpeed: number; slideDuration: number; maxHealth: number;
}

export const defaultPlayerMovementConfig: PlayerMovementConfig = {
  maxSpeed: 300, acceleration: 2000, deceleration: 1800, airControl: 0.6,
  jumpForce: -520, jumpCutMultiplier: 0.5, coyoteTime: 0.1, jumpBufferTime: 0.1,
  doubleJumpForce: -450, doubleJumpUnlocked: true,
  wallSlideSpeed: 80, wallJumpForceX: 350, wallJumpForceY: -450, wallJumpLockTime: 0.2,
  dashSpeed: 600, dashDuration: 0.15, dashCooldown: 1.0, dashInvincibilityDuration: 0.2,
  ledgeGrabDistance: 40, ledgeClimbDuration: 0.4,
  slideSpeed: 400, slideDuration: 0.5, maxHealth: 100
};

export enum WeaponCategory { Pistol='pistol', SMG='smg', Rifle='rifle', Shotgun='shotgun', Sniper='sniper', Launcher='launcher', Energy='energy', Melee='melee', Throwable='throwable' }
export enum FireMode { SemiAuto='semi', FullAuto='full', Burst='burst', PumpAction='pump' }
export interface WeaponConfig {
  id: string; name: string; category: WeaponCategory; damage: number; fireRate: number; magazineSize: number;
  reloadTime: number; range: number; spread: number; recoil: number; bulletSpeed: number; bulletCount: number;
  projectileKey: string; fireMode: FireMode; automatic: boolean; reloadable: boolean;
  unlockRequirements: { level?: number; coins?: number; gems?: number }; upgradeLevels: any[];
}

export const weaponConfigs: WeaponConfig[] = [
  { id:'m1911', name:'M1911', category:WeaponCategory.Pistol, damage:25, fireRate:3, magazineSize:8, reloadTime:1.2, range:800, spread:3, recoil:5, bulletSpeed:0, bulletCount:1, projectileKey:'', fireMode:FireMode.SemiAuto, automatic:false, reloadable:true, unlockRequirements:{level:1}, upgradeLevels:[] },
  { id:'glock17', name:'Glock 17', category:WeaponCategory.Pistol, damage:20, fireRate:4, magazineSize:17, reloadTime:1.0, range:700, spread:4, recoil:4, bulletSpeed:0, bulletCount:1, projectileKey:'', fireMode:FireMode.SemiAuto, automatic:false, reloadable:true, unlockRequirements:{level:2}, upgradeLevels:[] },
  { id:'mp5', name:'MP5', category:WeaponCategory.SMG, damage:15, fireRate:12, magazineSize:30, reloadTime:1.5, range:600, spread:8, recoil:3, bulletSpeed:0, bulletCount:1, projectileKey:'', fireMode:FireMode.FullAuto, automatic:true, reloadable:true, unlockRequirements:{level:3,coins:500}, upgradeLevels:[] },
  { id:'ak47', name:'AK-47', category:WeaponCategory.Rifle, damage:30, fireRate:8, magazineSize:30, reloadTime:2.0, range:1000, spread:6, recoil:7, bulletSpeed:0, bulletCount:1, projectileKey:'', fireMode:FireMode.FullAuto, automatic:true, reloadable:true, unlockRequirements:{level:4}, upgradeLevels:[] },
  { id:'pump_shotgun', name:'Pump Shotgun', category:WeaponCategory.Shotgun, damage:12, fireRate:1.2, magazineSize:6, reloadTime:2.5, range:400, spread:30, recoil:10, bulletSpeed:0, bulletCount:8, projectileKey:'', fireMode:FireMode.PumpAction, automatic:false, reloadable:true, unlockRequirements:{level:5}, upgradeLevels:[] },
  { id:'awp', name:'AWP', category:WeaponCategory.Sniper, damage:90, fireRate:0.8, magazineSize:5, reloadTime:3.0, range:2000, spread:1, recoil:15, bulletSpeed:0, bulletCount:1, projectileKey:'', fireMode:FireMode.SemiAuto, automatic:false, reloadable:true, unlockRequirements:{level:6}, upgradeLevels:[] },
  { id:'rpg7', name:'RPG-7', category:WeaponCategory.Launcher, damage:80, fireRate:0.5, magazineSize:1, reloadTime:4.0, range:1500, spread:5, recoil:20, bulletSpeed:500, bulletCount:1, projectileKey:'rpg_rocket', fireMode:FireMode.SemiAuto, automatic:false, reloadable:true, unlockRequirements:{level:7}, upgradeLevels:[] },
  { id:'laser_rifle', name:'Laser Rifle', category:WeaponCategory.Energy, damage:20, fireRate:10, magazineSize:50, reloadTime:1.8, range:1200, spread:2, recoil:2, bulletSpeed:0, bulletCount:1, projectileKey:'', fireMode:FireMode.FullAuto, automatic:true, reloadable:true, unlockRequirements:{level:8}, upgradeLevels:[] },
  { id:'knife', name:'Knife', category:WeaponCategory.Melee, damage:35, fireRate:2, magazineSize:0, reloadTime:0, range:60, spread:0, recoil:0, bulletSpeed:0, bulletCount:1, projectileKey:'', fireMode:FireMode.SemiAuto, automatic:false, reloadable:false, unlockRequirements:{level:1}, upgradeLevels:[] },
  { id:'frag_grenade', name:'Frag Grenade', category:WeaponCategory.Throwable, damage:60, fireRate:0.7, magazineSize:1, reloadTime:1.0, range:400, spread:0, recoil:0, bulletSpeed:300, bulletCount:1, projectileKey:'grenade', fireMode:FireMode.SemiAuto, automatic:false, reloadable:false, unlockRequirements:{level:2}, upgradeLevels:[] },
  { id:'deagle', name:'Desert Eagle', category:WeaponCategory.Pistol, damage:45, fireRate:2, magazineSize:7, reloadTime:1.5, range:900, spread:2, recoil:10, bulletSpeed:0, bulletCount:1, projectileKey:'', fireMode:FireMode.SemiAuto, automatic:false, reloadable:true, unlockRequirements:{coins:1000}, upgradeLevels:[] },
  { id:'uzi', name:'Uzi', category:WeaponCategory.SMG, damage:12, fireRate:15, magazineSize:25, reloadTime:1.8, range:500, spread:10, recoil:2, bulletSpeed:0, bulletCount:1, projectileKey:'', fireMode:FireMode.FullAuto, automatic:true, reloadable:true, unlockRequirements:{coins:800}, upgradeLevels:[] },
  { id:'double_barrel', name:'Double Barrel', category:WeaponCategory.Shotgun, damage:10, fireRate:1.5, magazineSize:2, reloadTime:2.0, range:300, spread:40, recoil:15, bulletSpeed:0, bulletCount:12, projectileKey:'', fireMode:FireMode.PumpAction, automatic:false, reloadable:true, unlockRequirements:{coins:1500}, upgradeLevels:[] },
  { id:'katana', name:'Katana', category:WeaponCategory.Melee, damage:50, fireRate:2.5, magazineSize:0, reloadTime:0, range:80, spread:0, recoil:0, bulletSpeed:0, bulletCount:1, projectileKey:'', fireMode:FireMode.SemiAuto, automatic:false, reloadable:false, unlockRequirements:{coins:2000}, upgradeLevels:[] },
  { id:'molotov', name:'Molotov', category:WeaponCategory.Throwable, damage:40, fireRate:0.5, magazineSize:1, reloadTime:1.0, range:400, spread:0, recoil:0, bulletSpeed:250, bulletCount:1, projectileKey:'molotov', fireMode:FireMode.SemiAuto, automatic:false, reloadable:false, unlockRequirements:{coins:1200}, upgradeLevels:[] }
];

export interface AIDifficultyConfig { aimAccuracy:number; reactionTime:number; aggression:number; tacticalAwareness:number; movementSpeedMultiplier:number; healthMultiplier:number; damageMultiplier:number; grenadeUsageFrequency:number; teamCoordinationLevel:number; learningRate:number; }
export const difficultyConfigs: Record<string, AIDifficultyConfig> = {
  easy: { aimAccuracy:20, reactionTime:800, aggression:0.2, tacticalAwareness:0.1, movementSpeedMultiplier:0.8, healthMultiplier:0.8, damageMultiplier:0.7, grenadeUsageFrequency:0.05, teamCoordinationLevel:0.1, learningRate:0 },
  normal: { aimAccuracy:40, reactionTime:500, aggression:0.4, tacticalAwareness:0.3, movementSpeedMultiplier:1.0, healthMultiplier:1.0, damageMultiplier:1.0, grenadeUsageFrequency:0.15, teamCoordinationLevel:0.3, learningRate:0 },
  hard: { aimAccuracy:60, reactionTime:350, aggression:0.6, tacticalAwareness:0.5, movementSpeedMultiplier:1.0, healthMultiplier:1.0, damageMultiplier:1.0, grenadeUsageFrequency:0.3, teamCoordinationLevel:0.5, learningRate:0 },
  expert: { aimAccuracy:80, reactionTime:250, aggression:0.8, tacticalAwareness:0.7, movementSpeedMultiplier:1.1, healthMultiplier:1.1, damageMultiplier:1.1, grenadeUsageFrequency:0.5, teamCoordinationLevel:0.7, learningRate:0 },
  insane: { aimAccuracy:95, reactionTime:150, aggression:1.0, tacticalAwareness:0.9, movementSpeedMultiplier:1.2, healthMultiplier:1.2, damageMultiplier:1.2, grenadeUsageFrequency:0.7, teamCoordinationLevel:0.9, learningRate:0 },
  adaptive: { aimAccuracy:50, reactionTime:400, aggression:0.5, tacticalAwareness:0.5, movementSpeedMultiplier:1.0, healthMultiplier:1.0, damageMultiplier:1.0, grenadeUsageFrequency:0.3, teamCoordinationLevel:0.5, learningRate:0.01 }
};

export interface AIArchetypeConfig { id:string; name:string; weaponId:string; maxHealth:number; moveSpeed:number; behaviorPriorities:{ attackRange:number; preferCover:boolean; flankChance:number; retreatHealthThreshold:number; grenadeUse:boolean; meleeAggressive:boolean; }; }
export const aiArchetypes: AIArchetypeConfig[] = [
  { id:'grunt', name:'Grunt', weaponId:'m1911', maxHealth:100, moveSpeed:250, behaviorPriorities:{attackRange:600,preferCover:true,flankChance:0.2,retreatHealthThreshold:30,grenadeUse:false,meleeAggressive:false} },
  { id:'rusher', name:'Rusher', weaponId:'knife', maxHealth:80, moveSpeed:350, behaviorPriorities:{attackRange:100,preferCover:false,flankChance:0.6,retreatHealthThreshold:20,grenadeUse:false,meleeAggressive:true} },
  { id:'sniper', name:'Sniper', weaponId:'awp', maxHealth:60, moveSpeed:200, behaviorPriorities:{attackRange:1500,preferCover:true,flankChance:0.1,retreatHealthThreshold:20,grenadeUse:false,meleeAggressive:false} },
  { id:'tank', name:'Tank', weaponId:'ak47', maxHealth:250, moveSpeed:150, behaviorPriorities:{attackRange:800,preferCover:false,flankChance:0.05,retreatHealthThreshold:50,grenadeUse:false,meleeAggressive:false} },
  { id:'grenadier', name:'Grenadier', weaponId:'frag_grenade', maxHealth:100, moveSpeed:200, behaviorPriorities:{attackRange:500,preferCover:true,flankChance:0.3,retreatHealthThreshold:30,grenadeUse:true,meleeAggressive:false} },
  { id:'boss', name:'Boss', weaponId:'rpg7', maxHealth:500, moveSpeed:150, behaviorPriorities:{attackRange:1200,preferCover:false,flankChance:0.0,retreatHealthThreshold:0,grenadeUse:false,meleeAggressive:false} }
];
