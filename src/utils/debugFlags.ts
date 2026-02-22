const DEBUG_START_MAZE_PARAM = 'debugStartMaze';

export function parseDebugStartMaze(search: string, isDev: boolean): number | null {
  if (!isDev) {
    return null;
  }

  const params = new URLSearchParams(search);
  const value = params.get(DEBUG_START_MAZE_PARAM);

  if (!value) {
    return null;
  }

  if (!/^\d+$/.test(value)) {
    return null;
  }

  const mazeNumber = Number(value);

  if (!Number.isSafeInteger(mazeNumber) || mazeNumber < 1) {
    return null;
  }

  return mazeNumber;
}
