import type { GameState } from '../../types/game';

export class HudController {
  private readonly element: HTMLDivElement;
  private readonly statusEl: HTMLDivElement;
  private readonly portalHintEl: HTMLDivElement;

  constructor(parent: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'hud hidden';

    this.statusEl = document.createElement('div');
    this.statusEl.className = 'hud-status';

    this.portalHintEl = document.createElement('div');
    this.portalHintEl.className = 'hud-portal hidden';

    this.element.appendChild(this.statusEl);
    this.element.appendChild(this.portalHintEl);
    parent.appendChild(this.element);
  }

  setVisible(visible: boolean): void {
    this.element.classList.toggle('hidden', !visible);
  }

  setPortalHint(text: string | null): void {
    if (!text) {
      this.portalHintEl.classList.add('hidden');
      this.portalHintEl.textContent = '';
      return;
    }

    this.portalHintEl.textContent = text;
    this.portalHintEl.classList.remove('hidden');
  }

  update(state: GameState): void {
    this.statusEl.textContent = `Maze ${state.currentMaze} • Completed ${state.completedMazes.length} • Seed ${state.playerSeed}`;
  }
}