import type { Disposable } from '../host';

export const activeEditorDecorationTimeout = 100;
export const updateSelectionTimeout = 20;

/** A debounced callback runner: `call` reschedules, `dispose` cancels. */
export interface DebounceFunction extends Disposable {
  call: (callback: () => void) => void;
}

type DebounceState = {
  timer: ReturnType<typeof setTimeout> | null;
  callback: (() => void) | null;
  timeout: number;
};

/** Creates a debounced callback runner with the given timeout in ms. */
export const createDebounce = (timeout: number): DebounceFunction => {
  const state: DebounceState = { timer: null, callback: null, timeout };
  return {
    call(callback: () => void): void {
      state.callback = callback;
      if (state.timer == null) {
        state.timer = setTimeout(function () {
          state.callback?.();
          state.callback = null;
          state.timer = null;
        }, state.timeout);
      }
    },
    dispose(): void {
      if (state.timer != null) {
        clearTimeout(state.timer);
        state.timer = null;
      }
    },
  };
};
