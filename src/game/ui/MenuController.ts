import {
  DEFAULT_PLAYER_CHARACTER_ID,
  PLAYER_CHARACTER_OPTIONS,
  isPlayerCharacterId,
  type PlayerCharacterId,
} from '../rendering/AssetRegistry';

export class MenuController {
  private readonly startMenu: HTMLDivElement;
  private readonly pauseMenu: HTMLDivElement;
  private readonly characterSelect: HTMLSelectElement;

  constructor(
    parent: HTMLElement,
    callbacks: {
      onNewGame: () => void;
      onOpenLoad: () => void;
      onCharacterChange: (characterId: PlayerCharacterId) => void;
      onResume: () => void;
      onSave: () => void;
      onQuit: () => void;
    },
  ) {
    this.startMenu = document.createElement('div');
    this.startMenu.className = 'panel';
    this.startMenu.innerHTML = `
      <h2>Mazed</h2>
      <p>Escape the maze. Enter the next one. Repeat forever.</p>
      <div class="row">
        <select data-action="character"></select>
      </div>
      <div class="row"><button data-action="new">New Game</button></div>
      <div class="row"><button data-action="load">Load Code</button></div>
    `;

    this.pauseMenu = document.createElement('div');
    this.pauseMenu.className = 'panel hidden';
    this.pauseMenu.innerHTML = `
      <h2>Paused</h2>
      <div class="row"><button data-action="resume">Resume</button></div>
      <div class="row"><button data-action="save">Save / Load</button></div>
      <div class="row"><button data-action="quit">Quit To Menu</button></div>
    `;

    this.characterSelect = this.startMenu.querySelector('[data-action="character"]') as HTMLSelectElement;
    for (const option of PLAYER_CHARACTER_OPTIONS) {
      const element = document.createElement('option');
      element.value = option.id;
      element.textContent = option.label;
      this.characterSelect.appendChild(element);
    }
    this.characterSelect.value = DEFAULT_PLAYER_CHARACTER_ID;

    this.startMenu.querySelector('[data-action="new"]')?.addEventListener('click', callbacks.onNewGame);
    this.startMenu.querySelector('[data-action="load"]')?.addEventListener('click', callbacks.onOpenLoad);
    this.characterSelect.addEventListener('change', () => {
      const value = this.characterSelect.value;

      if (isPlayerCharacterId(value)) {
        callbacks.onCharacterChange(value);
      }
    });
    this.pauseMenu.querySelector('[data-action="resume"]')?.addEventListener('click', callbacks.onResume);
    this.pauseMenu.querySelector('[data-action="save"]')?.addEventListener('click', callbacks.onSave);
    this.pauseMenu.querySelector('[data-action="quit"]')?.addEventListener('click', callbacks.onQuit);

    parent.appendChild(this.startMenu);
    parent.appendChild(this.pauseMenu);
  }

  setStartVisible(visible: boolean): void {
    this.startMenu.classList.toggle('hidden', !visible);
  }

  setPauseVisible(visible: boolean): void {
    this.pauseMenu.classList.toggle('hidden', !visible);
  }

  getSelectedCharacterId(): PlayerCharacterId {
    const value = this.characterSelect.value;
    return isPlayerCharacterId(value) ? value : DEFAULT_PLAYER_CHARACTER_ID;
  }

  setSelectedCharacterId(characterId: PlayerCharacterId): void {
    this.characterSelect.value = characterId;
  }
}