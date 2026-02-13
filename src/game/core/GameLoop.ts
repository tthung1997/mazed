import { FIXED_TICK_SECONDS } from './constants';

export class GameLoop {
  private running = false;
  private accumulator = 0;
  private previousTime = 0;

  constructor(
    private readonly onFixedUpdate: (dt: number) => void,
    private readonly onRender: (alpha: number, dt: number) => void,
  ) {}

  start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    this.previousTime = performance.now();
    requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
  }

  private tick = (time: number): void => {
    if (!this.running) {
      return;
    }

    const frameDelta = Math.min((time - this.previousTime) / 1000, 0.1);
    this.previousTime = time;
    this.accumulator += frameDelta;

    while (this.accumulator >= FIXED_TICK_SECONDS) {
      this.onFixedUpdate(FIXED_TICK_SECONDS);
      this.accumulator -= FIXED_TICK_SECONDS;
    }

    this.onRender(this.accumulator / FIXED_TICK_SECONDS, frameDelta);
    requestAnimationFrame(this.tick);
  };
}