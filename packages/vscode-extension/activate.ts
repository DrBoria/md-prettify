/**
 * Extension entry point — the file that VS Code loads (package.json "main").
 *
 * This is the ONLY place where the DevtoolServer is constructed and started.
 * Everything else is delegated to the backend via the Host interface.
 */
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { DevtoolServer } from 'vscode-extension-devtool-mcp';
import type { DevtoolBridgeProvider, HostIdentity } from 'vscode-extension-devtool-mcp';
import { createHost } from './host-adapter';
import { registerCommands } from './commands';
import { registerListeners } from './listeners';
import { activate as backendActivate, deactivate as backendDeactivate, createRootStore } from '../../apps/backend/index';
import type { mdPrettify } from '../../apps/backend/config/api';
import type { RootStore } from '../../apps/backend/store';

// The root store lives for the extension's lifetime; deactivate needs it.
const rootRef = { current: undefined as RootStore | undefined };

// Devtool MCP server provider. md-prettify has no webview, so the
// DOM-related provider methods are no-ops.
const devtoolProvider: DevtoolBridgeProvider = {
  findElement: () => Promise.resolve('not available: md-prettify has no webview'),
  getActivePage: () => undefined,
  setActivePageRequestCallback: () => undefined,
  setDomRequestCallback: () => undefined,
  postMessageToWebview: () => undefined,
  getModes: () => [],
  getMode: () => '',
  executeCommand: async (command: string, args?: unknown) => {
    await vscode.commands.executeCommand(command, args);
  },
  getExtensionVersion: () => {
    try {
      const pkgPath = path.join(__dirname, '..', '..', 'package.json');
      return JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version as string | undefined;
    } catch {
      return undefined;
    }
  },
};

const devtoolIdentity: HostIdentity = {
  getWorkspaceFolder: () => vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
  getFocused: () => vscode.window.state.focused,
};

export function activate(context: vscode.ExtensionContext): mdPrettify {
  rootRef.current = createRootStore();
  const host = createHost();

  // Create output channel via the host
  const outputChannel = host.createOutputChannel('MD Prettify Debug');
  context.subscriptions.push(outputChannel);

  // Devtool MCP server — starts the WS (60060) + HTTP status (60061) transports.
  const devtool = new DevtoolServer(
    { provider: devtoolProvider },
    undefined,
    60060,
    undefined,
    60061,
    devtoolIdentity,
  );
  devtool.start().then(
    function () {
      outputChannel.appendLine('[devtool] started on ws:60060 / http:60061');
    },
    function (err) {
      outputChannel.appendLine(`[devtool] failed to start: ${err}`);
    },
  );

  // Register commands and listeners
  context.subscriptions.push(...registerCommands(host));
  context.subscriptions.push(...registerListeners(host));

  // Activate the backend
  return backendActivate(host);
}

export function deactivate(): void {
  if (rootRef.current) backendDeactivate();
  DevtoolServer.stopGlobalInstance().catch(function () {
    return undefined;
  });
}
