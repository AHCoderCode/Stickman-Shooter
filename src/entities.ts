import Phaser from 'phaser';
import { eventBus, HealthSystem, DamageType, serviceLocator, ParticleManager, AudioManager, ObjectPool } from './core';
import { defaultPlayerMovementConfig, PlayerMovementConfig, weaponConfigs } from './config';
import { WeaponManager } from './weapons';
import { AIController } from './ai';

// ---------- PlayerController ----------
export enum PlayerState { Idle='idle', Run='run', Jump='jump', DoubleJump='double', WallSlide='wallslide', WallJump='walljump', Dash='dash', LedgeGrab='ledgegrab', LedgeClimb='ledgeclimb', Crouch='crouch', Slide='slide', Dead='dead' }

export class PlayerController extends Phaser.Physics.Arcade.Sprite {
  private config: PlayerMovementConfig;
  private health: HealthSystem;
  private weaponManager: WeaponManager;
  private keys: any;
  private facingRight = true;
  private currentState: PlayerState = PlayerState.Idle;
  private coyoteTimer = 0; private jumpBufferTimer = 0; private wallJumpLockTimer = 0;
  private dashTimer = 0; private dashCooldownTimer = 0; private slideTimer = 0; private ledgeClimbTimer = 0;
  private hasDoubleJumped = false; private isDashing = false; private isSliding = false; private isLedgeGrabbing = false; private isClimbingLedge = false;
  private isTouchingWall = false; private ledgeGrabPoint = new Phaser.Math.Vector2();
  private particleManager: ParticleManager;
  private audioManager: AudioManager;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string, config: PlayerMovementConfig = defaultPlayerMovementConfig) {
    super(scene, x, y, texture);
    this.config = config;
    this.health = new HealthSystem(config.maxHealth);
    this.weaponManager = new WeaponManager(scene, this);
    this.particleManager = new ParticleManager(scene);
    this.audioManager = serviceLocator.get('AudioManager');

    scene.add.existing(this);
    scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(24, 40); body.setOffset(4, 8); body.setMaxVelocityX(config.maxSpeed); body.setMaxVelocityY(1200);

    this.keys = scene.input.keyboard!.addKeys({
      left: Phaser.Input.Keyboard.KeyCodes.LEFT, right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      down: Phaser.Input.Keyboard.KeyCodes.DOWN, jump: Phaser.Input.Keyboard.KeyCodes.SPACE,
      dash: Phaser.Input.Keyboard.KeyCodes.SHIFT
    }) as any;

    scene.input.keyboard!.on('keydown-R', () => this.weaponManager.reloadCurrent());
    scene.input.keyboard!.on('keydown-ONE', () => this.weaponManager.switchToSlot(0));
    scene.input.keyboard!.on('keydown-TWO', () => this.weaponManager.switchToSlot(1));
    scene.input.keyboard!.on('keydown-THREE', () => this.weaponManager.switchToSlot(2));
    scene.input.on('wheel', (pointer: any, gameObjects: any, deltaX: number, deltaY: number) => this.weaponManager.cycleWeapon(deltaY > 0 ? 1 : -1));
    scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => { if (!this.isPointerOverUI(pointer)) this.weaponManager.startFiring(); });
    scene.input.on('pointerup', () => this.weaponManager.stopFiring());

    eventBus.on('entity-died', this.handleDeath);
  }

  private isPointerOverUI(pointer: Phaser.Input.Pointer): boolean {
    const targets = this.scene.input.hitTestPointer(pointer);
    for (const t of targets) if (t.gameObject && (t.gameObject.type === 'Container' || t.gameObject.input?.draggable === false)) return true;
    return false;
  }

  update(time: number, delta: number) {
    const dt = delta / 1000;
    this.updateTimers(dt);
    if (Phaser.Input.Keyboard.JustDown(this.keys.jump)) this.jumpBufferTimer = this.config.jumpBufferTime;
    if (Phaser.Input.Keyboard.JustDown(this.keys.dash)) this.tryStartDash();

    const grounded = this.isGrounded();
    if (grounded) { this.coyoteTimer = this.config.coyoteTime; this.hasDoubleJumped = false; }
    this.updateWallDetection();
    this.updateLedgeGrab(grounded);

    this.updateState(grounded);
    this.updateFacing();
    this.applyMovement(dt, grounded);
    this.applyJump(grounded);
    this.applyDash();
    this.applyWallSlide(grounded);
    this.applySlide(grounded);
    this.applyLedgeClimb(dt);
    this.weaponManager.update(delta);
    eventBus.emit('player-position', { x: this.x, y: this.y });
  }

  getHealthSystem() { return this.health; }
  getWeaponManager() { return this.weaponManager; }
  getBarrelPosition() { return new Phaser.Math.Vector2(this.x + (this.facingRight ? 20 : -20), this.y - 5); }
  takeDamage(amount: number) { this.health.takeDamage({ amount, source: this, damageType: DamageType.Bullet }); }

  private updateTimers(dt: number) {
    this.coyoteTimer = Math.max(0, this.coyoteTimer - dt); this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
    this.wallJumpLockTimer = Math.max(0, this.wallJumpLockTimer - dt); this.dashCooldownTimer = Math.max(0, this.dashCooldownTimer - dt);
    if (this.isDashing) { this.dashTimer -= dt; if (this.dashTimer <= 0) this.isDashing = false; }
    if (this.isSliding) { this.slideTimer -= dt; if (this.slideTimer <= 0 || !this.keys.down.isDown) { this.isSliding = false; this.setCrouchCollider(false); } }
    if (this.isClimbingLedge) { this.ledgeClimbTimer -= dt; if (this.ledgeClimbTimer <= 0) { this.isClimbingLedge = false; this.isLedgeGrabbing = false; } }
  }

  private updateWallDetection() { const body = this.body as Phaser.Physics.Arcade.Body; this.isTouchingWall = body.blocked.left || body.blocked.right; }
  private isGrounded() { return (this.body as Phaser.Physics.Arcade.Body).blocked.down; }
  private updateState(grounded: boolean) {
    const moveInput = this.getMoveInput();
    if (!this.isDashing && !this.isClimbingLedge && !this.isLedgeGrabbing) {
      if (this.isSliding) this.currentState = PlayerState.Slide;
      else if (this.isTouchingWall && !grounded && Math.abs(moveInput) > 0.1) this.currentState = PlayerState.WallSlide;
      else if (this.wallJumpLockTimer > 0) this.currentState = PlayerState.WallJump;
      else if (grounded && Math.abs(moveInput) > 0.1) this.currentState = PlayerState.Run;
      else if (grounded && this.keys.down.isDown && Math.abs(moveInput) <= 0.1) { this.currentState = PlayerState.Crouch; this.setCrouchCollider(true); }
      else if (grounded) this.currentState = PlayerState.Idle;
      else this.currentState = this.hasDoubleJumped ? PlayerState.DoubleJump : PlayerState.Jump;
    } else {
      if (this.isDashing) this.currentState = PlayerState.Dash;
      else if (this.isClimbingLedge) this.currentState = PlayerState.LedgeClimb;
      else if (this.isLedgeGrabbing) this.currentState = PlayerState.LedgeGrab;
    }
  }
  private updateFacing() { if (this.isDashing || this.currentState === PlayerState.WallSlide) return; const mi = this.getMoveInput(); if (mi > 0.1 && !this.facingRight) this.setFacing(true); else if (mi < -0.1 && this.facingRight) this.setFacing(false); }
  private setFacing(right: boolean) { this.facingRight = right; this.setFlipX(!right); }
  private getMoveInput() { return (this.keys.left.isDown ? -1 : 0) + (this.keys.right.isDown ? 1 : 0); }

  private applyMovement(dt: number, grounded: boolean) {
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (this.isDashing || this.isClimbingLedge || this.isLedgeGrabbing) return;
    if (this.currentState === PlayerState.WallSlide) { body.velocity.y = Math.min(body.velocity.y, this.config.wallSlideSpeed); return; }
    if (this.currentState === PlayerState.Slide) { body.velocity.x = this.facingRight ? this.config.slideSpeed : -this.config.slideSpeed; return; }
    const mi = this.getMoveInput(); const target = mi * this.config.maxSpeed;
    const accel = grounded ? this.config.acceleration : this.config.acceleration * this.config.airControl;
    const decel = grounded ? this.config.deceleration : this.config.deceleration * this.config.airControl;
    const rate = target !== 0 ? accel : decel;
    body.velocity.x = Phaser.Math.Linear(body.velocity.x, target, rate * dt);
  }

  private applyJump(grounded: boolean) {
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0 && !this.isDashing) { this.executeJump(this.config.jumpForce); this.jumpBufferTimer = 0; this.coyoteTimer = 0; this.hasDoubleJumped = false; return; }
    if (this.jumpBufferTimer > 0 && this.isTouchingWall && !grounded && this.wallJumpLockTimer <= 0) { const dir = this.facingRight ? -1 : 1; body.velocity.x = dir * this.config.wallJumpForceX; body.velocity.y = this.config.wallJumpForceY; this.wallJumpLockTimer = this.config.wallJumpLockTime; this.jumpBufferTimer = 0; this.setFacing(!this.facingRight); return; }
    if (this.jumpBufferTimer > 0 && !grounded && !this.hasDoubleJumped && this.config.doubleJumpUnlocked && this.wallJumpLockTimer <= 0) { this.executeJump(this.config.doubleJumpForce); this.hasDoubleJumped = true; this.jumpBufferTimer = 0; return; }
    if (!this.keys.jump.isDown && body.velocity.y < 0) body.velocity.y *= this.config.jumpCutMultiplier;
  }
  private executeJump(force: number) { (this.body as Phaser.Physics.Arcade.Body).velocity.y = force; }
  private tryStartDash() { if (this.dashCooldownTimer > 0 || this.isDashing) return; this.isDashing = true; this.dashTimer = this.config.dashDuration; this.dashCooldownTimer = this.config.dashCooldown; }
  private applyDash() { if (!this.isDashing) return; const body = this.body as Phaser.Physics.Arcade.Body; body.velocity.x = this.facingRight ? this.config.dashSpeed : -this.config.dashSpeed; body.velocity.y = 0; }
  private applyWallSlide(grounded: boolean) { /* handled in applyMovement */ }
  private applySlide(grounded: boolean) { /* handled in applyMovement */ }
  private setCrouchCollider(crouching: boolean) { const body = this.body as Phaser.Physics.Arcade.Body; if (crouching) { body.setSize(24,24); body.setOffset(4,24); } else { body.setSize(24,40); body.setOffset(4,8); } }
  private updateLedgeGrab(grounded: boolean) {
    if (grounded || this.isLedgeGrabbing || this.isClimbingLedge || this.isDashing) return;
    const dir = this.facingRight ? 1 : -1;
    const originX = this.x + dir * 10, originY = this.y - 20;
    const wallHit = this.scene.physics.raycast(originX, originY, originX + dir * 30, originY, 5);
    if (!wallHit) return;
    const ledgeHit = this.scene.physics.raycast(wallHit.point.x, wallHit.point.y - 5, wallHit.point.x, wallHit.point.y - 40, 5);
    if (ledgeHit) return;
    this.isLedgeGrabbing = true; this.ledgeGrabPoint.set(wallHit.point.x, wallHit.point.y); (this.body as Phaser.Physics.Arcade.Body).velocity.set(0,0); (this.body as Phaser.Physics.Arcade.Body).allowGravity = false; this.currentState = PlayerState.LedgeGrab;
    if (Phaser.Input.Keyboard.JustDown(this.keys.jump)) { this.isClimbingLedge = true; this.ledgeClimbTimer = this.config.ledgeClimbDuration; this.isLedgeGrabbing = false; (this.body as Phaser.Physics.Arcade.Body).allowGravity = true; this.currentState = PlayerState.LedgeClimb; }
  }
  private applyLedgeClimb(dt: number) {
    if (!this.isClimbingLedge) return;
    const target = new Phaser.Math.Vector2(this.ledgeGrabPoint.x, this.ledgeGrabPoint.y - 32);
    this.setPosition(Phaser.Math.Linear(this.x, target.x, dt*10), Phaser.Math.Linear(this.y, target.y, dt*10));
    if (Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y) < 5) { this.isClimbingLedge = false; (this.body as Phaser.Physics.Arcade.Body).allowGravity = true; }
  }

  private handleDeath = (payload: { target: any; source: unknown }) => {
    if (payload.target === this.health) { this.currentState = PlayerState.Dead; this.setTint(0xff0000); (this.body as Phaser.Physics.Arcade.Body).setAngularVelocity(360); this.scene.tweens.add({ targets: this, alpha:0, duration:1000, onComplete: () => this.destroy() }); }
  };

  destroy(fromScene?: boolean) { eventBus.off('entity-died', this.handleDeath); super.destroy(fromScene); }
}

// ---------- AIStickman ----------
export class AIStickman extends Phaser.Physics.Arcade.Sprite {
  private health: HealthSystem;
  private weaponManager: WeaponManager;
  private aiController: AIController;
  private aiEnabled = true;
  private facingRight = true;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string, archetype: any, difficultyKey: string) {
    super(scene, x, y, texture);
    scene.add.existing(this); scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(24,40); body.setOffset(4,8); body.setMaxVelocityX(archetype.moveSpeed*1.5); body.setMaxVelocityY(1200);
    this.health = new HealthSystem(archetype.maxHealth);
    this.weaponManager = new WeaponManager(scene, this as any);
    this.weaponManager.clearWeapons();
    this.weaponManager.addWeapon(archetype.weaponId);
    this.weaponManager.switchToSlot(0);
    this.aiController = new AIController(scene, this, archetype, difficultyKey);
    eventBus.on('entity-died', this.handleDeath);
  }
  update(time: number, delta: number) { if (this.aiEnabled) { this.aiController.update(delta); this.weaponManager.update(delta); } }
  getHealthSystem() { return this.health; }
  getWeaponConfig() { const w = this.weaponManager.getCurrentWeapon(); return w ? (w as any).config : weaponConfigs[0]; }
  fireWeapon() { this.weaponManager.getCurrentWeapon()?.fire(); }
  jump() { const body = this.body as Phaser.Physics.Arcade.Body; if (body.blocked.down) body.velocity.y = -500; }
  setFacing(right: boolean) { this.facingRight = right; this.setFlipX(!right); }
  disableAI() { this.aiEnabled = false; this.setVelocityX(0); }
  takeDamage(amount: number) { this.health.takeDamage({ amount, source: this, damageType: DamageType.Bullet }); }
  private handleDeath = (payload: { target: any; source: unknown }) => { if (payload.target === this.health) { this.disableAI(); this.setTint(0xff0000); } };
  destroy(fromScene?: boolean) { eventBus.off('entity-died', this.handleDeath); this.aiController.destroy(); super.destroy(fromScene); }
}

// ---------- Projectile (pooled) ----------
export class Projectile extends Phaser.Physics.Arcade.Sprite {
  private static pool: Projectile[] = [];
  private static POOL_SIZE = 50;
  private damage = 0; private owner: any = null; private lifeTimer = 2000; private active = false;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string) {
    super(scene, x, y, texture);
    scene.add.existing(this); scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(8,8); body.setOffset(-4,-4); body.setAllowGravity(false);
    this.setActive(false); this.setVisible(false);
  }
  static spawn(scene: Phaser.Scene, x: number, y: number, texture: string, damage: number, speed: number, angle: number, owner: any, damageType: DamageType): Projectile {
    if (Projectile.pool.length === 0) { for (let i=0; i<Projectile.POOL_SIZE; i++) { const p = new Projectile(scene, 0,0,texture); Projectile.pool.push(p); } }
    const p = Projectile.pool.pop()!;
    p.setTexture(texture); p.setPosition(x,y); p.setActive(true); p.setVisible(true);
    p.damage = damage; p.owner = owner; p.lifeTimer = 2000; p.active = true;
    p.setVelocity(Math.cos(angle)*speed, Math.sin(angle)*speed); p.setRotation(angle); p.body?.enable();
    return p;
  }
  static release(p: Projectile) { p.active = false; p.setActive(false); p.setVisible(false); p.body?.stop(); p.body?.disable(); Projectile.pool.push(p); }
  preUpdate(time: number, delta: number) {
    if (!this.active) return;
    super.preUpdate(time, delta);
    this.lifeTimer -= delta;
    if (this.lifeTimer <= 0) Projectile.release(this);
    else {
      const bodies = this.scene.physics.overlap(this);
      for (const b of bodies) {
        if (b.gameObject === this.owner) continue;
        const obj = b.gameObject as any;
        if (obj.takeDamage) { obj.takeDamage(this.damage); Projectile.release(this); break; }
      }
    }
  }
  destroy(fromScene?: boolean) { if (this.active) { Projectile.release(this); return; } super.destroy(fromScene); }
}

// ---------- WeaponPickup ----------
export class WeaponPickup extends Phaser.Physics.Arcade.Sprite {
  constructor(scene: Phaser.Scene, x: number, y: number, private weaponId: string) {
    super(scene, x, y, 'weapon_pickup');
    scene.add.existing(this); scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false); body.setImmovable(true);
  }
  getWeaponId() { return this.weaponId; }
}

// ---------- Destructible ----------
export class Destructible extends Phaser.Physics.Arcade.Sprite {
  private health: HealthSystem;
  constructor(scene: Phaser.Scene, x: number, y: number, type: 'crate'|'barrel'|'glass') {
    super(scene, x, y, `destructible_${type}`);
    scene.add.existing(this); scene.physics.add.existing(this);
    this.health = new HealthSystem(type === 'glass' ? 20 : 50);
    this.setImmovable(true);
    eventBus.on('entity-died', this.handleDeath);
  }
  takeDamage(amount: number) { this.health.takeDamage({ amount, source: this, damageType: DamageType.Bullet }); }
  private handleDeath = (payload: { target: any }) => { if (payload.target === this.health) { this.destroy(); } };
  destroy(fromScene?: boolean) { eventBus.off('entity-died', this.handleDeath); super.destroy(fromScene); }
}

// ---------- Hazard ----------
export class Hazard extends Phaser.Physics.Arcade.Sprite {
  private damage = 25; private cooldown = 0;
  constructor(scene: Phaser.Scene, x: number, y: number, width: number, height: number, type: string) {
    super(scene, x, y, `hazard_${type}`);
    scene.add.existing(this); scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(width, height); body.setImmovable(true); body.setAllowGravity(false); this.setDisplaySize(width, height);
  }
  update(delta: number) {
    if (this.cooldown > 0) this.cooldown -= delta/1000;
    if (this.cooldown <= 0) {
      const targets = this.scene.physics.overlap(this);
      for (const t of targets) { const obj = t.gameObject as any; if (obj.takeDamage) { obj.takeDamage(this.damage); this.cooldown = 500; break; } }
    }
  }
}
