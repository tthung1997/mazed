export class TransitionSystem {
  private active = false;
  private elapsed = 0;
  private halfTriggered = false;

  constructor(private readonly durationMs: number) {}

  start(onHalfway: () => void, onComplete: () => void): void {
    if (this.active) {
      return;
    }

    this.active = true;
    this.elapsed = 0;
    this.halfTriggered = false;

    this.onHalfway = onHalfway;
    this.onComplete = onComplete;
  }

  update(deltaSeconds: number): number {
    if (!this.active) {
      return 0;
    }

    this.elapsed += deltaSeconds * 1000;
    const half = this.durationMs / 2;

    if (!this.halfTriggered && this.elapsed >= half) {
      this.halfTriggered = true;
      this.onHalfway();
    }

    if (this.elapsed >= this.durationMs) {
      this.active = false;
      this.onComplete();
      return 0;
    }

    if (this.elapsed <= half) {
      return this.elapsed / half;
    }

    return 1 - (this.elapsed - half) / half;
  }

  isActive(): boolean {
    return this.active;
  }

  private onHalfway: () => void = () => undefined;
  private onComplete: () => void = () => undefined;
}