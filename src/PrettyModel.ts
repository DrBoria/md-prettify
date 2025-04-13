/**
 * Copyright 2016 by Christian J. Bell
 * 
 * PrettyModel.ts
 * 
 * Models the substitutions within a text document
 */
import * as vscode from 'vscode';
import { Substitution, LanguageEntry, PrettyStyle, HideTextMethod } from './configuration';
import * as textUtil from './text-util';
import * as tm from './text-mate';
import * as decorations from './decorations';
import { getLanguageScopeName } from './extension';


export interface PrettySubstitution {
  ugly: RegExp,
  pretty: string,
  // decorationType is no longer stored here, managed by cache
  // ranges are no longer stored here, managed by cache
  style?: PrettyStyle,
  scope?: string | string[],
}

// Cache entry structure
interface DecorationCacheEntry {
  decorationType: vscode.TextEditorDecorationType;
  ranges: Set<vscode.Range>;
  pretty: string; // Store the pretty text here
}

// Structure for the result of getLineSegmentsWithScopes helper
interface LineSegmentData {
    range: { startIndex: number, endIndex: number },
    scopes: Set<string>
}

export interface DocumentModel {
  getText: (r: vscode.Range) => string;
  getLine: (line: number) => string;
  getLineRange: (line: number) => vscode.Range;
  getLineCount: () => number;
  validateRange: (r: vscode.Range) => vscode.Range;
}

export interface UpdateDecorationEntry {
  decoration: vscode.TextEditorDecorationType,
  ranges: vscode.Range[],
}

export interface UpdateDecorationInstanceEntry {
  decoration: vscode.DecorationInstanceRenderOptions,
  ranges: Set<vscode.Range>,
}

// Helper function to shift ranges in a Set
function shiftRangeDeltaForSet(set: Set<vscode.Range>, delta: textUtil.RangeDelta): Set<vscode.Range> {
  const newSet = new Set<vscode.Range>();
  for (const range of set) {
    newSet.add(textUtil.rangeTranslate(range, delta));
  }
  return newSet;
}

export class PrettyModel implements vscode.Disposable {
  // Stores the original substitution configurations
  private prettySubstitutions: Set<PrettySubstitution> = new Set();
  /** Cache for generated decoration types and their ranges */
  private decorationCache: Map<string, DecorationCacheEntry> = new Map();
  /** ranges of hidden text - Source of truth for active hidden ranges after overlap resolution */
  private hiddeDecorationsRanges = new Set<vscode.Range>();
  /** things to dispose of at the end */
  private changedUglies = false; // flag used to determine if the uglies have been updated
  // hides a "ugly" decorations
  private hiddenDecoration: vscode.TextEditorDecorationType | null = null;
  // reveals the "ugly" decorations; is applied on top of uglyDecoration and should take priority
  private revealedUglyDecoration: vscode.TextEditorDecorationType | null = null;
  // draws a box around a pretty symbol
  private boxedSymbolDecoration: vscode.DecorationInstanceRenderOptions | null = null;

  // Stores the state for each line
  private grammarState: tm.StackElement[] = [];
  private grammar: null | tm.IGrammar = null;
  private debug: boolean;
  private outputChannel: vscode.OutputChannel;
  private defaultScope: string; // Added to store the default scope
  private excludedScopes: Set<string>; // Added to store excluded scopes for this language entry

  public constructor(doc: DocumentModel, settings: LanguageEntry, options: { 
    hideTextMethod: HideTextMethod; 
    debug: boolean; 
    textMateGrammar?: tm.IGrammar | null; 
    outputChannel: vscode.OutputChannel;
    languageId: string; // Added languageId to options
  },
    private document = doc,
    private revealStrategy = settings.revealOn,
    private prettyCursor = settings.prettyCursor,
    private hideTextMethod = options.hideTextMethod,
  ) {
    this.grammar = options.textMateGrammar || null;
    this.debug = options.debug;
    this.outputChannel = options.outputChannel;
    this.defaultScope = getLanguageScopeName(options.languageId); // Use helper function
    this.excludedScopes = new Set(settings.excludedScopes || []); // Initialize excluded scopes from the language entry
    this.loadDecorations(settings.substitutions);

    // Parse whole document
    const docRange = new vscode.Range(0, 0, this.document.getLineCount(), 0);
    this.reparsePretties(docRange);
  }

  public dispose() {
    this.unloadDecorations();
    this.grammarState = []; // Clear grammar state
    console.log("Disposed PrettyModel instance.");
  }

  /** Generates a unique string key for caching decorations based on substitution parameters. */
  private getDecorationCacheKey(params: { ugly: RegExp | string, pretty: string, scope?: string | string[], style?: PrettyStyle }): string {
    const scopeStr = Array.isArray(params.scope) ? [...params.scope].sort().join(",") : params.scope || '';
    const styleStr = params.style ? JSON.stringify(Object.entries(params.style).sort()) : '';
    const uglyStr = params.ugly instanceof RegExp ? `${params.ugly.source}|${params.ugly.flags}` : params.ugly;
    // Using a separator unlikely to appear in the strings themselves
    return `${uglyStr}:::${params.pretty}:::${scopeStr}:::${styleStr}`;
  }

  public getDecorationsList(): Set<UpdateDecorationEntry> {
    const decs: Set<UpdateDecorationEntry> = new Set();

    // Get decorations from the cache
    for (const cacheEntry of this.decorationCache.values()) {
      if (cacheEntry.ranges.size > 0) {
        decs.add({ decoration: cacheEntry.decorationType, ranges: Array.from(cacheEntry.ranges) });
      }
    }

    // Add the hidden ranges decoration
    if (this.hiddenDecoration && this.hiddeDecorationsRanges.size > 0)
      decs.add({ decoration: this.hiddenDecoration, ranges: Array.from(this.hiddeDecorationsRanges) });

    return decs;
  }

  /** Returns all active decoration types managed by this model. */
  public getAllDecorationTypes(): vscode.TextEditorDecorationType[] {
    const types: vscode.TextEditorDecorationType[] = [];
    if (this.hiddenDecoration) {
        types.push(this.hiddenDecoration);
    }
    if (this.revealedUglyDecoration) {
        types.push(this.revealedUglyDecoration);
    }
    for (const cacheEntry of this.decorationCache.values()) {
        types.push(cacheEntry.decorationType);
    }
    return types;
  }

  private unloadDecorations() {
    // Dispose all cached decoration types FIRST
    for (const cacheEntry of this.decorationCache.values()) {
        try {
            cacheEntry.decorationType.dispose();
        } catch(e) {
             console.error("Error disposing cached decoration type:", e);
        }
    }
    this.decorationCache.clear(); // Clear cache map

    // Dispose main hide/reveal decorations
    if (this.hiddenDecoration) {
        try {
            this.hiddenDecoration.dispose();
        } catch(e) {
             console.error("Error disposing hiddenDecoration:", e);
        }
        this.hiddenDecoration = null;
    }
    if (this.revealedUglyDecoration) {
        try {
             this.revealedUglyDecoration.dispose();
        } catch(e) {
             console.error("Error disposing revealedUglyDecoration:", e);
        }
        this.revealedUglyDecoration = null;
    }

    this.hiddeDecorationsRanges.clear();
    this.prettySubstitutions.clear(); // Clear original configs too
    console.log("Unloaded decorations for model instance.");
  }

  private loadDecorations(substitutions: Substitution[]) {
    this.unloadDecorations(); // Clear previous state including cache

    let dec: { uglyDecoration: vscode.TextEditorDecorationType, revealedUglyDecoration: vscode.TextEditorDecorationType, boxedSymbolDecoration: vscode.DecorationInstanceRenderOptions }
    if (this.hideTextMethod === "hack-fontSize")
      dec = decorations.makeDecorations_fontSize_hack();
    else if (this.hideTextMethod === "hack-letterSpacing")
      dec = decorations.makeDecorations_letterSpacing_hack();
    else
      dec = decorations.makeDecorations_none();
    this.hiddenDecoration = dec.uglyDecoration;
    this.revealedUglyDecoration = dec.revealedUglyDecoration;
    this.boxedSymbolDecoration = dec.boxedSymbolDecoration;

    this.prettySubstitutions = new Set();
    for (const subst of substitutions) {
      const uglyStr = subst.ugly;
      try {
        const re = new RegExp(uglyStr, "g");
        if (re.test("")) {
          console.warn(`Substitution ignored because it matches the empty string: "${uglyStr}" --> "${subst.pretty}"`);
          continue;
        }

        // Store the raw configuration, decorations will be created on demand and cached
        this.prettySubstitutions.add({
          ugly: re,
          pretty: subst.pretty,
          // No decorationType or ranges here
          style: subst.style,
          scope: subst.scope,
        });
      } catch (e) {
        console.warn(`Could not add rule "${uglyStr}" --> "${subst.pretty}"; invalid regular expression`)
      }
    }
  }

  private refreshTokensOnLine(line: string, lineNumber: number): { tokens: tm.IToken[], invalidated: boolean } {
    if (!this.grammar)
      return { tokens: [], invalidated: false };
    try {
      const prevState = this.grammarState[lineNumber - 1] || null;
      const lineTokens = this.grammar.tokenizeLine(line, prevState);
      const invalidated = !this.grammarState[lineNumber] || !lineTokens.ruleStack.equals(this.grammarState[lineNumber])
      this.grammarState[lineNumber] = lineTokens.ruleStack;
      return { tokens: lineTokens.tokens, invalidated: invalidated };
    } catch (err) {
      console.error(`Error when refresh tokens on line '${line}', lineNumber: ${lineNumber}`, err);
      return { tokens: [], invalidated: false };
    }
  }

  /**
   * Adds a new range for a pretty substitution, handling overlaps.
   * If newRange overlaps with existingRange:
   * - If existingRange contains newRange, newRange is ignored.
   * - If newRange contains existingRange, existingRange is removed.
   * - Otherwise (partial overlap), both might co-exist initially, but later rules might remove earlier ones if they contain them.
   * @param newRange The newly matched range.
   * @param newCacheKey The cache key for the rule that generated newRange.
   */
  private addOrUpdatePrettyRange(newRange: vscode.Range, newCacheKey: string) {
      let shouldAdd = true;
      const rangesToRemove = new Set<vscode.Range>();

      // Check against existing hidden ranges for dominance
      for (const existingRange of this.hiddeDecorationsRanges) {
          if (existingRange.intersection(newRange)) {
              // Check if existing range completely contains the new one
              if (existingRange.contains(newRange) && !existingRange.isEqual(newRange)) { // Allow equal ranges to replace
                  shouldAdd = false;
                  break; // Existing range dominates, stop checking
              }
              // Check if new range contains the existing one
              if (newRange.contains(existingRange)) {
                  rangesToRemove.add(existingRange);
              }
          }
      }

      if (!shouldAdd) {
          return; // Do not add this new range
      }

      // Remove dominated ranges from hiddeDecorationsRanges
      if (rangesToRemove.size > 0) {
           this.hiddeDecorationsRanges = new Set(
               [...this.hiddeDecorationsRanges].filter(r => !rangesToRemove.has(r))
           );
      }

      // Add the new range (it wasn't dominated)
      this.hiddeDecorationsRanges.add(newRange);

      // --- Update Cache ---

      // Find which cache entries the removed ranges belonged to
      if (rangesToRemove.size > 0) {
          for (const [_, entry] of this.decorationCache.entries()) {
              const removedFromThisEntry = new Set<vscode.Range>();
              for (const existingRange of entry.ranges) {
                  if (rangesToRemove.has(existingRange)) {
                      removedFromThisEntry.add(existingRange);
                  }
              }
              if (removedFromThisEntry.size > 0) {
                   // Update the entry's ranges directly
                   entry.ranges = new Set([...entry.ranges].filter(r => !removedFromThisEntry.has(r)));
              }
          }
      }


      // Add the new range to its corresponding cache entry
      let cacheEntry = this.decorationCache.get(newCacheKey);
      // Ensure cache entry exists (it should if created earlier, but double-check)
      if (!cacheEntry) {
          // This part ideally shouldn't be hit frequently if cache creation is handled before calling this
          // Find the original config to recreate decoration type if needed
          // This might require restructuring how configs are accessed or passed.
          // For now, let's assume the cache entry was created upstream.
          // If it MUST be created here, we need access to the substitution config.
          console.warn(`Cache entry not found for key ${newCacheKey} when adding range. Creating placeholder.`);
           // Find the corresponding PrettySubstitution config (might need adjustment)
           let configData: PrettySubstitution | undefined;
           for(const sub of this.prettySubstitutions){
                const key = this.getDecorationCacheKey(sub);
                if(key === newCacheKey){
                    configData = sub;
                    break;
                }
           }

           if(configData && configData.pretty){
                const newDecoration = decorations.makePrettyDecoration_letterSpacing_hack({
                     ugly: `${configData.ugly}`,
                     pretty: configData.pretty,
                     scope: configData.scope,
                     style: configData.style,
                });
                cacheEntry = { decorationType: newDecoration, ranges: new Set(), pretty: configData.pretty };
                this.decorationCache.set(newCacheKey, cacheEntry);
           } else {
               console.error(`Could not create cache entry for ${newCacheKey}. Range not added to cache.`);
               return; // Cannot add to cache if entry cannot be ensured
           }

      }

      cacheEntry.ranges.add(newRange);
  }

  /**
   * Helper function to determine unique text segments on a line and all scopes associated with each segment.
   * Uses tm.groupAndMergeTokensByScope to handle scope resolution for overlapping/nested tokens.
   * @param line The text content of the line.
   * @param tokens The raw TextMate tokens for the line.
   * @returns A Map where keys are range strings ("startIndex-endIndex") and values are LineSegmentData.
   */
  private getLineSegmentsWithScopes(line: string, tokens: tm.IToken[]): Map<string, LineSegmentData> {
    // Using Map<RangeKeyString, ...> where RangeKeyString is "start-end"
    const rangeToScopesMap: Map<string, Set<string>> = new Map();

    // groupAndMergeTokensByScope needs text, so recreate tokensWithText
    const tokensWithText = tokens.map(token => ({
        ...token,
        text: line.substring(token.startIndex, token.endIndex)
    }));
     // This function internally handles merging scopes for overlapping/nested tokens correctly
    const combinedTokensByScope = tm.groupAndMergeTokensByScope(tokensWithText);

    // Invert the map: from scope -> ranges to rangeKey -> scopes
    for (const scope in combinedTokensByScope) {
        const ranges = combinedTokensByScope[scope];
        for (const range of ranges) {
            // Create a unique key for the range start/end
            const rangeKey = `${range.startIndex}-${range.endIndex}`;
            if (!rangeToScopesMap.has(rangeKey)) {
                rangeToScopesMap.set(rangeKey, new Set());
            }
            // Add the current scope to the set for this rangeKey
            rangeToScopesMap.get(rangeKey)!.add(scope);
        }
    }

    // Convert to the final desired Map structure
    const finalSegmentMap: Map<string, LineSegmentData> = new Map();
    rangeToScopesMap.forEach((scopes, rangeKey) => {
        const [startStr, endStr] = rangeKey.split('-');
        const startIndex = parseInt(startStr, 10);
        const endIndex = parseInt(endStr, 10);
        // Only add segments with actual text content
        if (startIndex < endIndex) {
            finalSegmentMap.set(rangeKey, {
                range: { startIndex, endIndex },
                scopes: scopes
            });
        }
    });

    return finalSegmentMap;
  }

  /** Helper function to get all unique scopes intersecting a given character range on a line */
  private getScopesForRange(lineTokens: tm.IToken[], targetRangeStartChar: number, targetRangeEndChar: number): Set<string> {
    const intersectingScopes = new Set<string>();
    // If grammar isn't loaded or no tokens, return empty set (or default scope later)
    if (!this.grammar || !lineTokens) return intersectingScopes;

    for (const token of lineTokens) {
        // Check for intersection: token overlaps with targetRange
        // Intersection condition: !(token ends before target starts || token starts after target ends)
        // Simplified: (token.endIndex > targetRangeStartChar) AND (token.startIndex < targetRangeEndChar)
        if (token.endIndex > targetRangeStartChar && token.startIndex < targetRangeEndChar) {
            // Add all scopes from the TextMate token (they are hierarchical in the array)
            for (const scope of token.scopes) {
                intersectingScopes.add(scope);
            }
        }
    }

    // If no specific scopes were found intersecting the range, add the default document scope.
    // This ensures rules without specific scope requirements can still apply to text
    // that might not have explicit tokens (like whitespace between tokens) but is part of the document.
    if (intersectingScopes.size === 0 && this.defaultScope) {
      intersectingScopes.add(this.defaultScope);
    }

    return intersectingScopes;
  }

  /** Reparses the given range or the entire document if no range is provided.
   * Updates decoration ranges within the parsed scope, utilizing the cache and supporting negative scopes.
   * @returns the range that was acutally reparsed
   */
  private reparsePretties(rangeToReparse?: vscode.Range) {
    rangeToReparse = rangeToReparse || new vscode.Range(0, 0, this.document.getLineCount(), 0);
    rangeToReparse = this.document.validateRange(rangeToReparse);

    const lineCount = this.document.getLineCount();
    // No longer need combinedConfig here, will iterate all rules directly

    for (let lineIdx = 0; lineIdx < lineCount; ++lineIdx) {
      // Skip lines outside the reparse range if specified
      if (rangeToReparse && (lineIdx < rangeToReparse.start.line || lineIdx > rangeToReparse.end.line)) {
          // Ensure grammar state is updated even for skipped lines if necessary
          if(this.grammar && !this.grammarState[lineIdx]) {
              const line = this.document.getLine(lineIdx);
              this.refreshTokensOnLine(line, lineIdx); // Update state without processing pretties
          }
          continue;
      }

      const line = this.document.getLine(lineIdx);
      const { tokens } = this.refreshTokensOnLine(line, lineIdx);
      // Keep track of $0 ranges logged on this line to avoid duplicates from overlapping segments
      const loggedDollarZeroRangesThisLine = new Set<string>();

      // Get segments and their scopes for the line using the new helper
      const lineSegments = this.getLineSegmentsWithScopes(line, tokens);

      if (this.debug && this.outputChannel) {
         // Adjusted Debug Logging
         this.outputChannel.appendLine(`--- Line ${lineIdx + 1} ---`);
         if (lineSegments.size === 0) {
            this.outputChannel.appendLine(` No segments found.`);
         }
         lineSegments.forEach((segmentData, rangeKey) => {
              const segmentText = line.substring(segmentData.range.startIndex, segmentData.range.endIndex);
              const scopeArray = Array.from(segmentData.scopes);
              this.outputChannel.appendLine(` Segment [${segmentData.range.startIndex}-${segmentData.range.endIndex}]: '${segmentText}', Scopes: [${scopeArray.join(', ')}]`);
         });
      }

      // Iterate through each segment found on the line
      for (const [/*rangeKey*/, segmentData] of lineSegments.entries()) { // rangeKey is unused currently
           const substring = line.substring(segmentData.range.startIndex, segmentData.range.endIndex);
           const tokenScopes = segmentData.scopes; // Scopes for this specific segment

           // --- Language-Specific Exclude Check --- START ---
           let isExcluded = false;
           if (this.excludedScopes.size > 0 && tokenScopes.size > 0) {
               for (const scope of tokenScopes) {
                   for (const excludedPrefix of this.excludedScopes) {
                       if (scope.startsWith(excludedPrefix)) {
                           isExcluded = true;
                           break;
                       }
                   }
                   if (isExcluded) break;
               }
           }

           if (isExcluded) {
               if (this.debug && this.outputChannel) {
                   const segmentText = line.substring(segmentData.range.startIndex, segmentData.range.endIndex);
                   const scopeArray = Array.from(tokenScopes);
                   this.outputChannel.appendLine(`  -> Segment [${segmentData.range.startIndex}-${segmentData.range.endIndex}] ('${segmentText}') excluded by language entry due to scopes: [${scopeArray.join(', ')}] matching excludes: [${Array.from(this.excludedScopes).join(', ')}]`);
               }
               continue; // Skip this segment entirely if excluded by the language entry
           }
           // --- Language-Specific Exclude Check --- END ---

           // Iterate through ALL substitution rules
           for (const configData of this.prettySubstitutions) {
               const regex = configData.ugly;
               if (!(regex instanceof RegExp)) continue; // Should not happen, but safe check

               // Ensure regex has 'g' flag for matchAll
               const flags = regex.flags.includes('g') ? regex.flags : regex.flags + 'g';
               const regexGlobal = new RegExp(regex.source, flags);
               const matchIterator = substring.matchAll(regexGlobal); // Match against the full line

               for (const match of matchIterator) {
                   if (match.index === undefined || match[0].length === 0) continue;

                   const startChar = match.index;
                   const endChar = startChar + match[0].length;
                   const uglyRange = new vscode.Range(lineIdx, startChar, lineIdx, endChar);

                   if (uglyRange.isEmpty) continue;

                   // Get *all* scopes intersecting the match range using the helper
                   const matchScopes = this.getScopesForRange(tokens, startChar, endChar);

                   // --- Start Scope Check (using matchScopes) ---
                   const positiveScopes = new Set<string>();
                   const negativeScopes = new Set<string>();
                   const ruleScopes = configData.scope
                       ? (Array.isArray(configData.scope) ? configData.scope : [configData.scope])
                       : [];

                   for (const scope of ruleScopes) {
                       if (typeof scope === 'string') { // Ensure scope is a string
                           if (scope.startsWith('!')) {
                               // Add the scope name without the '!'
                               if(scope.length > 1) negativeScopes.add(scope.substring(1));
                           } else {
                               positiveScopes.add(scope);
                           }
                       }
                   }

                   const ruleNeedsPositiveMatch = positiveScopes.size > 0;
                   let hasPositiveMatch = !ruleNeedsPositiveMatch; // Assume true if no positive scopes needed
                   if (ruleNeedsPositiveMatch) {
                       for (const posScope of positiveScopes) {
                           for (const matchScope of matchScopes) { // Check against scopes at the match location
                               // Check if matchScope starts with posScope OR posScope starts with matchScope
                               if (matchScope.startsWith(posScope) || posScope.startsWith(matchScope)) {
                                   hasPositiveMatch = true;
                                   break; // Found a positive match for this posScope
                               }
                           }
                           if (hasPositiveMatch) break; // Found a positive match overall
                       }
                   }

                   let hasNegativeMatch = false;
                   for (const negScope of negativeScopes) {
                       for (const matchScope of matchScopes) { // Check against scopes at the match location
                           // Check if matchScope starts with negScope OR negScope starts with matchScope
                           if (matchScope.startsWith(negScope) || negScope.startsWith(matchScope)) {
                               hasNegativeMatch = true;
                               break; // Found a negative match for this negScope
                           }
                       }
                       if (hasNegativeMatch) break; // Found a negative match overall
                   }

                   // Apply the rule only if positive condition met AND negative condition NOT met.
                   const isApplicable = hasPositiveMatch && !hasNegativeMatch;
                   // --- End Scope Check ---

                   if (isApplicable) {
                       const hasDynamicParams = /\$\d+/.test(configData.pretty);
                       const matchIterator = substring.matchAll(regexGlobal);

                       for (const match of matchIterator) {
                           // Ensure match exists, has an index, and matched non-empty string
                           if (match.index === undefined || match[0].length === 0) continue;

                           // Calculate absolute character positions in the line
                           const start = segmentData.range.startIndex + match.index;
                           const end = start + match[0].length;
                           const uglyRange = new vscode.Range(lineIdx, start, lineIdx, end);

                           // Double check range validity (start should be <= end)
                           // This was already checked by match[0].length === 0, but being safe.
                           if (uglyRange.isEmpty) continue;

                           if (hasDynamicParams) {
                               this.handlePrettiesWithDynamicParams(lineIdx, start, end, configData, match, loggedDollarZeroRangesThisLine);
                           } else {
                               // Handle static pretties (most common case)
                               const key = this.getDecorationCacheKey(configData);
                               let cacheEntry = this.decorationCache.get(key);

                               // Create cache entry + decoration type if it doesn't exist and we have a 'pretty' value
                               if (!cacheEntry && configData.pretty) {
                                   const newDecoration = decorations.makePrettyDecoration_letterSpacing_hack({
                                       ugly: `${configData.ugly}`, // Use original ugly regex string for context if needed
                                       pretty: configData.pretty,
                                       scope: configData.scope,
                                       style: configData.style,
                                   });
                                   cacheEntry = { decorationType: newDecoration, ranges: new Set(), pretty: configData.pretty };
                                   this.decorationCache.set(key, cacheEntry);
                               }

                               // Add the matched range to the appropriate cache entry using overlap logic
                               // Only add if there's a pretty version (i.e., we are actually hiding/replacing)
                               if (configData.pretty) {
                                   this.addOrUpdatePrettyRange(uglyRange, key);
                               }
                           }
                       }
                   } // End if(isApplicable)
               } // End loop matches
           } // End loop rules
      } // End loop segments
    } // End loop lines

     // After processing all lines, mark that uglies might have changed.
     // More precise tracking could be done within addOrUpdatePrettyRange if needed.
     this.changedUglies = true;
  }

  private handlePrettiesWithDynamicParams(lineIdx: number, matchStart: number, matchEnd: number, configData: PrettySubstitution, match: RegExpMatchArray, loggedDollarZeroRangesThisLine: Set<string>) {
    // --- Special Case: Handle pretties containing only $0 and static text ---
    const containsOtherPlaceholders = /\$(?!0\b)\d+/.test(configData.pretty);
    if (!containsOtherPlaceholders && configData.pretty.includes('$0')) {
        const uglyRange = new vscode.Range(lineIdx, matchStart, lineIdx, matchEnd);
        // Calculate the actual pretty text by substituting $0
        const resolvedPretty = configData.pretty.replace('$0', match[0]);

        // Check if this specific $0 range has already been logged for this line
        const rangeKey = `${uglyRange.start.line}:${uglyRange.start.character}-${uglyRange.end.character}`;
        if (!loggedDollarZeroRangesThisLine.has(rangeKey)) {
            loggedDollarZeroRangesThisLine.add(rangeKey);
            // Add debug logging specifically for this $0 case
            if (this.debug && this.outputChannel) {
                this.outputChannel.appendLine(` Part '$0' corresponds to original substring '${match[0]}' [${matchStart}-${matchEnd}]`);
            }
        }

        // Use a cache key specific to the *resolved* text to ensure unique decorations
        const keyParams = {
            ugly: configData.ugly, // Keep original ugly for context
            pretty: resolvedPretty, // Use RESOLVED pretty text for key
            scope: configData.scope,
            style: configData.style,
        };
        const key = this.getDecorationCacheKey(keyParams);
        let cacheEntry = this.decorationCache.get(key);

        if (!cacheEntry) {
            // Create the decoration type using the resolved pretty text
            const newDecoration = decorations.makePrettyDecoration_letterSpacing_hack({
                ugly: match[0], // Original matched text
                pretty: resolvedPretty,
                scope: configData.scope,
                style: configData.style,
            });
            // Store the resolved pretty text in the cache entry
            cacheEntry = { decorationType: newDecoration, ranges: new Set(), pretty: resolvedPretty };
            this.decorationCache.set(key, cacheEntry);
        }

        // Add the range to the specific cache entry for this resolved text
        this.addOrUpdatePrettyRange(uglyRange, key);
        return; // Handled directly, skip the part-by-part logic
    }
    // --- End Special Case ---

    // Original logic for handling complex substitutions with $1, $2, etc.
    const prettyParts = configData.pretty.split(/(\$\d+)/g);
    const originalMatchText = match[0];
    let currentOriginalIndex = 0; // Index within originalMatchText
    let currentAbsolutePos = matchStart; // Absolute start position in the line

    for (let i = 0; i < prettyParts.length; i++) {
        const part = prettyParts[i];
        if (part === '') continue;

        const isDynamicPlaceholder = part.match(/^\$(\d+)$/);
        let partOriginalText = ''; // Text from original match this part corresponds to
        let partOriginalLength = 0; // Length from original match this part corresponds to

        if (isDynamicPlaceholder) {
            // Placeholder like $0, $1, $2
            const paramIndex = parseInt(isDynamicPlaceholder[1], 10);

            if (paramIndex < match.length && match[paramIndex] !== undefined) {
                partOriginalText = match[paramIndex];
                // Find the *actual* index of this group instance in the original string
                // starting from currentOriginalIndex to handle repeated captures correctly.
                const groupStartIndex = originalMatchText.indexOf(partOriginalText, currentOriginalIndex);

                if (groupStartIndex !== -1) {
                     partOriginalLength = partOriginalText.length;
                     // Advance currentOriginalIndex past this group instance
                     currentOriginalIndex = groupStartIndex + partOriginalLength;

                     // Add debug logging for dynamic part (successful match)
                     if (this.debug && this.outputChannel) {
                        this.outputChannel.appendLine(`Part '${part}' corresponds to original substring '${partOriginalText}' [${groupStartIndex}-${currentOriginalIndex}]`);
                    }
                 } else {
                     // Group not found (e.g., optional group that didn't match this time)
                     partOriginalLength = 0; // Represents no original text segment
                     // currentOriginalIndex remains unchanged
                      if (this.debug && this.outputChannel) {
                         this.outputChannel.appendLine(`Part '${part}' (group ${paramIndex}) did not find corresponding text starting from index ${currentOriginalIndex}. Original text: "${partOriginalText}"`);
                    }
                 }
            } else {
                // Invalid placeholder index or group didn't capture anything (undefined)
                partOriginalLength = 0; // Represents no original text segment
                 if (this.debug && this.outputChannel) {
                    this.outputChannel.appendLine(`Part '${part}' maps to invalid/unmatched group (Index ${paramIndex})`);
                }
            }

            // If it was $0, we only advance position, no decoration for $0 itself.
            // For $1, $2 etc., we also just advance position here. Decorations are handled for static parts.
            currentAbsolutePos += partOriginalLength;
            continue; // Move to the next part (whether $0 or $1, $2...)

        } else {
            // Static part of the pretty string
            const startPos = currentAbsolutePos; // Range for this static part starts here

            // Determine the segment of the original text this static part corresponds to.
            // It's the text between the end of the previous placeholder match
            // and the start of the next placeholder match.

            // Check if the PREVIOUS part processed was $0
            const previousPart = i > 0 ? prettyParts[i - 1] : null;
            const previousPartWasDollarZero = previousPart === '$0';

            if (previousPartWasDollarZero) {
                // If preceded by $0, this static part corresponds to a zero-length
                // segment *after* the full match in the original text.
                partOriginalLength = 0;
            } else {
                // Original logic needs refinement: Find the start of the *next* placeholder's
                // corresponding text in the original string.
                let nextPlaceholderOriginalStart = originalMatchText.length; // Default to end of full match

                // Find the next placeholder in prettyParts *after* the current static part
                for (let j = i + 1; j < prettyParts.length; j++) {
                    const nextPart = prettyParts[j];
                    const nextPlaceholderMatch = nextPart.match(/^\$(\d+)$/);
                    if (nextPlaceholderMatch) {
                        const nextParamIndex = parseInt(nextPlaceholderMatch[1], 10);
                        // Get the text of the next matched group ($0, $1, $2...)
                        let nextGroupText: string | undefined = undefined;
                         if (nextParamIndex < match.length && match[nextParamIndex] !== undefined) {
                             nextGroupText = match[nextParamIndex];
                         }

                         if (nextGroupText !== undefined) {
                             // Find where this *next* group's text starts in the original string,
                             // searching from the current original index.
                             const nextGroupStartIndex = originalMatchText.indexOf(nextGroupText, currentOriginalIndex);
                             if (nextGroupStartIndex !== -1) {
                                 nextPlaceholderOriginalStart = nextGroupStartIndex;
                                 break; // Found the start of the next relevant original segment
                             }
                             // If next group text not found (e.g. optional group not matched),
                             // continue searching subsequent placeholders in prettyParts.
                         }
                        // If placeholder index is invalid or group didn't match, continue search
                    }
                }

                // The original text corresponding to the static part is between
                // currentOriginalIndex and the start of the next placeholder's text.
                partOriginalLength = nextPlaceholderOriginalStart - currentOriginalIndex;
                partOriginalLength = Math.max(0, partOriginalLength); // Ensure not negative
            }

            // Create range for the original text segment being replaced/styled by this static part
             partOriginalText = originalMatchText.substring(currentOriginalIndex, currentOriginalIndex + partOriginalLength);
             const endPos = startPos + partOriginalLength; // End position based on original length
             const uglyRange = new vscode.Range(lineIdx, startPos, lineIdx, endPos);

             // Add debug logging for static part
             if (this.debug && this.outputChannel) {
                 this.outputChannel.appendLine(`Static Part '${part}' corresponds to original substring '${partOriginalText}' [${currentOriginalIndex}-${currentOriginalIndex + partOriginalLength}] -> Range [${startPos}-${endPos}]`);
            }

             // Create decorations for non-empty static parts, mapped to the calculated uglyRange
             // (which might be zero-width if partOriginalLength is 0).
             if (part) {
                 // Use cache for the decoration of this specific static part
                 const dynamicPartParams = {
                     ugly: configData.ugly, // Keep original regex for key context
                     pretty: part, // Key based on the static part
                     scope: configData.scope,
                     style: configData.style,
                 };
                 const key = this.getDecorationCacheKey(dynamicPartParams);
                 let cacheEntry = this.decorationCache.get(key);

                 if (!cacheEntry) {
                     const newDecoration = decorations.makePrettyDecoration_letterSpacing_hack({
                         ugly: partOriginalText, // Pass the original text segment for context if needed by decoration function
                         pretty: part,
                         scope: configData.scope,
                         style: configData.style,
                     });
                     cacheEntry = { decorationType: newDecoration, ranges: new Set(), pretty: part };
                     this.decorationCache.set(key, cacheEntry);
                 }

                 // Add the calculated uglyRange using the overlap handling logic
                 this.addOrUpdatePrettyRange(uglyRange, key);
             }

             // Update positions for the next iteration
              currentAbsolutePos += partOriginalLength; // Advance absolute position by the length of the *original* text this static part covers
              currentOriginalIndex += partOriginalLength; // Advance original index past the consumed segment
         }
    }
  }

  /**
  * @returns true if the decorations were invalidated/updated
  */
  public applyChanges(changes: { range: vscode.Range, text: string }[]): boolean {
    this.changedUglies = false; // assume no changes need to be made for now
    const sortedChanges =
      changes.sort((change1, change2) => change1.range.start.isAfter(change2.range.start) ? -1 : 1)
    let minAffectedLineInitial = Infinity;
    let maxAffectedLineInitial = -Infinity;
    let totalLinesDelta = 0;

    // First pass: Apply deltas and track initial affected range + total line delta
    for (const change of sortedChanges) {
        try {
            const delta = textUtil.toRangeDelta(change.range, change.text);

            minAffectedLineInitial = Math.min(minAffectedLineInitial, change.range.start.line);
            maxAffectedLineInitial = Math.max(maxAffectedLineInitial, change.range.end.line);

            // Shift *all* existing decoration ranges based on the current change's delta
            // Update ranges stored in the cache
            for (const cacheEntry of this.decorationCache.values()) {
                 cacheEntry.ranges = shiftRangeDeltaForSet(cacheEntry.ranges, delta);
            }
            // Update the separate hidden ranges set
            this.hiddeDecorationsRanges = shiftRangeDeltaForSet(this.hiddeDecorationsRanges, delta);

            totalLinesDelta += delta.linesDelta;

        } catch (e) {
            console.error("Error applying change delta:", e);
            this.recomputeDecorations(); // Fallback to full recompute on error
            return true; // Indicate that decorations might have changed due to fallback
        }
    }

    // ... (Second pass: Determine final affected range and reparse using clearDecorationsInLineRange and reparsePretties) ...
    // This part remains the same as the previous working version
    if (minAffectedLineInitial <= maxAffectedLineInitial) {
        const docLineCount = this.document.getLineCount();
        const finalMinLine = Math.max(0, minAffectedLineInitial);
        const estimatedFinalMaxLine = maxAffectedLineInitial + totalLinesDelta;
        const finalEndLine = Math.min(Math.max(0, docLineCount - 1), Math.max(estimatedFinalMaxLine, finalMinLine));

        if (finalMinLine <= finalEndLine) {
           this.clearDecorationsInLineRange(finalMinLine, finalEndLine);
           try {
                 const endLineLength = (finalEndLine >= 0 && finalEndLine < docLineCount)
                    ? this.document.getLine(finalEndLine).length
                    : 0;
                 const reparseRange = new vscode.Range(finalMinLine, 0, finalEndLine, endLineLength);
                 this.reparsePretties(reparseRange);
                 this.changedUglies = true;
             } catch (e) {
                 console.error("Error during incremental reparse:", e);
                 this.recomputeDecorations();
                 return true;
             }
        } else {
             this.changedUglies = false;
        }
    } else {
        this.changedUglies = false;
    }
    return this.changedUglies;
  }

  /** reparses the document and recreates the highlights for all editors */
  public recomputeDecorations() {
    // Clear existing ranges from cache entries and hidden ranges
    for(const entry of this.decorationCache.values()) {
        entry.ranges.clear();
    }
    this.hiddeDecorationsRanges.clear();
    this.grammarState = []; // Reset grammar state

    const docRange = new vscode.Range(0, 0, this.document.getLineCount(), 0);
    this.reparsePretties(docRange); // Repopulates ranges in the cache
  }

  private findSymbolAt(pos: vscode.Position, options: { excludeStart?: boolean, includeEnd?: boolean } = { excludeStart: false, includeEnd: false }): vscode.Range | undefined {
    for (const range of this.hiddeDecorationsRanges) {
      let contains = false;
      if (options.excludeStart && options.includeEnd) {
        contains = range.contains(pos) && !range.start.isEqual(pos);
      } else if (options.excludeStart) {
        contains = range.contains(pos) && !range.start.isEqual(pos) && !range.end.isEqual(pos);
      } else if (options.includeEnd) {
        contains = range.contains(pos) || range.end.isEqual(pos);
      } else {
        contains = range.contains(pos);
      }

      if (contains) {
        return range;
      }
    }
    return undefined;
  }

  private findSymbolsIn(range: vscode.Range): Set<vscode.Range> {
    const overlappingRanges = new Set<vscode.Range>();
    for (const hiddenRange of this.hiddeDecorationsRanges) {
      if (range.intersection(hiddenRange)) { // Check for intersection (overlap)
        overlappingRanges.add(hiddenRange);
      }
    }
    return overlappingRanges;
  }

  public getPrettySubstitutionsRanges(): vscode.Range[] {
    return Array.from(this.hiddeDecorationsRanges);
  }

  /**
   * Returns what the contents of the document would appear to be after decorations (i.e. with substitutions applied to the text)
   */
  public getDecoratedText(range: vscode.Range): string {
      range = this.document.validateRange(range);
      const originalText = this.document.getText(range);
      const substitutions: { start: number, end: number, subst: string, range: vscode.Range }[] = []

      // Get all *active* ranges (respecting overlaps) that intersect the target range
      const activeHiddenRanges = this.findSymbolsIn(range); // Use existing method that queries hiddeDecorationsRanges

      // Iterate through cached decorations to find the 'pretty' text for active ranges
      for (let cacheEntry of this.decorationCache.values()) {
          for (let sr of cacheEntry.ranges) {
              // Check if this specific range instance is actually active (present in hiddeDecorationsRanges)
              // and intersects the requested range.
              // Direct check against activeHiddenRanges (Set) is efficient.
              if (activeHiddenRanges.has(sr)) {
                  // Calculate relative offsets within the requested range's text
                  const start = textUtil.relativeOffsetAtAbsolutePosition(originalText, range.start, sr.start);
                  const end = textUtil.relativeOffsetAtAbsolutePosition(originalText, range.start, sr.end);

                  if (start !== -1 && end !== -1 && start < end) { // Ensure valid, non-empty range within the text
                      substitutions.push({ start: start, end: end, subst: cacheEntry.pretty, range: sr });
                  }
              }
          }
      }


      // Sort substitutions based on their original start position to apply them correctly
      // Apply substitutions on the overlapping *original* ranges first.
      // Reverse order ensures inner substitutions don't mess up outer indices.
      const sortedSubst = substitutions.sort((a, b) => b.range.start.compareTo(a.range.start)); // Sort by vscode.Range start pos, descending

      let result = originalText;
      let offset = 0; // Track change in length due to substitutions

      // Keep track of applied ranges to handle potential overlaps during application
      // Note: Overlap resolution *should* have happened in addOrUpdatePrettyRange,
      // but this provides a safety check during text reconstruction.
      const appliedOriginalRanges = new Set<vscode.Range>();

      for (let subst of sortedSubst) {
          // Check if this range (or a larger one containing it) has already been processed
          let alreadyProcessed = false;
          for(const applied of appliedOriginalRanges){
              if(applied.contains(subst.range)){
                  alreadyProcessed = true;
                  break;
              }
          }
          if(alreadyProcessed) continue;


          // Adjust start/end based on previous substitutions' offset
          const currentStart = subst.start; // Offsets calculated relative to originalText
          const currentEnd = subst.end;

           // Ensure indices are valid for the *current* state of the result string
           const adjustedStart = textUtil.relativeOffsetAtAbsolutePosition(result, range.start, subst.range.start);
           const adjustedEnd = textUtil.relativeOffsetAtAbsolutePosition(result, range.start, subst.range.end);


           // Check indices against the *current* result length
           if (adjustedStart !== -1 && adjustedEnd !== -1 && adjustedStart <= adjustedEnd && adjustedEnd <= result.length) {
               result = result.slice(0, adjustedStart) + subst.subst + result.slice(adjustedEnd);
               // Mark this original range as applied
               appliedOriginalRanges.add(subst.range);

           } else {
               console.warn(`Invalid substitution range in getDecoratedText after adjustments: ${adjustedStart}-${adjustedEnd} for text length ${result.length}. Original was ${currentStart}-${currentEnd}. Range: ${subst.range.start.line}:${subst.range.start.character}-${subst.range.end.line}:${subst.range.end.character}`);
           }
      }

      return result;
  }

  public revealSelections(selections: vscode.Selection[]): UpdateDecorationEntry {
    const revealUgly = (getRange: (sel: vscode.Selection) => vscode.Range | undefined): UpdateDecorationEntry => {
      const cursorRevealedRanges = new Set<vscode.Range>();
      for (const selection of selections) {
        const ugly = getRange(selection);
        if (ugly)
          cursorRevealedRanges.add(ugly);
      }
      // reveal the uglies and hide the pretties
      return {
        decoration: this.revealedUglyDecoration || vscode.window.createTextEditorDecorationType({}),
        ranges: Array.from(cursorRevealedRanges)
      };
    }
    const revealUglies = (getRanges: (sel: vscode.Selection) => Set<vscode.Range>): UpdateDecorationEntry => {
      const cursorRevealedRanges = new Set<vscode.Range>();
      for (const selection of selections) {
        const uglySet = getRanges(selection);
        if (uglySet) {
          for (const uglyRange of uglySet) {
            cursorRevealedRanges.add(uglyRange);
          }
        }
      }
      // reveal the uglies and hide the pretties
      return {
        decoration: this.revealedUglyDecoration || vscode.window.createTextEditorDecorationType({}),
        ranges: Array.from(cursorRevealedRanges)
      };
    }

    // add the new intersections
    switch (this.revealStrategy) {
      case 'cursor':
        return revealUgly((sel) => this.findSymbolAt(sel.active, { includeEnd: true }));
      case 'cursor-inside':
        return revealUgly((sel) => this.findSymbolAt(sel.active, { excludeStart: true }));
      case 'active-line':
        return revealUglies((sel) => this.findSymbolsIn(this.document.getLineRange(sel.active.line)));
      case 'selection':
        return revealUglies((sel) => this.findSymbolsIn(new vscode.Range(sel.start, sel.end)));
      default:
        return {
          decoration: this.revealedUglyDecoration || vscode.window.createTextEditorDecorationType({}),
          ranges: []
        };
    }
  }

  public renderPrettyCursor(selections: vscode.Selection[]): UpdateDecorationInstanceEntry | null {
    switch (this.prettyCursor) {
      case 'boxed': {
        const boxPretty = (getRange: (sel: vscode.Selection) => vscode.Range | undefined): UpdateDecorationInstanceEntry | null => {
          try {
            const cursorBoxRanges = new Set<vscode.Range>();
            for (const selection of selections) {
              const pretty = getRange(selection);
              if (pretty)
                cursorBoxRanges.add(pretty);
            }
            // reveal the uglies and hide the pretties
            return {
              decoration: this.boxedSymbolDecoration || {},
              ranges: cursorBoxRanges
            };
          } catch (err) {
            console.error(err);
            console.error('\n');
            return null;
          }
        }
        return boxPretty((sel) => this.findSymbolAt(sel.active));
      }
      default:
        return null;
    }
  }

  /** Helper to clear decoration ranges within a line range */
  private clearDecorationsInLineRange(startLine: number, endLine: number): void {
    // Clear from the primary source of truth
    this.hiddeDecorationsRanges = new Set(
      [...this.hiddeDecorationsRanges].filter(r => r.start.line < startLine || r.start.line > endLine)
    );

    // Also clear corresponding ranges from cache entries
    for (const cacheEntry of this.decorationCache.values()) {
      cacheEntry.ranges = new Set(
        [...cacheEntry.ranges].filter(r => r.start.line < startLine || r.start.line > endLine)
      );
      // Optional: Clean up cache entries with no ranges left?
      // if (cacheEntry.ranges.size === 0) {
      //   this.decorationCache.delete(key); // Need key here, maybe iterate keys()
      // }
    }
  }
}
