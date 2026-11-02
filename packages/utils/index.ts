export { assignStyleProperties } from './style-properties';
export { createGrammarLocator } from './grammar-locator';
export {
  positionFrom,
  positionCompare,
  positionIsEqual,
  positionIsNull,
  positionTranslate,
  positionWith,
  rangeFrom,
  rangeFromPositions,
  isRange,
  rangeIsEmpty,
  rangeIsEqual,
  rangeIsSingleLine,
  rangeIsValid,
  rangeContains,
  rangeIntersection,
  rangeUnion,
  rangeEndIsAt,
  rangeTranslate,
  rangeWith,
  mapSet,
  selectionFrom,
} from './range';
export {
  toRangeDelta,
  rangeDeltaNewRange,
  rangeTranslateByDelta,
  rangeContainsAt,
  maxPosition,
  shiftRangeDeltaForSet,
} from './text-deltas';
export {
  offsetAt,
  relativeOffsetAtAbsolutePosition,
  positionAtRelative,
  positionAt,
} from './text-offsets';
export { passthrough } from './mst-passthrough';
export { adjustCursorMovement } from './cursor-movement';
export {
  filterEnabledRanges,
  collectCacheDecorationEntries,
  collectHiddenDecorationEntry,
  buildDecorationsList,
  switchedLineDisabled,
  documentDecorationEntries,
  toggleLineDisabled,
  collectDecorationTypes,
  visibleRanges,
} from './decorations';
export type { DecorationListEntry } from './decorations';
export { createDebounce, activeEditorDecorationTimeout, updateSelectionTimeout } from './debounce';
export type { DebounceFunction } from './debounce';
export { arrayEqual, selectionsEqual, anySelectionMoved, computeAdjustedSelections } from './selections';
export { editorsForDocument, editorUsable, applyDecorationEntries } from './editors';
export type { DecorationEntry } from './editors';
export { createDocumentModel } from './document-view';
export {
  classifyRuleScopes,
  isScopeApplicable,
  collectIntersectingScopes,
  getScopesForRange,
} from './reparse-scopes';
export type { ReparseToken, ScopeRule, ClassifiedScopes } from './reparse-scopes';
export {
  scopeSetByRangeKey,
  segmentMapFromScopes,
  getLineSegmentsWithScopes,
  isSegmentExcluded,
} from './reparse-segments';
export type { SegmentRange, LineSegmentData } from './reparse-segments';
export {
  outsideLineRange,
  compareChangeStart,
  reparseLineSpan,
  rangesOutsideLineRange,
} from './reparse-lines';
export { rulesOfPriority, rulesInPriorityOrder } from './reparse-rules';
export {
  resolveDynamicPart,
  findNextPlaceholderStart,
  prettyPartsOf,
  dollarZeroOnlyDecoration,
  wholeMatchCaptureDecoration,
  prettyPartSteps,
} from './reparse-dynamic';
export type { ResolvedDynamicRange, PrettyPartStep } from './reparse-dynamic';
export { chunkedFullReparse } from './reparse-chunks';
export type { ChunkReparseOptions } from './reparse-chunks';
export { hasHighPriorityScope } from './reparse-rules';
export { getDecorationCacheKey } from './decoration-cache';
export {
	rangeKey,
	buildLineIndex,
	indexInsert,
	indexRemove,
	overlapCandidates,
	rebuildRangeKeyMap,
	shiftKeyMapForSet,
	keyMapRemove,
} from './range-index';
export {
	makePrettyDecorationLetterSpacingHack,
	makeDecorationsFontSizeHack,
	makeDecorationsLetterSpacingHack,
	makeDecorationsNone,
	makeHideTextDecorations,
	hasPriorityScopes,
} from './pretty-decorations';
export {
	getCacheKeyPriority,
	addOrUpdatePrettyRange,
	addResolvedRange,
} from './pretty-range';
export { findSymbolAt, findSymbolsIn } from './lookup';
export { getDecoratedText } from './decorated-text';
export {
	revealSelections,
	findSymbolsOnLine,
	renderPrettyCursor,
} from './reveal';
export {
	rankLanguageEntry,
	compareByRankDesc,
	applyDefaultsToEntry,
	appendArray,
	mergeUserEntry,
	getPredefinedEntry,
	getLanguageEntry,
	DEFAULT_LANGUAGE_ENTRY_CONTEXT,
} from './language-entry';
export type { LanguageEntryContext } from './language-entry';
export { languageEntryContextFrom } from './language-entry';
export { logOpenDocumentError } from './log-error';
export { settingsFromConfiguration } from './settings';
export type { RawConfiguration, Settings } from './settings';
export { wasmPath, loadOnigLib } from './onig-wasm';
export type { OnigLib, OnigLibModule } from './onig-wasm';
export { createRegistry, loadGrammarSync, createDummyGrammar } from './text-mate-registry';
export type { IGrammarLocator, IGrammarInfo } from './text-mate-registry';
export { matchScope } from './scope-match';
export { groupSubstitutionsByScope } from './substitutions';
export type { IGrammar, IOnigLib, IToken, ITokenizeLineResult, StateStack, StackElement, ITextMateRegistry } from './vscode-textmate';
export { sameScopes } from './same-scopes';
export { combineIdenticalTokenScopes } from './combine-identical-token-scopes';
export { groupAndMergeTokensByScope } from './group-and-merge-tokens-by-scope';
