import Phaser from 'phaser';
import { gameConfig } from './config';
import { Game } from './core';

window.addEventListener('DOMContentLoaded', () => {
  new Game(gameConfig);
});
