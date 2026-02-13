import type { GameState } from '../../types/game';

export class HudController {
  private readonly element: HTMLDivElement;

  constructor(parent: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'hud hidden';
    parent.appendChild(this.element);
  }

  setVisible(visible: boolean): void {
    this.element.classList.toggle('hidden', !visible);
  }

  update(state: GameState): void {
    this.element.textContent = `Maze ${state.currentMaze} • Completed ${state.completedMazes.length} • Seed ${state.playerSeed}`;
  }
}