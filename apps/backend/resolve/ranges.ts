import type { Range, Host, DecorationRenderOptions } from '../host';
import { DecorationRangeBehavior } from '../host';
import type { Substitution } from '../config/configuration';
import { assignStyleProperties } from '../config/configuration';
import type { DecorationKeyParams } from '../document/type';
import type { DocumentStore } from '../document/type';
import { getDecorationCacheKey, addOrUpdatePrettyRange } from './cache';

export function makePrettyDecorationLetterSpacingHack(host: Host, prettySubst: Substitution) {
  // const showAttachmentStyling = '; font-size: 10em; letter-spacing: normal; visibility: visible';
  const showAttachmentStyling = 'letter-spacing: normal; visibility: visible;';

  let styling: DecorationRenderOptions = {
    after: {},
    dark: { after: {} },
    light: { after: {} },
    rangeBehavior: DecorationRangeBehavior.ClosedClosed,
  };

  if (prettySubst.style) {
    styling.after = assignStyleProperties(styling.after, prettySubst.style);
    if (prettySubst.style.dark)
      styling.dark.after = assignStyleProperties(styling.dark.after, prettySubst.style.dark);
    if (prettySubst.style.light)
      styling.light.after = assignStyleProperties(styling.light.after, prettySubst.style.light);
  }
  styling.after.contentText = prettySubst.pretty;

  // Use a dirty hack to change the font size (code injection)
  styling.after.textDecoration = showAttachmentStyling + (styling.after.textDecoration || 'none;');
  // and make sure the user's textDecoration does not break our hack
  if (styling.light.after.textDecoration)
    styling.light.after.textDecoration = showAttachmentStyling + styling.light.after.textDecoration;
  if (styling.dark.after.textDecoration)
    styling.dark.after.textDecoration = showAttachmentStyling + styling.dark.after.textDecoration;

  return host.createDecorationType(styling);
}

export function makePrettyDecorationNoPretty(host: Host, prettySubst: Substitution) {
  let styling: DecorationRenderOptions = {
    dark: {},
    light: {},
    rangeBehavior: DecorationRangeBehavior.ClosedClosed,
  };
  if (prettySubst.style) {
    styling = assignStyleProperties(styling, prettySubst.style);
    if (prettySubst.style.dark)
      styling.dark = assignStyleProperties(styling.dark, prettySubst.style.dark);
    if (prettySubst.style.light)
      styling.light = assignStyleProperties(styling.light, prettySubst.style.light);
  }

  return host.createDecorationType(styling);
}

export function makeDecorationsFontSizeHack(host: Host) {
  return {
    uglyDecoration: host.createDecorationType({
      textDecoration: 'none; font-size: 0.001em',
      rangeBehavior: DecorationRangeBehavior.ClosedClosed,
    }),
    revealedUglyDecoration: host.createDecorationType({
      textDecoration: 'none; font-size: inherit !important',
      rangeBehavior: DecorationRangeBehavior.ClosedClosed,
      after: {
        textDecoration: 'none; font-size: 0pt',
      }
    }),
    boxedSymbolDecoration: {
      rangeBehavior: DecorationRangeBehavior.ClosedClosed,
      after: {
        border: '0.1em solid',
        margin: '-0em -0.05em -0em -0.1em',
      }
    },
  }
}

export function makeDecorationsLetterSpacingHack(host: Host) {
  return {
    uglyDecoration: host.createDecorationType({
      letterSpacing: "-0.55em; font-size: 0.1em; visibility: hidden",
      rangeBehavior: DecorationRangeBehavior.ClosedClosed,
    }),
    revealedUglyDecoration: host.createDecorationType({
      letterSpacing: "normal !important; font-size: inherit !important; visibility: visible !important",
      rangeBehavior: DecorationRangeBehavior.ClosedClosed,
      after: {
        // letterSpacing: '-0.55em; font-size: 0.1pt; visibility: hidden',
        textDecoration: 'none !important; font-size: 0.1pt !important; visibility: hidden',
      }
    }),
    boxedSymbolDecoration: {
      rangeBehavior: DecorationRangeBehavior.ClosedClosed,
      after: {
        border: '0.1em solid',
        margin: '-0em -0.05em -0em -0.1em',
      }
    },
  }
}

export function makeDecorationsNone(host: Host) {
  return {
    uglyDecoration: host.createDecorationType({
      rangeBehavior: DecorationRangeBehavior.ClosedClosed,
    }),
    revealedUglyDecoration: host.createDecorationType({
      textDecoration: 'none; font-size: inherit !important',
      rangeBehavior: DecorationRangeBehavior.ClosedClosed,
      after: {
        textDecoration: 'none; font-size: 0pt',
      }
    }),
    boxedSymbolDecoration: {
      rangeBehavior: DecorationRangeBehavior.ClosedClosed,
      after: {
        border: '0.1em solid',
        margin: '-0em -0.05em -0em -0.1em',
      }
    },
  }

}

/**
 * Creates the cache entry (and decoration) for a resolved pretty text if missing,
 * ensuring the priority is set, and adds the range with overlap handling.
 */
export const addResolvedRange = (
  state: DocumentStore,
  params: DecorationKeyParams,
  uglyContext: string,
  resolvedPretty: string,
  rulePriority: number,
  uglyRange: Range,
): void => {
  const key = getDecorationCacheKey(params);
  let cacheEntry = state.decorationCache.get(key);

  if (!cacheEntry) {
    const newDecoration = makePrettyDecorationLetterSpacingHack(state.host, {
      ugly: uglyContext,
      pretty: resolvedPretty,
      scope: params.scope,
      style: params.style,
    });
    cacheEntry = { decorationType: newDecoration, ranges: new Set(), pretty: resolvedPretty, priority: rulePriority };
    state.decorationCache.set(key, cacheEntry);
  } else if (cacheEntry.priority === undefined) {
    // Set the priority if it has not been determined yet
    cacheEntry.priority = rulePriority;
  }

  addOrUpdatePrettyRange(state, uglyRange, key);
};