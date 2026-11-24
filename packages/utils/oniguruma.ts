/** The Oniguruma WASM library the TextMate tokenizer runs on: loading it is the
 * one piece of grammar wiring that has nothing to do with the plugin's own state,
 * so it stays a util and the grammar store keeps only its promise.
 */
import * as fs from 'fs';
import * as path from 'path';
import { createRequire } from 'module';
import type * as Oniguruma from 'vscode-oniguruma';

/** loadOnigLib: reads the shipped onig.wasm and hands it to the caller's module, so tokenization can start.
 * @param {typeof Oniguruma} oniguruma the WASM module the caller imported
 * @param {(message: string) => void} logInfo reports where the library was loaded from
 * @param {(message: string, error?: unknown) => void} logError reports a missing or broken WASM file
 * @returns {Promise<typeof Oniguruma>} the loaded library
 */
export function loadOnigLib(
	oniguruma: typeof Oniguruma,
	logInfo: (message: string) => void,
	logError: (message: string, error?: unknown) => void,
): Promise<typeof Oniguruma> {
	const nodeRequire = createRequire(__filename);
	const onigurumaPkg = nodeRequire.resolve('vscode-oniguruma/package.json');
	const wasmFile = path.join(path.dirname(onigurumaPkg), 'release', 'onig.wasm');
	logInfo(`Loading Oniguruma WASM from ${wasmFile}`);
	if (!fs.existsSync(wasmFile)) {
		logError(`Oniguruma WASM file not found at ${wasmFile}`);
	}
	return oniguruma
		.loadWASM({ data: fs.readFileSync(wasmFile) })
		.then(function (): typeof Oniguruma {
			logInfo('Oniguruma WASM loaded successfully');
			return oniguruma;
		})
		.catch(function (err: unknown): never {
			logError('Failed to load Oniguruma WASM:', err);
			throw err;
		});
}
