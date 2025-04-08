import type {
  TextEditorDecorationType,
  DecorationInstanceRenderOptions,
  Range,
  OutputChannel,
} from '../host';
import type { HideTextMethod, Substitution } from '../config/configuration';
import type * as tm from '../grammar/text-mate';
import type { IGrammar, IToken, ITokenizeLineResult, StateStack } from 'vscode-textmate';
import type { Instance } from 'mobx-state-tree';
import type { DocumentStoreModel } from './store';
export type { IGrammar, IToken, ITokenizeLineResult, StateStack };

/** The document store instance type, shared by the engine modules. */
export type DocumentStore = Instance<typeof DocumentStoreModel>;

/** Parameters used to build a decoration cache key.
 *  Extends `Substitution` (its cache-key subset) so the two stay linked:
 *  the key accepts a raw `ugly` pattern that is not yet compiled. */
export interface DecorationKeyParams extends Substitution {
  ugly: RegExp | string,
}

/** A parsed substitution rule: the ugly regex and the pretty replacement text. */
export interface PrettySubstitution extends DecorationKeyParams {
  ugly: RegExp,
  // decorationType is no longer stored here, managed by cache
  // ranges are no longer stored here, managed by cache
}

/** Cache entry structure for generated decoration types and their ranges. */
export interface DecorationCacheEntry {
  decorationType: TextEditorDecorationType;
  ranges: Set<Range>;
  pretty: string; // Store the pretty text here
  priority?: number; // Priority of the rule that owns this entry
}

/** Result of the getLineSegmentsWithScopes helper. */
export interface LineSegmentData {
  range: { startIndex: number, endIndex: number },
  scopes: Set<string>
}

/** A text document the model operates on (read-only view). */
export interface DocumentView {
  uri: string;
  getText: (r: Range) => string;
  getLine: (line: number) => string;
  getLineRange: (line: number) => Range;
  getLineCount: () => number;
  validateRange: (r: Range) => Range;
}

export interface UpdateDecorationEntry {
  decoration: TextEditorDecorationType,
  ranges: Range[],
}

export interface UpdateDecorationInstanceEntry {
  decoration: DecorationInstanceRenderOptions,
  ranges: Set<Range>,
}

/** Options accepted by the PrettyModel constructor. */
export interface PrettyModelOptions extends ControllerOptions {
  languageId: string; // Added languageId to options
  /** When true, the constructor skips the initial full reparse.
   *  The caller must call `reparseViewportFirst` instead. */
  skipInitialReparse?: boolean;
}

/** Options accepted by the PrettyDocumentController constructor. */
export interface ControllerOptions {
  hideTextMethod: HideTextMethod;
  debug: boolean;
  textMateGrammar?: tm.IGrammar | null;
  outputChannel: OutputChannel;
}

export type StackElement = StateStack;

export interface ITextMateRegistry {
  readonly INITIAL: StateStack;
  loadGrammar(scopeName: string): Promise<IGrammar | undefined>;
}
