import Phaser from 'phaser';

export interface LevelData {
  id: string;
  name: string;
  theme: string;
  parTime: number;
  starThresholds: { oneStar: number; twoStar: number; threeStar: number };
  grid: number[][];
  tileSize: number;
  enemySpawns: any[];
  weaponPickups: any[];
  healthPickups: any[];
  destructibles: any[];
  hazards: any[];
}

const defaultLevel: LevelData = {
  id: 'default',
  name: 'Default',
  theme: 'urban',
  parTime: 120,
  starThresholds: { oneStar: 100, twoStar: 200, threeStar: 300 },
  grid: Array(12)
    .fill(0)
    .map((_, i) => (i === 10 ? Array(32).fill(1) : Array(32).fill(0))),
  tileSize: 50,
  enemySpawns: [{ type: 'grunt', x: 600, y: 400, difficulty: 'easy' }],
  weaponPickups: [],
  healthPickups: [],
  destructibles: [],
  hazards: [],
};

export class LevelLoader {
  static loadLevel(scene: Phaser.Scene, levelKey: string): LevelData {
    let data = scene.cache.json.get(levelKey) as LevelData;
    if (!data) {
      data = defaultLevel;
    }
    const width = data.grid[0].length * data.tileSize;
    const height = data.grid.length * data.tileSize;
    scene.physics.world.setBounds(0, 0, width, height);
    scene.cameras.main.setBounds(0, 0, width, height);
    this.buildTilemap(scene, data);
    scene.data.set('levelData', data);
    return data;
  }

  private static buildTilemap(scene: Phaser.Scene, data: LevelData) {
    const staticGroup = scene.physics.add.staticGroup();
    for (let row = 0; row < data.grid.length; row++) {
      for (let col = 0; col < data.grid[row].length; col++) {
        const type = data.grid[row][col];
        if (type === 0) continue;
        const x = col * data.tileSize + data.tileSize / 2;
        const y = row * data.tileSize + data.tileSize / 2;
        if (type === 1 || type === 2) {
          const tile = scene.add.rectangle(x, y, data.tileSize, data.tileSize, type === 1 ? 0x888888 : 0x555555);
          staticGroup.add(tile);
        } else if (type === 3) {
          const plat = scene.add.rectangle(x, y, data.tileSize, data.tileSize * 0.3, 0xaaaaaa);
          staticGroup.add(plat);
        }
      }
    }
    scene.data.set('staticGroup', staticGroup);
  }
}
