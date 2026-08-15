import Phaser from 'phaser';
import { eventBus } from './core';

export class ButtonFactory {
  static create(scene: Phaser.Scene, x: number, y: number, label: string, onClick: () => void, width = 200, height = 50): Phaser.GameObjects.Container {
    const bg = scene.add.rectangle(0, 0, width, height, 0x333333, 0.9).setStrokeStyle(1, 0xffffff, 0.5);
    const text = scene.add.text(0, 0, label, { fontFamily: 'Arial', fontSize: '20px', color: '#fff' }).setOrigin(0.5);
    const container = scene.add.container(x, y, [bg, text]);
    container.setSize(width, height);
    container.setInteractive({ useHandCursor: true });
    container.on('pointerover', () => bg.setFillStyle(0x555555, 0.9));
    container.on('pointerout', () => bg.setFillStyle(0x333333, 0.9));
    container.on('pointerdown', onClick);
    return container;
  }
}

export class HUD {
  private scene: Phaser.Scene;
  private healthText: Phaser.GameObjects.Text;
  private ammoText: Phaser.GameObjects.Text;
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.healthText = scene.add.text(10, 10, 'HP: 100', { fontSize: '16px', color: '#fff' }).setScrollFactor(0).setDepth(100);
    this.ammoText = scene.add.text(10, 35, 'Ammo: 8/24', { fontSize: '16px', color: '#fff' }).setScrollFactor(0).setDepth(100);
    eventBus.on('health-changed', this.updateHealth);
    eventBus.on('weapon-fired', this.updateAmmo);
    eventBus.on('weapon-switched', this.updateAmmo);
  }
  private updateHealth = (payload: any) => { this.healthText.setText(`HP: ${payload.current.toFixed(0)}`); };
  private updateAmmo = (payload: any) => { this.ammoText.setText(`Ammo: ${payload.ammo}/24`); };
  destroy() { eventBus.off('health-changed', this.updateHealth); eventBus.off('weapon-fired', this.updateAmmo); eventBus.off('weapon-switched', this.updateAmmo); }
}
