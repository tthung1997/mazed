import type { MazeItemState } from '../../types/items';

export class PortalHubModal {
  private readonly root: HTMLDivElement;
  private readonly listEl: HTMLDivElement;
  private readonly subtitleEl: HTMLParagraphElement;
  private readonly closeButton: HTMLButtonElement;
  private resolveSelection: ((value: number | null) => void) | null = null;
  private visible = false;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'panel hidden';
    this.root.innerHTML = `
      <h2>Portal Hub</h2>
      <p class="hub-subtitle"></p>
      <div class="hub-list"></div>
      <div class="row">
        <button data-action="close">Close</button>
      </div>
    `;

    this.listEl = this.root.querySelector('.hub-list') as HTMLDivElement;
    this.subtitleEl = this.root.querySelector('.hub-subtitle') as HTMLParagraphElement;
    this.closeButton = this.root.querySelector('button[data-action="close"]') as HTMLButtonElement;

    this.closeButton.addEventListener('click', () => {
      this.finish(null);
    });

    parent.appendChild(this.root);
    window.addEventListener('keydown', this.onKeyDown);
  }

  show(
    completedMazes: number[],
    mazeFirstCompletionTimes: Record<number, number>,
    mazeItemState: Record<number, MazeItemState>,
  ): Promise<number | null> {
    this.finish(null);

    this.subtitleEl.textContent = 'Choose a completed maze to return to';
    this.listEl.innerHTML = '';

    const uniqueMazes = [...new Set(completedMazes)].sort((a, b) => a - b);

    for (const mazeNumber of uniqueMazes) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'hub-item';

      const completionSeconds = mazeFirstCompletionTimes[mazeNumber];
      const pickedCount = mazeItemState[mazeNumber]?.pickedUp.length ?? 0;
      const knownTotal = mazeItemState[mazeNumber]?.spawns.length ?? 0;
      const completionText =
        typeof completionSeconds === 'number' && Number.isFinite(completionSeconds)
          ? `${Math.max(0, Math.floor(completionSeconds))}s`
          : '—';

      const pickupText = knownTotal > 0 ? `${pickedCount}/${knownTotal}` : `${pickedCount}`;
      button.textContent = `Maze ${mazeNumber} • First clear ${completionText} • Collected items ${pickupText}`;
      button.addEventListener('click', () => this.finish(mazeNumber));
      this.listEl.appendChild(button);
    }

    this.setVisible(true);

    return new Promise<number | null>((resolve) => {
      this.resolveSelection = resolve;
    });
  }

  hide(): void {
    this.finish(null);
  }

  private finish(value: number | null): void {
    if (!this.visible && this.resolveSelection === null) {
      return;
    }

    this.setVisible(false);

    const resolve = this.resolveSelection;
    this.resolveSelection = null;
    resolve?.(value);
  }

  private setVisible(visible: boolean): void {
    this.visible = visible;
    this.root.classList.toggle('hidden', !visible);
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (!this.visible) {
      return;
    }

    if (event.code !== 'Escape') {
      return;
    }

    event.preventDefault();
    this.finish(null);
  };
}
