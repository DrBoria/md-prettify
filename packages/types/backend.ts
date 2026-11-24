/**
 * The IDE-agnostic backend surface an IDE decorator wraps.
 *
 * An IDE package (`packages/vscode-extension`, `packages/webstorm-extension`)
 * receives this object and turns it into the `activate`/`deactivate` pair the
 * IDE loads. The package never imports the backend: the backend imports the
 * decorator at build time, so the dependency runs one way only.
 */
import type { Disposable } from './config';
import type { Ide } from './ide';
import type { mdPrettify } from './config';

export interface BackendApi {
	/** activate: initializes the backend for the given ide and returns the public api. */
	activate(ide: Ide): mdPrettify;
	/** deactivate: releases every backend resource. */
	deactivate(): void;
	/** registerCommands: registers the backend commands on the ide. */
	registerCommands(ide: Ide): Disposable[];
	/** registerListeners: registers the backend event listeners on the ide. */
	registerListeners(ide: Ide): Disposable[];
}
