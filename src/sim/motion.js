// Command-input reading. `hist` holds the last HIST directions (numpad notation, relative
// to facing), newest last.
export const HIST = 24;

// Quarter circle forward: down, (down-forward), forward, finished within ~16 frames.
// Lenient: down-forward alone counts as the down part, and the diagonal can be skipped.
export function qcf(hist) {
  const n = hist.length;
  let i = n - 1;
  const limitFwd = n - 8;
  while (i >= limitFwd && i >= 0 && hist[i] !== 6) i--;
  if (i < limitFwd || i < 0) return false;
  const limitDown = Math.max(0, i - 16);
  for (let j = i - 1; j >= limitDown; j--) {
    if (hist[j] === 2 || hist[j] === 3) return true;
  }
  return false;
}
