import type { RunOptions } from "axe-core";

// jsdom has no layout engine — color-contrast cannot run in vitest.
// Manual contrast checks are tracked under #352/#368.
export const axeConfig: RunOptions = {
  rules: {
    "color-contrast": { enabled: false },
  },
};
