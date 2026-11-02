import * as path from 'path';
import * as fs from 'fs';

/**
 * The subset of the `vscode-oniguruma` module that the loader needs. The
 * module is passed in by the caller (an IDE adapter or the backend) so this
 * file stays free of any IDE/SDK dependency and can live in `packages/utils`.
 */
export interface OnigLibModule {
  loadWASM(options: { data: Uint8Array | string }): Promise<unknown>;
  createOnigScanner(patterns: string[] | string): unknown;
  createOnigString(str: string): unknown;
}

/** The loaded Oniguruma library object (stable: it only wraps module fns). */
export interface OnigLib {
  createOnigScanner: OnigLibModule['createOnigScanner'];
  createOnigString: OnigLibModule['createOnigString'];
}

/**
 * Resolve the onig.wasm path via the package itself — works from any install
 * layout (pnpm hoisting, the extension bundle, or a plain node_modules).
 */
export const wasmPath = (): string => {
  const onigurumaPkg = require.resolve('vscode-oniguruma/package.json');
  return path.join(path.dirname(onigurumaPkg), 'release', 'onig.wasm');
};

/**
 * Load the Oniguruma WASM library. Pure: no module state — the resulting
 * promise belongs to the caller (the grammar store caches it).
 */
export const loadOnigLib = (
  oniguruma: OnigLibModule,
  logInfo: (message: string) => void,
  logError: (message: string, error?: unknown) => void,
): Promise<OnigLib> => {
  const wasmFile = wasmPath();
  logInfo(`Loading Oniguruma WASM from ${wasmFile}`);
  if (!fs.existsSync(wasmFile)) {
    logError(`Oniguruma WASM file not found at ${wasmFile}`);
  }
  const onigLib: OnigLib = {
    createOnigScanner: oniguruma.createOnigScanner,
    createOnigString: oniguruma.createOnigString,
  };
  const finishLoad = (): OnigLib => {
    logInfo('Oniguruma WASM loaded successfully');
    return onigLib;
  };
  const failLoad = (err: unknown): never => {
    logError('Failed to load Oniguruma WASM:', err);
    throw err;
  };
  return oniguruma.loadWASM({ data: fs.readFileSync(wasmFile) }).then(finishLoad).catch(failLoad);
};
