export class SaveCodeModal {
  private readonly root: HTMLDivElement;
  private readonly outputArea: HTMLTextAreaElement;
  private readonly inputArea: HTMLTextAreaElement;
  private readonly errorEl: HTMLDivElement;

  constructor(parent: HTMLElement, onLoad: (code: string) => void, onClose: () => void) {
    this.root = document.createElement('div');
    this.root.className = 'panel hidden';
    this.root.innerHTML = `
      <h2>Save / Load Code</h2>
      <p>Copy your save code or paste one to load.</p>
      <textarea placeholder="Generated save code"></textarea>
      <div class="row">
        <button data-action="copy">Copy Save Code</button>
      </div>
      <textarea placeholder="Paste code to load"></textarea>
      <div class="row">
        <button data-action="load">Load Code</button>
        <button data-action="close">Close</button>
      </div>
      <div class="error"></div>
    `;

    const textareas = this.root.querySelectorAll('textarea');
    this.outputArea = textareas[0];
    this.inputArea = textareas[1];
    this.errorEl = this.root.querySelector('.error') as HTMLDivElement;

    const copyButton = this.root.querySelector('button[data-action="copy"]') as HTMLButtonElement;
    const loadButton = this.root.querySelector('button[data-action="load"]') as HTMLButtonElement;
    const closeButton = this.root.querySelector('button[data-action="close"]') as HTMLButtonElement;

    copyButton.addEventListener('click', async () => {
      if (!this.outputArea.value) {
        return;
      }

      await navigator.clipboard.writeText(this.outputArea.value);
    });

    loadButton.addEventListener('click', () => {
      onLoad(this.inputArea.value);
    });

    closeButton.addEventListener('click', () => {
      onClose();
    });

    parent.appendChild(this.root);
  }

  setVisible(visible: boolean): void {
    this.root.classList.toggle('hidden', !visible);
    if (!visible) {
      this.errorEl.textContent = '';
    }
  }

  setOutput(code: string): void {
    this.outputArea.value = code;
  }

  setError(message: string): void {
    this.errorEl.textContent = message;
  }
}