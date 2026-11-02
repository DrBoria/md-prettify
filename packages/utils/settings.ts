import type { LanguageEntry, PrettyCursor, UglyRevelation } from '@md-prettify/types';

/** The settings the backend stores on the root store (`Settings`). */
export interface Settings {
  substitutions?: LanguageEntry[];
  adjustCursorMovement?: boolean;
  revealOn?: UglyRevelation;
  prettyCursor?: PrettyCursor;
  hideTextMethod?: 'hack-fontSize' | 'hack-letterSpacing' | 'none';
  predefinedConfig?: string;
  debug?: boolean;
}

/** The raw `mdPrettify` configuration as read from the host: every `Settings`
 *  field is optional, plus the predefined configurations map. */
export interface RawConfiguration extends Settings {
  predefinedConfigurations?: { [key: string]: LanguageEntry };
}

/** Builds the `Settings` stored on the root store, filling in the defaults. */
export const settingsFromConfiguration = (configuration: RawConfiguration): Settings => ({
  substitutions: configuration.substitutions ?? [],
  revealOn: configuration.revealOn ?? 'cursor',
  adjustCursorMovement: configuration.adjustCursorMovement ?? false,
  prettyCursor: configuration.prettyCursor ?? 'boxed',
  hideTextMethod: configuration.hideTextMethod ?? 'hack-letterSpacing',
  predefinedConfig: configuration.predefinedConfig ?? '',
  debug: configuration.debug ?? false,
});
