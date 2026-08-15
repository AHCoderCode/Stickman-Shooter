import Phaser from 'phaser';
import { eventBus } from './core';
import { AIArchetypeConfig, difficultyConfigs } from './config';
import { AIStickman } from './entities';

export enum AIState { Idle='idle', Patrol='patrol', Chase='chase', Attack='attack', TakeCover='cover', Flee='flee', Dead='dead' }

class StateMachine<T extends string> {
  private current: T;
  private states = new Map<T, { enter?: () => void; update?: (dt: number) => void }>();
  constructor(initial: T) { this.current = initial; }
  get state() { return this.current; }
  add(name: T, handlers: any) { this.states.set(name, handlers); }
  change(newState: T) { if (newState === this.current) return; this.states.get(this.current)?.enter?.(); this.current = newState; this.states.get(newState)?.enter?.(); }
  update(dt: number) { this.states.get(this.current)?.update?.(dt); }
}

// Sensors
export class Sensors {
  private lastKnown: Phaser.Math.Vector2 | null = null; private memoryTimer = 0;
  constructor(private scene: Phaser.Scene, private owner: AIStickman, private config: any) {}
  update(dt: number) { if (this.memoryTimer > 0) { this.memoryTimer -= dt/1000; if (this.memoryTimer <= 0) this.lastKnown = null; } }
  canSeePlayer(player: any): boolean {
    if (!player || !player.active) return false;
    const dist = Phaser.Math.Distance.Between(this.owner.x, this.owner.y, player.x, player.y);
    if (dist > this.config.viewDistance) return false;
    const facing = this.owner.flipX ? -1 : 1; if (Math.sign(player.x - this.owner.x) !== facing) return false;
    const hits = this.scene.physics.overlapRect(Math.min(this.owner.x,player.x), Math.min(this.owner.y,player.y), Math.abs(player.x-this.owner.x), Math.abs(player.y-this.owner.y), true, true);
    for (const hit of hits) { if (hit.gameObject === this.owner) continue; const body = hit.gameObject.body as Phaser.Physics.Arcade.Body; if (body && body.gameObject !== this.owner) { const line = new Phaser.Geom.Line(this.owner.x,this.owner.y,player.x,player.y); const inter = Phaser.Geom.Intersects.GetLineToRectangle(line, body); if (inter) { const d = Phaser.Math.Distance.Between(this.owner.x,this.owner.y,inter.x,inter.y); if (d < dist) return false; } } }
    this.lastKnown = new Phaser.Math.Vector2(player.x, player.y); this.memoryTimer = 3; return true;
  }
  getLastKnown() { return this.lastKnown; }
  hearNoise(pos: Phaser.Math.Vector2, radius: number) { if (Phaser.Math.Distance.Between(this.owner.x,this.owner.y,pos.x,pos.y) <= radius) { this.lastKnown = pos; this.memoryTimer = 2; } }
}

// AIController
export class AIController {
  private stateMachine: StateMachine<AIState>;
  private sensors: Sensors;
  private player: any;
  private targetLastSeen: Phaser.Math.Vector2 | null = null;
  private attackCooldown = 0; private reactionTimer = 0;

  constructor(private scene: Phaser.Scene, private owner: AIStickman, private archetype: AIArchetypeConfig, private difficultyKey: string) {
    this.player = scene.data.get('player');
    const diff = difficultyConfigs[difficultyKey] || difficultyConfigs.normal;
    this.sensors = new Sensors(scene, owner, { viewDistance: 800, viewAngleDegrees: 120, hearingRadius: 500, memoryDuration: 3 });
    this.stateMachine = new StateMachine<AIState>(AIState.Idle);
    this.setupStates();
    eventBus.on('noise-event', (payload: any) => this.sensors.hearNoise(payload.position, payload.radius));
    eventBus.on('entity-died', this.handleEntityDeath);
  }
  private setupStates() {
    const sm = this.stateMachine;
    sm.add(AIState.Idle, { update: (dt) => { if (this.player && this.sensors.canSeePlayer(this.player)) sm.change(AIState.Chase); else this.wander(dt); } });
    sm.add(AIState.Patrol, { update: (dt) => { if (this.player && this.sensors.canSeePlayer(this.player)) sm.change(AIState.Chase); } });
    sm.add(AIState.Chase, { update: (dt) => {
      if (!this.player) { sm.change(AIState.Idle); return; }
      if (this.sensors.canSeePlayer(this.player)) { this.targetLastSeen = new Phaser.Math.Vector2(this.player.x, this.player.y); sm.change(AIState.Attack); }
      else { const last = this.sensors.getLastKnown(); if (last) { this.moveToPoint(last); if (Phaser.Math.Distance.Between(this.owner.x,this.owner.y,last.x,last.y) < 30) sm.change(AIState.Idle); } else sm.change(AIState.Idle); }
    }});
    sm.add(AIState.Attack, { enter: () => { this.reactionTimer = difficultyConfigs[this.difficultyKey]?.reactionTime/1000 || 0.5; }, update: (dt) => {
      this.reactionTimer -= dt/1000; if (this.reactionTimer > 0) return;
      if (this.player && this.sensors.canSeePlayer(this.player)) { this.targetLastSeen = new Phaser.Math.Vector2(this.player.x, this.player.y); this.facePlayer(); this.attackCooldown -= dt/1000; if (this.attackCooldown <= 0) { this.owner.fireWeapon(); this.attackCooldown = 1/this.owner.getWeaponConfig().fireRate; } }
      else sm.change(AIState.Chase);
    }});
    sm.add(AIState.Flee, { update: (dt) => { if (this.player) { const away = new Phaser.Math.Vector2(this.owner.x + (this.owner.x > this.player.x ? 200 : -200), this.owner.y); this.moveToPoint(away); if (this.owner.getHealthSystem().currentHealth > this.archetype.behaviorPriorities.retreatHealthThreshold) sm.change(AIState.Chase); } } });
    sm.add(AIState.Dead, { enter: () => this.owner.disableAI() });
  }
  update(delta: number) { if (!this.owner.getHealthSystem().isAlive) { this.stateMachine.change(AIState.Dead); return; } this.sensors.update(delta); this.stateMachine.update(delta); }
  private wander(dt: number) { if (Math.random() < 0.01) { const target = new Phaser.Math.Vector2(this.owner.x + Phaser.Math.Between(-100,100), this.owner.y); this.moveToPoint(target); } }
  private moveToPoint(point: Phaser.Math.Vector2) { const speed = this.archetype.moveSpeed * (difficultyConfigs[this.difficultyKey]?.movementSpeedMultiplier || 1); const angle = Phaser.Math.Angle.Between(this.owner.x,this.owner.y,point.x,point.y); this.owner.setVelocityX(Math.cos(angle)*speed); if (Math.abs(Math.cos(angle)*speed) > 5) this.owner.setFacing(Math.cos(angle)>0); if (this.owner.body?.blocked.left || this.owner.body?.blocked.right) this.owner.jump(); }
  private facePlayer() { if (this.player) { const dx = this.player.x - this.owner.x; this.owner.setFacing(dx > 0); } }
  private handleEntityDeath = (payload: any) => { if (payload.target === this.owner.getHealthSystem()) this.stateMachine.change(AIState.Dead); };
  destroy() { eventBus.off('noise-event', this.handleNoise); eventBus.off('entity-died', this.handleEntityDeath); }
  private handleNoise = (payload: any) => this.sensors.hearNoise(payload.position, payload.radius);
}

// AIManager
export class AIManager {
  private aiEntities: AIStickman[] = [];
  constructor(private scene: Phaser.Scene) { eventBus.on('player-position', this.handlePlayerPos); }
  spawnAI(archetypeId: string, x: number, y: number, difficultyKey: string): AIStickman {
    const archetype = (window as any).aiArchetypes?.find((a: any) => a.id === archetypeId) || { id:'grunt', name:'Grunt', weaponId:'m1911', maxHealth:100, moveSpeed:250, behaviorPriorities:{attackRange:600,preferCover:true,flankChance:0.2,retreatHealthThreshold:30,grenadeUse:false,meleeAggressive:false} };
    const ai = new AIStickman(this.scene, x, y, 'stickman_ai', archetype, difficultyKey);
    this.aiEntities.push(ai);
    const group = this.scene.data.get('aiGroup') as Phaser.Physics.Arcade.Group;
    if (group) group.add(ai);
    return ai;
  }
  update(delta: number) { this.aiEntities.forEach(ai => ai.update(0, delta)); }
  private handlePlayerPos = (payload: { x: number; y: number }) => { /* share info */ };
  destroy() { eventBus.off('player-position', this.handlePlayerPos); this.aiEntities.forEach(ai => ai.destroy()); this.aiEntities = []; }
}
