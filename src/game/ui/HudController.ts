import type { GameState } from '../../types/game';
import { ITEM_DESCRIPTIONS, ITEM_ORDER, TOOL_ORDER, TOOL_DEFINITIONS } from '../../types/items';

function formatDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (safeSeconds % 60).toString().padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${minutes}:${seconds}`;
  }

  return `${minutes}:${seconds}`;
}

export class HudController {
  private readonly element: HTMLDivElement;
  private readonly statusEl: HTMLDivElement;
  private readonly toolEl: HTMLDivElement;
  private readonly portalHintEl: HTMLDivElement;
  private readonly toolHelpHintEl: HTMLButtonElement;
  private readonly toolHelpEl: HTMLDivElement;
  private toolHelpVisible = false;

  constructor(parent: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'hud hidden';

    this.statusEl = document.createElement('div');
    this.statusEl.className = 'hud-status';

    this.toolEl = document.createElement('div');
    this.toolEl.className = 'hud-tool';

    this.portalHintEl = document.createElement('div');
    this.portalHintEl.className = 'hud-portal hidden';

    this.toolHelpHintEl = document.createElement('button');
    this.toolHelpHintEl.type = 'button';
    this.toolHelpHintEl.className = 'hud-tool-help-hint';
    this.toolHelpHintEl.textContent = '[H] Tool Help';
    this.toolHelpHintEl.addEventListener('click', () => this.toggleToolHelp());

    this.toolHelpEl = document.createElement('div');
    this.toolHelpEl.className = 'hud-tool-help hidden';
    this.toolHelpEl.innerHTML = this.renderToolHelp();

    this.element.appendChild(this.statusEl);
    this.element.appendChild(this.toolEl);
    this.element.appendChild(this.portalHintEl);
    this.element.appendChild(this.toolHelpHintEl);
    this.element.appendChild(this.toolHelpEl);
    parent.appendChild(this.element);

    window.addEventListener('keydown', this.handleKeyDown);
  }

  setVisible(visible: boolean): void {
    this.element.classList.toggle('hidden', !visible);

    if (!visible) {
      this.toolHelpVisible = false;
      this.toolHelpEl.classList.add('hidden');
    }
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
    const escapedSeconds = state.mazeFirstCompletionTimes[state.currentMaze];
    const mazeEscapeTime = typeof escapedSeconds === 'number' ? formatDuration(escapedSeconds) : '--:--';
    const now = Date.now();
    const remainingToolSeconds =
      state.activeToolEndTime === null ? null : Math.max(0, Math.ceil((state.activeToolEndTime - now) / 1000));

    const toolLabel =
      state.activeToolId === null
        ? 'None'
        : remainingToolSeconds === null
          ? state.activeToolId
          : `${state.activeToolId} (${remainingToolSeconds}s)`;

    const wayfinderLabel = state.portalHubUnlocked ? 'Unlocked' : 'Missing';

    this.statusEl.textContent = `Maze ${state.currentMaze} • Completed ${state.completedMazes.length} • Shards ${state.collectedShards} • Wayfinder ${wayfinderLabel} • Elapsed ${formatDuration(state.playtimeSeconds)} • Escape ${mazeEscapeTime} • Seed ${state.playerSeed}`;
    this.toolEl.textContent = `Tool: ${toolLabel}`;
  }

  private renderToolHelp(): string {
    const toolLines = TOOL_ORDER.map((toolId) => {
      const tool = TOOL_DEFINITIONS[toolId];
      const durationText = tool.durationMs === null ? 'duration: permanent' : `duration: ${Math.floor(tool.durationMs / 1000)}s`;
      const visibilityText = tool.visibilityBonus !== 0 ? `vis +${tool.visibilityBonus}` : 'vis +0';
      const speedText = tool.speedMultiplier !== 1 ? `speed x${tool.speedMultiplier}` : 'speed x1.0';
      const consumeText = tool.oneShot ? 'one-shot' : 'reusable';
      return `<div>• ${tool.id}: ${visibilityText}, ${speedText}, ${durationText}, ${consumeText}</div>`;
    });

    const itemLines = ITEM_ORDER.map((itemId) => {
      return `<div>• ${itemId}: ${ITEM_DESCRIPTIONS[itemId]}</div>`;
    });

    return [
      '<div><strong>Tools</strong></div>',
      ...toolLines,
      '<div style="margin-top:6px;"><strong>Items</strong></div>',
      ...itemLines,
    ].join('');
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) {
      return;
    }

    const isHotkey = event.code === 'KeyH' || event.key.toLowerCase() === 'h';

    if (!isHotkey) {
      return;
    }

    if (this.element.classList.contains('hidden')) {
      return;
    }

    event.preventDefault();
    this.toggleToolHelp();
  };

  private toggleToolHelp(): void {
    this.toolHelpVisible = !this.toolHelpVisible;
    this.toolHelpEl.classList.toggle('hidden', !this.toolHelpVisible);
  }
}