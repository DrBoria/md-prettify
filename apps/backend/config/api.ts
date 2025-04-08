import type { Disposable } from '../host';
import type { LanguageEntry } from './configuration';

/**
 * The public API surface exposed by the extension (see the `mdPrettify`
 * activation return value). The `LanguageEntry` type is the canonical one
 * from `./configuration` — it is a superset of what third-party extensions
 * need, so no separate (narrower) copy is kept here.
 */
export interface mdPrettify {
  /** Register a handler to receive notifications when PSM is enabled or disabled.
   * @returns a disposable object to unregister the handler
   */
  onDidEnabledChange: (handler: (enabled: boolean) => void) => Disposable,
  /** Query whether PSM is "enabled" - this refers to the user's ability to
   * temporarily enable/disable the mode for an instance of the IDE.
   * @returns `true` iff PSM is currently enabled
   */
  isEnabled: () => boolean,
  /** Temporarily add more substitutions.
   * @returns a disposable object to remove the provided substitutions
   */
  registerSubstitutions: (substitutions: LanguageEntry) => Disposable,
}
