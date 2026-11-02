import type { LanguageEntry } from './type';
import { getRoot } from '../store';

/** Substitutions registered programmatically via the public API. */
export const getAdditionalSubstitutions = (): Set<LanguageEntry> => getRoot().additionalSubstitutions;
