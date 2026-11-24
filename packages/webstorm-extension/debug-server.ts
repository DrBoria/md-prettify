/**
 * The devtool MCP lifecycle for the WebStorm adapter: the server is created on
 * activation and handed back, so the activation owns the stop and this module keeps
 * no state of its own.
 *
 * It is the real `vscode-extension-devtool-mcp` package: it publishes this window to
 * the shared target registry and serves the agent over a WebSocket plus an HTTP
 * status endpoint, so an MCP client finds the extension without being told a port.
 */
import * as webstorm from 'webstorm';
import * as path from 'path';
import * as fs from 'fs';
import { DevtoolServer, diagnosticsManager } from 'vscode-extension-devtool-mcp';
import type { DevtoolBridgeProvider } from 'vscode-extension-devtool-mcp';

/**
 * bridgeLogs: forwards every console call of this host into the devtool diagnostics
 * buffer, which is what the `get_logs` / `get_console` tools read — a shipped build
 * has no such bridge, and a failing activation otherwise only reaches log files.
 *
 * @returns {void} nothing — the bridge stays installed for the life of the host
 */
export function bridgeLogs(): void {
	diagnosticsManager.registerConsoleInterceptor();
	console.info('[md-prettify] devtool log bridge installed');
}

/**
 * startDevtool: starts the WebSocket MCP transport and the HTTP status endpoint and
 * returns the server itself, because only the activation knows when this window is
 * gone and a module-level handle would outlive it.
 *
 * @param {{ appendLine(value: string): void }} outputChannel the channel that reports the start outcome
 * @returns {DevtoolServer} the running server, to be stopped when the window closes
 */
export function startDevtool(outputChannel: { appendLine(value: string): void }): DevtoolServer {
	const provider: DevtoolBridgeProvider = {
		// md-prettify has no webview: the DOM tools answer that instead of waiting.
		hasFrontend: false,
		findElement: () => Promise.resolve('not available: md-prettify has no webview'),
		getActivePage: () => undefined,
		setActivePageRequestCallback: () => undefined,
		setDomRequestCallback: () => undefined,
		postMessageToWebview: () => undefined,
		getModes: () => [],
		getMode: () => '',
		executeCommand: async (command: string, args?: unknown) => {
			await webstorm.commands.executeCommand(command, args);
		},
		getExtensionVersion: () => {
			try {
				const packagePath = path.join(__dirname, '..', '..', '..', 'package.json');

				return JSON.parse(fs.readFileSync(packagePath, 'utf8')).version as string | undefined;
			} catch {
				return undefined;
			}
		},
	};
	const identity = {
		getWorkspaceFolder: () => webstorm.workspace.workspaceFolders?.[0]?.uri.fsPath,
		getFocused: () => webstorm.window.state.focused,
	};
	const server = DevtoolServer.create({
		provider,
		identity,
		target: { label: 'md-prettify', kind: 'vscode-extension' },
	});
	void server.start().then(
		(address) =>
			outputChannel.appendLine(
				`[devtool] started on ${address.url} (status http://127.0.0.1:${address.statusPort}/status, target ${address.targetId})`,
			),
		(error) => outputChannel.appendLine(`[devtool] failed to start: ${error}`),
	);

	return server;
}
