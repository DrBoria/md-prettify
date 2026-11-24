/**
 * The devtool MCP lifecycle for the vscode adapter: the server is created on
 * activation and handed back, so the activation owns the stop and this module keeps
 * no state of its own.
 *
 * It is the real `vscode-extension-devtool-mcp` package: it publishes this window to
 * the shared target registry and serves the agent over a WebSocket plus an HTTP
 * status endpoint, so an MCP client finds the extension without being told a port.
 */
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { DevtoolServer, diagnosticsManager } from 'vscode-extension-devtool-mcp';
import type { DevtoolBridgeProvider } from 'vscode-extension-devtool-mcp';

const run = promisify(execFile);

/**
 * captureScreenshot: photographs the desktop for the agent. An extension host has no
 * webview, so the devtool's frontend screenshot has nothing to capture here — the
 * real window is the surface that has to be looked at.
 *
 * @param {{ target?: 'active' | 'screen'; width?: number; crop?: number[] }} options
 *        which surface to capture, the result width and an optional crop rectangle
 * @returns {Promise<{ data: string; mimeType: string; width?: number; height?: number } | null>} the PNG
 */
/**
 * raiseWindow: brings the window whose caption contains `caption` to the front, so
 * `spectacle --activewindow` photographs the surface the agent asked for instead of
 * whatever happened to be focused.
 *
 * @param {string} caption the caption substring of the window to raise
 * @returns {Promise<void>} resolves once the window manager ran the script
 */
/**
 * selfWindowCaption: the caption KWin gives this window. A dev host is titled
 * `[Extension Development Host] <folder>`, and that is the only stable handle the
 * extension has for its own surface — every VS Code window shares one process, so a
 * pid match cannot tell them apart.
 *
 * @returns {string} the caption substring that identifies this window
 */
function selfWindowCaption(): string {
	const folder = vscode.workspace.workspaceFolders?.[0]?.name ?? '';
	// `extensionMode` is newer than the types this package compiles against.
	const mode = (vscode as unknown as { extensionMode?: number }).extensionMode === 2 ? '[Extension Development Host]' : '';

	return mode && folder ? `${mode} ${folder}` : folder;
}

async function raiseWindow(caption?: string): Promise<void> {
	const script = path.join(os.tmpdir(), `md-prettify-raise-${Date.now()}.js`);
	const exact = caption ?? selfWindowCaption();
	// A dev host is titled `[Extension Development Host] <folder>`; try the exact
	// caption first, then the folder alone, then the dev-host marker. Every VS Code
	// window shares one process, so the caption is the only thing that tells them apart.
	const candidates = [...new Set([exact, '[Extension Development Host]', '[Extension Development Host] '.trim()].filter((value) => value.length > 0))];
	const source = [
		"const wins = (typeof workspace.windowList === 'function') ? workspace.windowList() : workspace.clientList();",
		`const needles = ${JSON.stringify(candidates)};`,
		"for (const needle of needles) {",
		"\tfor (const w of wins) { if (String(w.caption).indexOf(needle) !== -1) { workspace.activeWindow = w; return; } }",
		"}",
	].join('\n');
	await fs.promises.writeFile(script, source, 'utf8');
	try {
		await run('qdbus', ['org.kde.KWin', '/Scripting', 'org.kde.kwin.Scripting.loadScript', script], { timeout: 5000 });
		await run('qdbus', ['org.kde.KWin', '/Scripting', 'org.kde.kwin.Scripting.start'], { timeout: 5000 });
		await new Promise((resolve) => setTimeout(resolve, 500));
	} finally {
		void fs.promises.rm(script, { force: true });
	}
}

async function captureScreenshot(options: {
	target?: 'active' | 'screen';
	window?: string;
	width?: number;
	crop?: number[];
}): Promise<{ data: string; mimeType: string; width?: number; height?: number } | null> {
	const stamp = Date.now();
	const raw = path.join(os.tmpdir(), `md-prettify-shot-${stamp}.png`);
	const edited = path.join(os.tmpdir(), `md-prettify-shot-edited-${stamp}.png`);
	const width = options.width ?? 1800;
	try {
		if (options.target !== 'screen') await raiseWindow(options.window ?? selfWindowCaption());
		await run('spectacle', ['-b', '-n', options.target === 'screen' ? '-f' : '-a', '-o', raw], { timeout: 15000 });
		const steps: string[] = [];
		if (options.crop?.length === 4) steps.push('-crop', `${options.crop[2]}x${options.crop[3]}+${options.crop[0]}+${options.crop[1]}`, '+repage');
		steps.push('-resize', `${width}x`);
		await run('magick', [raw, ...steps, edited], { timeout: 15000 });
		const [data, size] = await Promise.all([
			fs.promises.readFile(edited, 'base64'),
			run('identify', ['-format', '%w %h', edited], { timeout: 5000 }),
		]);
		const [w, h] = String(size.stdout).trim().split(/\s+/).map(Number);

		return { data, mimeType: 'image/png', width: w, height: h };
	} catch (error) {
		console.error('[md-prettify] screenshot failed:', error);

		return null;
	} finally {
		void fs.promises.rm(raw, { force: true });
		void fs.promises.rm(edited, { force: true });
	}
}

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
		// The provider contract is `Promise<void>`, but the dev-only probes answer the
		// agent with the editor state as JSON, so the value is passed through.
		executeCommand: (async (command: string, args?: unknown) =>
			await vscode.commands.executeCommand(command, args)) as unknown as (
			command: string,
			args?: unknown,
		) => Promise<void>,
		getScreenshot: captureScreenshot,
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
		getWorkspaceFolder: () => vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
		getFocused: () => vscode.window.state.focused,
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
