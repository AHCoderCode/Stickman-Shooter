import Phaser from 'phaser';
import { eventBus, serviceLocator, AudioManager, ParticleManager } from './core';
import { weaponConfigs, WeaponConfig, WeaponCategory, FireMode } from './config';
import { Projectile } from './entities';

export abstract class Weapon {
  protected scene: Phaser.Scene;
  protected owner: Phaser.Physics.Arcade.Sprite;
  public config: WeaponConfig;
  protected currentAmmo: number;
  protected reserveAmmo: number;
  protected isReloading = false;
  protected reloadTimer = 0;
  protected cooldownTimer = 0;
  protected lastFireTime = 0;

  constructor(scene: Phaser.Scene, config: WeaponConfig, owner: Phaser.Physics.Arcade.Sprite) {
    this.scene = scene;
    this.config = config;
    this.owner = owner;
    this.currentAmmo = config.magazineSize;
    this.reserveAmmo = config.magazineSize * 3;
  }

  get ammo() {
    return this.currentAmmo;
  }
  get reserve() {
    return this.reserveAmmo;
  }
  get isReloadingState() {
    return this.isReloading;
  }

  update(delta: number) {
    if (this.isReloading) {
      this.reloadTimer -= delta / 1000;
      if (this.reloadTimer <= 0) this.finishReload();
    }
    if (this.cooldownTimer > 0) this.cooldownTimer -= delta / 1000;
  }

  fire() {
    if (this.isReloading || this.cooldownTimer > 0) return;
    if (this.currentAmmo <= 0) {
      this.startReload();
      return;
    }
    this.performFire();
    this.currentAmmo--;
    this.cooldownTimer = 1 / this.config.fireRate;
    if (this.currentAmmo <= 0) this.startReload();
    eventBus.emit('weapon-fired', { ammo: this.currentAmmo });
  }

  protected abstract performFire(): void;

  startReload() {
    if (this.isReloading || this.currentAmmo === this.config.magazineSize || this.reserveAmmo <= 0) return;
    this.isReloading = true;
    this.reloadTimer = this.config.reloadTime;
  }

  protected finishReload() {
    const need = this.config.magazineSize - this.currentAmmo;
    const take = Math.min(need, this.reserveAmmo);
    this.currentAmmo += take;
    this.reserveAmmo -= take;
    this.isReloading = false;
  }

  addAmmo(amount: number) {
    this.reserveAmmo += amount;
  }

  protected getBarrelPosition() {
    return new Phaser.Math.Vector2(this.owner.x + (this.owner.flipX ? -20 : 20), this.owner.y - 5);
  }

  protected getAimAngle() {
    const p = this.scene.input.activePointer;
    const wp = this.scene.cameras.main.getWorldPoint(p.x, p.y);
    return Phaser.Math.Angle.Between(this.owner.x, this.owner.y, wp.x, wp.y);
  }
}

export class HitscanWeapon extends Weapon {
  private tracerPool: Phaser.GameObjects.Graphics[] = [];

  protected performFire() {
    const barrel = this.getBarrelPosition();
    const angle = this.getAimAngle();

    for (let i = 0; i < this.config.bulletCount; i++) {
      const spread = Phaser.Math.DegToRad(this.config.spread / 2);
      const a = angle + (Math.random() - 0.5) * spread * 2;
      const endX = this.owner.x + Math.cos(a) * this.config.range;
      const endY = this.owner.y + Math.sin(a) * this.config.range;

      const ray = new Phaser.Geom.Line(this.owner.x, this.owner.y, endX, endY);
      const hits = this.scene.physics.overlapRect(
        Math.min(this.owner.x, endX),
        Math.min(this.owner.y, endY),
        Math.abs(endX - this.owner.x),
        Math.abs(endY - this.owner.y),
        true,
        true
      );

      let nearestDist = Infinity;
      let nearestTarget: any = null;
      let nearestPoint = new Phaser.Math.Vector2(endX, endY);

      for (const hit of hits) {
        if (hit.gameObject === this.owner) continue;
        const body = hit.gameObject.body as Phaser.Physics.Arcade.Body;
        if (body && body.gameObject !== this.owner) {
          const intersection = Phaser.Geom.Intersects.GetLineToRectangle(ray, body);
          if (intersection) {
            const d = Phaser.Math.Distance.Between(this.owner.x, this.owner.y, intersection.x, intersection.y);
            if (d < nearestDist) {
              nearestDist = d;
              nearestTarget = hit.gameObject;
              nearestPoint = intersection;
            }
          }
        }
      }

      this.drawTracer(barrel, nearestPoint);

      if (nearestTarget) {
        if (nearestTarget.takeDamage) nearestTarget.takeDamage(this.config.damage);
        else if (nearestTarget.getHealthSystem)
          nearestTarget.getHealthSystem().takeDamage({
            amount: this.config.damage,
            source: this.owner,
            damageType: 'bullet',
          });
      }
    }

    eventBus.emit('muzzle-flash', { x: barrel.x, y: barrel.y });
    serviceLocator.get<AudioManager>('AudioManager').playGunshot();
  }

  private drawTracer(start: Phaser.Math.Vector2, end: Phaser.Math.Vector2) {
    const g = this.scene.add.graphics();
    g.lineStyle(1, 0xffff00, 0.8);
    g.lineBetween(start.x, start.y, end.x, end.y);
    this.tracerPool.push(g);
    this.scene.time.delayedCall(50, () => {
      const t = this.tracerPool.shift();
      t?.destroy();
    });
  }
}

export class ProjectileWeapon extends Weapon {
  protected performFire() {
    const barrel = this.getBarrelPosition();
    const angle = this.getAimAngle();

    for (let i = 0; i < this.config.bulletCount; i++) {
      const spread = Phaser.Math.DegToRad(this.config.spread / 2);
      const a = angle + (Math.random() - 0.5) * spread * 2;
      Projectile.spawn(
        this.scene,
        barrel.x,
        barrel.y,
        this.config.projectileKey || 'bullet',
        this.config.damage,
        this.config.bulletSpeed,
        a,
        this.owner,
        'bullet' as any
      );
    }

    eventBus.emit('muzzle-flash', { x: barrel.x, y: barrel.y });
    serviceLocator.get<AudioManager>('AudioManager').playGunshot();
  }
}

export class MeleeWeapon extends Weapon {
  protected performFire() {
    const dir = this.owner.flipX ? -1 : 1;
    const range = 40;
    const rect = new Phaser.Geom.Rectangle(
      Math.min(this.owner.x, this.owner.x + dir * range),
      this.owner.y - 20,
      range,
      40
    );
    const hits = this.scene.physics.overlapRect(rect.x, rect.y, rect.width, rect.height, true, true);
    for (const hit of hits) {
      if (hit.gameObject === this.owner) continue;
      const obj = hit.gameObject as any;
      if (obj.takeDamage) obj.takeDamage(this.config.damage);
    }
    this.scene.cameras.main.flash(50, 255, 255, 255, false);
  }
}

export class ThrowableWeapon extends ProjectileWeapon {
  protected performFire() {
    const barrel = this.getBarrelPosition();
    const angle = this.getAimAngle();
    Projectile.spawn(
      this.scene,
      barrel.x,
      barrel.y,
      this.config.projectileKey,
      this.config.damage,
      this.config.bulletSpeed,
      angle,
      this.owner,
      'explosion' as any
    );
    eventBus.emit('muzzle-flash', { x: barrel.x, y: barrel.y });
  }
}

export class WeaponManager {
  private weapons = new Map<string, Weapon>();
  private availableSlots: string[] = [];
  private currentSlotIndex = 0;
  private currentWeaponId: string | null = null;
  private firing = false;

  constructor(private scene: Phaser.Scene, private owner: Phaser.Physics.Arcade.Sprite) {
    this.addWeapon('m1911');
    this.addWeapon('knife');
    this.availableSlots = ['m1911', 'knife'];
    this.currentSlotIndex = 0;
    this.currentWeaponId = this.availableSlots[0];

    this.scene.input.keyboard!.on('keydown-R', () => this.reloadCurrent());
    this.scene.input.keyboard!.on('keydown-ONE', () => this.switchToSlot(0));
    this.scene.input.keyboard!.on('keydown-TWO', () => this.switchToSlot(1));
    this.scene.input.keyboard!.on('keydown-THREE', () => this.switchToSlot(2));
    this.scene.input.on('wheel', (pointer: any, gameObjects: any, deltaX: number, deltaY: number) =>
      this.cycleWeapon(deltaY > 0 ? 1 : -1)
    );
  }

  startFiring() {
    this.firing = true;
  }
  stopFiring() {
    this.firing = false;
  }

  update(delta: number) {
    const w = this.getCurrentWeapon();
    if (w) w.update(delta);
    if (this.firing) {
      const cw = this.getCurrentWeapon();
      if (cw) cw.fire();
    }
  }

  addWeapon(id: string) {
    const config = weaponConfigs.find((w) => w.id === id);
    if (!config) return;

    let weapon: Weapon;
    switch (config.category) {
      case WeaponCategory.Melee:
        weapon = new MeleeWeapon(this.scene, config, this.owner);
        break;
      case WeaponCategory.Throwable:
        weapon = new ThrowableWeapon(this.scene, config, this.owner);
        break;
      case WeaponCategory.Launcher:
      case WeaponCategory.Energy:
      case WeaponCategory.Shotgun:
      case WeaponCategory.Sniper:
      case WeaponCategory.Rifle:
      case WeaponCategory.SMG:
      case WeaponCategory.Pistol:
        weapon = new HitscanWeapon(this.scene, config, this.owner);
        break;
      default:
        weapon = new HitscanWeapon(this.scene, config, this.owner);
    }

    this.weapons.set(id, weapon);
    if (!this.availableSlots.includes(id)) this.availableSlots.push(id);
    if (!this.currentWeaponId) this.switchToSlot(0);
  }

  clearWeapons() {
    this.weapons.clear();
    this.availableSlots = [];
    this.currentWeaponId = null;
    this.currentSlotIndex = 0;
  }

  switchToSlot(idx: number) {
    if (idx >= 0 && idx < this.availableSlots.length) {
      this.currentSlotIndex = idx;
      this.currentWeaponId = this.availableSlots[idx];
      eventBus.emit('weapon-switched', { weaponId: this.currentWeaponId });
    }
  }

  cycleWeapon(dir: number) {
    const len = this.availableSlots.length;
    this.currentSlotIndex = (this.currentSlotIndex + dir + len) % len;
    this.currentWeaponId = this.availableSlots[this.currentSlotIndex];
    eventBus.emit('weapon-switched', { weaponId: this.currentWeaponId });
  }

  getCurrentWeapon(): Weapon | null {
    return this.currentWeaponId ? (this.weapons.get(this.currentWeaponId) ?? null) : null;
  }

  reloadCurrent() {
    this.getCurrentWeapon()?.startReload();
  }

  getWeaponData() {
    const w = this.getCurrentWeapon();
    return w
      ? {
          name: (w as any).config.name,
          ammo: w.ammo,
          reserve: w.reserve,
          reloading: w.isReloadingState,
        }
      : null;
  }
}
