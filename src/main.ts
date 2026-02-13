import './style.css';
import { GameApp } from './game/core/GameApp';

const appRoot = document.querySelector<HTMLDivElement>('#app');

if (!appRoot) {
  throw new Error('App root not found');
}

const game = new GameApp(appRoot);
game.start();