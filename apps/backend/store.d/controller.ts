/**
 * The config feature's controller: the store accessors and the read of the
 * host configuration. Writing the settings and recreating documents is the
 * document feature's actions.
 */
import type { Host, ITextMateRegistry, OutputChannel } from '../host';
import type { RawConfiguration, Settings } from './type';
import type { LanguageEntryContext } from '@md-prettify/utils';
import { applyDefaultsToEntry, settingsFromConfiguration } from '@md-prettify/utils';
import { getRoot } from '../store';
import { createRegistryAction } from '../grammar/store';
import { createGrammarLocatorAction } from '../grammar/locator';
import { openDocumentAction, unloadAllDocumentsAction } from '../document/actions/manage-documents';

/** The IDE host the backend talks to. */
export const getHost = (): Host | undefined => getRoot().host;

/** The debug output channel (undefined before the host is attached). */
export const getOutputChannel = (): OutputChannel => getRoot().outputChannel;

/** The settings currently stored on the root store. */
export const getSettings = (): Settings => getRoot().settings;

/** The store state the pure language-entry helpers read from. */
const entryContext = (): LanguageEntryContext => {
  const root = getRoot();
  return {
    substitutions: root.settings.substitutions,
    revealOn: root.settings.revealOn,
    adjustCursorMovement: root.settings.adjustCursorMovement,
    prettyCursor: root.settings.prettyCursor,
    predefinedConfig: root.settings.predefinedConfig,
    predefined: root.predefined,
    additionalSubstitutions: root.additionalSubstitutions,
    matchLanguage: (language, doc) => root.host?.matchLanguage(language, doc) ?? 0,
    logInfo: console.info,
  };
};

/** Reads the raw `mdPrettify` configuration from the host. */
const readConfiguration = (host: Host | undefined): RawConfiguration =>
  (host?.getConfiguration('mdPrettify') ?? {}) as RawConfiguration;

/** Rebuilds the TextMate registry over the host's grammar locator. */
const rebuildRegistry = (): ITextMateRegistry | undefined => {
  const root = getRoot();
  root.loadedGrammars.clear();
  const registry = createRegistryAction(root.grammar, createGrammarLocatorAction());
  root.textMateRegistry = registry ?? undefined;
  if (!registry) console.error('Failed to initialize TextMate registry');
  return registry ?? undefined;
};

/** Stores the predefined configurations the raw configuration declares. */
const storePredefinedConfigs = (configuration: RawConfiguration): void => {
  const root = getRoot();
  root.predefined.clear();
  for (const [key, entry] of Object.entries(configuration.predefinedConfigurations ?? {})) {
    root.predefined.set(key, entry);
    root.predefinedConfigs.set(key, { substitutions: entry.substitutions ?? [], settings: entry });
  }
};

/** Re-read the settings and recreate substitutions for all documents. */
export const reloadConfiguration = (): void => {
  const root = getRoot();
  rebuildRegistry();
  const configuration = readConfiguration(root.host);
  root.settings = settingsFromConfiguration(configuration);
  storePredefinedConfigs(configuration);
  for (const language of root.settings.substitutions ?? []) applyDefaultsToEntry(language, entryContext());
  unloadAllDocumentsAction(root);
  for (const doc of root.host?.textDocuments ?? []) void openDocumentAction(root, doc);
};

/** Activates the config feature: stores the host, then reads the settings. */
export const initialize = (host: Host): void => {
  const root = getRoot();
  root.host = host;
  root.outputChannel = host.createOutputChannel('MD Prettify Debug');
  reloadConfiguration();
};
