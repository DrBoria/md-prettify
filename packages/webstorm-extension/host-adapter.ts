/**
 * The WebStorm Host adapter — the `Host` implementation for WebStorm.
 *
 * This is the ONLY file in the project that imports `webstorm` alongside the
 * backend (besides activate.ts and the commands/listeners files). The pure
 * type conversions live in `webstorm.ts`; the `onDid*` event adapters live in
 * `listeners.ts` and the command adapter in `commands.ts`. This file composes
 * those parts into the `Host` object and keeps the document/editor accessors,
 * the TextMate grammar discovery and the decoration/clipboard/output-channel
 * adapters.
 */
import * as webstorm from 'webstorm';
import type {
  Host,
  TextDocument,
  TextEditor,
  DecorationRenderOptions,
  TextEditorDecorationType,
} from '../../apps/backend/host';
import {
  toHostTextDocument,
  toHostTextEditor,
  toWebstormDecorationOptions,
} from './webstorm';
import { createHostEvents } from './listeners';
import { registerHostCommand } from './commands';

// Per-extension TextMate grammar discovery helpers (see the getGrammar* /
// getLanguageScopeName methods in createHost below).
const findLanguageGrammarPath = (
  ext: webstorm.Extension,
  languageScopeName: string,
): string | null => {
  // languages contribution: the scope often matches "source.<languageId>"
  const languages = ext.packageJSON?.contributes?.languages ?? [];
  for (const lang of languages) {
    if (lang.grammarPath && lang.id && languageScopeName === `source.${lang.id}`) {
      return webstorm.Uri.joinPath(ext.extensionUri, lang.grammarPath).fsPath;
    }
  }
  return null;
};

const findScopedGrammarPath = (
  ext: webstorm.Extension,
  languageScopeName: string,
): string | null => {
  // grammars contribution: match the scope name directly
  const grammars = ext.packageJSON?.contributes?.grammars ?? [];
  for (const grammar of grammars) {
    if (grammar.scopeName === languageScopeName && grammar.path) {
      return webstorm.Uri.joinPath(ext.extensionUri, grammar.path).fsPath;
    }
  }
  return null;
};

const findFallbackGrammarPath = (
  ext: webstorm.Extension,
  languageId: string,
): string | null => {
  const grammars = ext.packageJSON?.contributes?.grammars ?? [];
  for (const grammar of grammars) {
    if (grammar.language === languageId && grammar.path) {
      return webstorm.Uri.joinPath(ext.extensionUri, grammar.path).fsPath;
    }
  }
  return null;
};

const collectInjectionsFromExt = (
  ext: webstorm.Extension,
  languageScopeName: string,
): { scopeName: string; path: string }[] => {
  const found: { scopeName: string; path: string }[] = [];
  const grammars = ext.packageJSON?.contributes?.grammars ?? [];
  for (const grammar of grammars) {
    if (grammar.injectionSelector && grammar.path) {
      found.push({
        scopeName: grammar.scopeName ?? languageScopeName,
        path: webstorm.Uri.joinPath(ext.extensionUri, grammar.path).fsPath,
      });
    }
  }
  return found;
};

const findLanguageScopeInExt = (
  ext: webstorm.Extension,
  languageId: string,
): string | null => {
  // Convention: "source.<languageId>" is the most common scope pattern.
  const languages = ext.packageJSON?.contributes?.languages ?? [];
  for (const lang of languages) {
    if (lang.id === languageId && lang.grammarPath) return `source.${languageId}`;
  }
  return null;
};

const findGrammarScopeInExt = (
  ext: webstorm.Extension,
  languageId: string,
): string | null => {
  // Some built-in grammars are contributed without a grammarPath on the
  // language entry (e.g. markdown-basics); trust the grammars contribution.
  const grammars = ext.packageJSON?.contributes?.grammars ?? [];
  for (const grammar of grammars) {
    if (grammar.language === languageId && grammar.scopeName) return grammar.scopeName;
  }
  return null;
};

export const createHost = (): Host => {
  const decorationMap = new Map<string, webstorm.TextEditorDecorationType>();
  let decorationKeyCounter = 0;
  const events = createHostEvents(decorationMap);

  return {
    registerCommand: (id, handler) => registerHostCommand(id, handler),

    get textDocuments(): TextDocument[] {
      return webstorm.workspace.textDocuments.map(toHostTextDocument);
    },

    get visibleTextEditors(): TextEditor[] {
      return webstorm.window.visibleTextEditors.map((e) =>
        toHostTextEditor(e, decorationMap),
      );
    },

    get activeTextEditor(): TextEditor | null {
      const editor = webstorm.window.activeTextEditor;
      return editor ? toHostTextEditor(editor, decorationMap) : null;
    },

    getConfiguration(section: string): unknown {
      return webstorm.workspace.getConfiguration(section);
    },

    matchLanguage(language: string | string[], document: TextDocument): number {
      // The backend's TextDocument doesn't carry the webstorm Uri — rebuild a
      // minimal webstorm document just for the match.
      const fake = {
        languageId: document.languageId,
        uri: webstorm.Uri.parse(document.uri),
      } as webstorm.TextDocument;
      return webstorm.languages.match(language, fake);
    },

    // Scan installed plugins for a TextMate grammar matching the scope.
    getGrammarFilePath(languageScopeName: string): string | null {
      for (const ext of webstorm.extensions.all) {
        const path = findLanguageGrammarPath(ext, languageScopeName);
        if (path) return path;
        const scoped = findScopedGrammarPath(ext, languageScopeName);
        if (scoped) return scoped;
      }

      // Fallback: the requested scope is a "source.<languageId>" convention that
      // no grammar actually declares (e.g. markdown's real scope is
      // "text.html.markdown"). Resolve it by matching the grammar whose
      // `language` contribution equals the id.
      const languageId = languageScopeName.startsWith('source.')
        ? languageScopeName.slice('source.'.length)
        : null;
      if (languageId) {
        for (const ext of webstorm.extensions.all) {
          const path = findFallbackGrammarPath(ext, languageId);
          if (path) return path;
        }
      }

      return null;
    },

    getGrammarInjections(languageScopeName: string): { scopeName: string; path: string }[] {
      const injections: { scopeName: string; path: string }[] = [];
      for (const ext of webstorm.extensions.all) {
        injections.push(...collectInjectionsFromExt(ext, languageScopeName));
      }
      return injections;
    },

    getLanguageScopeName(languageId: string): string | null {
      // Convention first: "source.<languageId>", checked across all
      // extensions before trusting the grammars contribution.
      for (const ext of webstorm.extensions.all) {
        const scope = findLanguageScopeInExt(ext, languageId);
        if (scope) return scope;
      }
      for (const ext of webstorm.extensions.all) {
        const grammarScope = findGrammarScopeInExt(ext, languageId);
        if (grammarScope) return grammarScope;
      }
      return null;
    },

    async copyToClipboard(text: string): Promise<void> {
      await webstorm.env.clipboard.writeText(text);
    },

    createDecorationType(options: DecorationRenderOptions): TextEditorDecorationType {
      const key = `decoration-${++decorationKeyCounter}`;
      const real = webstorm.window.createTextEditorDecorationType(
        toWebstormDecorationOptions(options),
      );
      decorationMap.set(key, real);
      return {
        key,
        options,
        dispose: () => {
          real.dispose();
          decorationMap.delete(key);
        },
      };
    },

    createOutputChannel(name: string): { appendLine(value: string): void; dispose(): void } {
      const channel = webstorm.window.createOutputChannel(name);
      return {
        appendLine: (value: string) => channel.appendLine(value),
        dispose: () => channel.dispose(),
      };
    },

    ...events,
  };
};
