import { hashString } from './hash';

export class SeededRandom {
  private state: number;

  constructor(seed: string) {
    this.state = Number.parseInt(hashString(seed), 16) || 1;
  }

  next(): number {
    this.state += 0x6d2b79f5;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  nextInt(min: number, maxInclusive: number): number {
    const value = this.next();
    return Math.floor(value * (maxInclusive - min + 1)) + min;
  }

  pick<T>(values: readonly T[]): T {
    return values[this.nextInt(0, values.length - 1)];
  }
}