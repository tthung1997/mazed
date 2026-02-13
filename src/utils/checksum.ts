import { hashString } from './hash';

export function makeChecksum(payload: string): string {
  const hashHex = hashString(payload);
  const value = Number.parseInt(hashHex, 16) >>> 0;
  return value.toString(36).toUpperCase().padStart(6, '0').slice(0, 6);
}