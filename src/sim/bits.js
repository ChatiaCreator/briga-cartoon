// Input bitmask shared by input, sim and network. Directions are absolute (screen).
export const UP = 1, DOWN = 2, LEFT = 4, RIGHT = 8;
export const LP = 16, HP = 32, LK = 64, HK = 128, SUP = 256;
export const BUTTONS = [LP, HP, LK, HK, SUP];
export const ALL = 511;

// Numpad notation relative to facing (6 = forward, 4 = back, 2 = down, 8 = up).
export function dirOf(input, facing) {
  const fwd = facing > 0 ? RIGHT : LEFT;
  const back = facing > 0 ? LEFT : RIGHT;
  let h = 0;
  if (input & fwd && !(input & back)) h = 1;
  else if (input & back && !(input & fwd)) h = -1;
  let v = 0;
  if (input & UP && !(input & DOWN)) v = 1;
  else if (input & DOWN && !(input & UP)) v = -1;
  return 5 + h + v * 3;
}
