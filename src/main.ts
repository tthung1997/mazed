import './style.css';
import { GameApp } from './game/core/GameApp';

const appRoot = document.querySelector<HTMLDivElement>('#app');

if (!appRoot) {
  throw new Error('App root not found');
}

let game = new GameApp(appRoot);
game.start();

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    game.destroy();
  });

  import.meta.hot.accept(() => {
    game.destroy();
    game = new GameApp(appRoot);
    game.start();
  });
}