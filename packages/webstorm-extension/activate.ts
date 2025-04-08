/**
 * Extension entry point — the file that WebStorm loads (plugin "main").
 *
 * This is the ONLY place where the DevtoolServer is constructed and started.
 * Everything else is delegated to the backend via the Host interface.
 */
import * as webstorm from 'webstorm';
import * as path from 'path';
import * as fs from 'fs';
import { DevtoolServer } from 'vscode-extension-devtool-mcp';
import { createHost } from './host-adapter';
import { registerCommands } from './commands';
import { registerListeners } from './listeners';
import { activate as backendActivate, deactivate as backendDeactivate, createRootStore } from '../../apps/backend/index';
import type { mdPrettify } from '../../apps/backend/config/api';
import type { RootStore } from '../../apps/backend/store';

// The root store lives for the extension's lifetime; deactivate needs it.
const rootRef = { current: undefined as RootStore | undefined };

export const activate = (context: webstorm.ExtensionContext): mdPrettify => {
  rootRef.current = createRootStore();
  const host = createHost();

  // Create output channel via the host
  const outputChannel = host.createOutputChannel('MD Prettify Debug');
  context.subscriptions.push(outputChannel);

  // Devtool MCP server — starts the WS (60060) + HTTP status (60061) transports.
  // md-prettify has no webview, so the DOM-related provider methods are no-ops.
  const devtool = new DevtoolServer(
    {
      provider: {
        findElement: () => Promise.resolve('not available: md-prettify has no webview'),
        getActivePage: () => undefined,
        setActivePageRequestCallback: () => undefined,
        setDomRequestCallback: () => undefined,
        postMessageToWebview: () => undefined,
        getModes: () => [],
        getMode: () => '',
        executeCommand: (command: string, args?: unknown) =>
          webstorm.commands.executeCommand(command, args),
        getExtensionVersion: () => {
          try {
            const pkgPath = path.join(__dirname, '..', '..', 'package.json');
            return JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version as string | undefined;
          } catch {
            return undefined;
          }
        },
      },
    },
    undefined,
    60060,
    undefined,
    60061,
    {
      getWorkspaceFolder: () => webstorm.workspace.workspaceFolders?.[0]?.uri.fsPath,
      getFocused: () => webstorm.window.state.focused,
    },
  );
  devtool.start().then(
    () => outputChannel.appendLine('[devtool] started on ws:60060 / http:60061'),
    (err) => outputChannel.appendLine(`[devtool] failed to start: ${err}`),
  );

  // Register commands and listeners
  context.subscriptions.push(...registerCommands(host));
  context.subscriptions.push(...registerListeners(host));

  // Activate the backend
  return backendActivate(host);
};

export const deactivate = (): void => {
  if (rootRef.current) backendDeactivate();
  DevtoolServer.stopGlobalInstance().catch(() => undefined);
};
