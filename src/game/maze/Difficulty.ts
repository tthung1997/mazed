import type { MazeParams } from './MazeTypes';
import { hashString } from '../../utils/hash';

function getMazeSize(mazeNumber: number): number {
  if (mazeNumber <= 3) {
    return 8;
  }

  if (mazeNumber <= 8) {
    return 10;
  }

  return 10 + Math.floor((mazeNumber - 9) / 5) * 2;
}

function getLoopChance(mazeNumber: number): number {
  if (mazeNumber <= 3) {
    return 0.02;
  }

  return Math.min(0.03 + mazeNumber * 0.005, 0.18);
}

export interface ExitDifficultyProfile {
  minDistanceRatio: number;
  preferDeadEnd: boolean;
  minAbsoluteDistance: number;
}

export interface ExitDifficultyTier {
  maxMazeNumber: number;
  profile: ExitDifficultyProfile;
}

export const EXIT_DIFFICULTY_TIERS: ExitDifficultyTier[] = [
  {
    maxMazeNumber: 3,
    profile: {
      minDistanceRatio: 0.55,
      preferDeadEnd: false,
      minAbsoluteDistance: 5,
    },
  },
  {
    maxMazeNumber: 8,
    profile: {
      minDistanceRatio: 0.68,
      preferDeadEnd: false,
      minAbsoluteDistance: 7,
    },
  },
  {
    maxMazeNumber: Number.POSITIVE_INFINITY,
    profile: {
      minDistanceRatio: 0.75,
      preferDeadEnd: true,
      minAbsoluteDistance: 8,
    },
  },
];

export function getExitDifficultyProfile(mazeNumber: number): ExitDifficultyProfile {
  const tier = EXIT_DIFFICULTY_TIERS.find((entry) => mazeNumber <= entry.maxMazeNumber);

  if (!tier) {
    return EXIT_DIFFICULTY_TIERS[EXIT_DIFFICULTY_TIERS.length - 1].profile;
  }

  return tier.profile;
}

export function getMazeParams(playerSeed: string, mazeNumber: number): MazeParams {
  const size = getMazeSize(mazeNumber);
  const complexity = Math.min(0.3 + mazeNumber * 0.02, 0.8);
  const deadEndRatio = Math.min(0.1 + mazeNumber * 0.01, 0.4);
  const loopChance = getLoopChance(mazeNumber);

  return {
    mazeNumber,
    width: size,
    height: size,
    seed: hashString(`${playerSeed}:${mazeNumber}`),
    complexity,
    deadEndRatio,
    loopChance,
    roomChance: 0,
  };
}