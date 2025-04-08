import * as path from 'path';
import * as fs from 'fs';

import * as oniguruma from 'vscode-oniguruma';
import type { IOnigLib } from 'vscode-textmate';
import { logError, logInfo } from '../config/logger';

// Resolve the wasm via the package itself — works from any install layout
// (pnpm hoisting, the extension bundle, or a plain node_modules).
const wasmPath = (): string => {
  const onigurumaPkg = require.resolve('vscode-oniguruma/package.json');
  return path.join(path.dirname(onigurumaPkg), 'release', 'onig.wasm');
};

// The library object is stable (it only wraps the module's own functions), so
// it lives at module scope and `finishLoad` can be a zero-arg `.then` callback.
const onigLib: IOnigLib = {
  createOnigScanner: oniguruma.createOnigScanner,
  createOnigString: oniguruma.createOnigString,
};

const finishLoad = (): IOnigLib => {
  logInfo('Oniguruma WASM loaded successfully');
  return onigLib;
};

const failLoad = (err: unknown): never => {
  logError('Failed to load Oniguruma WASM:', err);
  throw err;
};

/** Load the Oniguruma WASM library. Pure: no module state — the resulting
 * promise belongs to the caller (the grammar store caches it). */
export const loadOnigLib = (): Promise<IOnigLib> => {
  const wasmFile = wasmPath();
  logInfo(`Loading Oniguruma WASM from ${wasmFile}`);
  if (!fs.existsSync(wasmFile)) {
    logError(`Oniguruma WASM file not found at ${wasmFile}`);
  }
  return oniguruma.loadWASM({ data: fs.readFileSync(wasmFile) }).then(finishLoad).catch(failLoad);
};
