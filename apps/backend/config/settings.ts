import type { Host, OutputChannel } from '../host';
import type { LanguageEntry, Settings } from './configuration';
import { configureLogger, logError, logInfo } from './logger';
import { requireRootStore } from '../store';
import { createRegistryAction } from '../grammar/store';
import {
  openDocument,
  setTextMateRegistry,
  unloadAllDocuments,
} from '../document/manager';
import { createGrammarLocator } from './grammar-locator';
import { applyDefaultsToEntry } from './language-entry';
export { unloadAllDocuments } from '../document/manager';
/** Raw `mdPrettify` host configuration: the (all-optional) `Settings` fields
 *  plus the predefined configurations map that only the raw config carries. */
interface MdPrettifyConfiguration extends Settings {
  predefinedConfigurations?: { [key: string]: LanguageEntry };
}

const logOpenDocumentError = (err: unknown): void => logError('openDocument:', err);

export function setHost(host: Host): void {
  requireRootStore().host = host;
}

export function getHost(): Host | undefined {
  return requireRootStore().host;
}

export function getOutputChannel(): OutputChannel {
  return requireRootStore().outputChannel;
}

export function getSettings(): Settings {
  return requireRootStore().settings;
}

/** Re-initialize the TextMate registry from the host's grammar locator. */
const reloadTextMateRegistry = (): void => {
  const root = requireRootStore();
  try {
    logInfo('Initializing TextMate registry');
    root.loadedGrammars.clear();
    const registry = createRegistryAction(root.grammar, createGrammarLocator());
    setTextMateRegistry(registry ?? undefined);
    if (!registry) logError('Failed to initialize TextMate registry');
  } catch (err) {
    setTextMateRegistry(undefined);
    logError('Error initializing TextMate registry:', err);
  }
};

/** Store the raw host configuration on the root store as `Settings`. */
const storeSettings = (configuration: MdPrettifyConfiguration): void => {
  requireRootStore().settings = {
    substitutions: configuration.substitutions ?? [],
    revealOn: configuration.revealOn ?? 'cursor',
    adjustCursorMovement: configuration.adjustCursorMovement ?? false,
    prettyCursor: configuration.prettyCursor ?? 'boxed',
    hideTextMethod: configuration.hideTextMethod ?? 'hack-letterSpacing',
    predefinedConfig: configuration.predefinedConfig ?? '',
    debug: configuration.debug ?? false,
  };
};

/** Load predefined configurations from settings.json onto the root store. */
const loadPredefinedConfigurations = (configuration: MdPrettifyConfiguration): void => {
  requireRootStore().predefined.clear();
  const predefinedConfigurations = configuration.predefinedConfigurations ?? {};
  for (const key of Object.keys(predefinedConfigurations)) {
    const entry = predefinedConfigurations[key];
    requireRootStore().predefined.set(key, entry);
    requireRootStore().predefinedConfigs.set(key, { substitutions: entry.substitutions ?? [], settings: entry });
    logInfo(`Loaded predefined config: ${key}`);
  }
};

/** Apply defaults to language properties not specified in the user's substitutions. */
const applyLanguageDefaults = (): void => {
  for (const language of requireRootStore().settings.substitutions ?? []) {
    applyDefaultsToEntry(language);
  }
};

/** Recreate all documents from the host's open text documents. */
const reopenDocuments = (): void => {
  unloadAllDocuments();
  for (const doc of requireRootStore().host?.textDocuments ?? []) {
    logInfo(`Opening document ${doc.fileName}`);
    void openDocument(doc).catch(logOpenDocumentError);
  }
};

/** Re-read the settings and recreate substitutions for all documents. */
export function reloadConfiguration(): void {
  reloadTextMateRegistry();
  const configuration = (requireRootStore().host?.getConfiguration('mdPrettify') ?? {}) as MdPrettifyConfiguration;
  storeSettings(configuration);
  loadPredefinedConfigurations(configuration);
  applyLanguageDefaults();
  reopenDocuments();
}

/** Configure the output channel + logger; called by the adapter at activation. */
export function initialize(host: Host): void {
  setHost(host);
  requireRootStore().outputChannel = host.createOutputChannel('MD Prettify Debug');
  configureLogger(requireRootStore().outputChannel);
  reloadConfiguration();
}

