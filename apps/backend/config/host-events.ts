/**
 * Host event and service types shared across features: document changes,
 * configuration changes, disposables, and the logging output channel.
 */
import type { Range } from '../utils/range';

export interface TextDocumentChange {
  readonly range: Range;
  readonly text: string;
}

export interface ConfigurationChangeEvent {
  affectsConfiguration(section: string): boolean;
}

export interface Disposable {
  dispose(): void;
}

/** A logging sink. The adapter maps this to the IDE's output channel. */
export interface OutputChannel extends Disposable {
  appendLine(value: string): void;
}
