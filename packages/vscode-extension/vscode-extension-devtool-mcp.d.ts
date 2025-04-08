/**
 * Local type declarations for `vscode-extension-devtool-mcp`.
 * The package does not ship type declarations yet (battle-test finding).
 * This file covers the surface used by the extension.
 */
declare module 'vscode-extension-devtool-mcp' {
	export interface DevtoolBridgeProvider {
		findElement: (selector: string, depth?: number, maxChildren?: number, command?: string) => Promise<string>;
		getActivePage: (requestId: string) => void;
		setActivePageRequestCallback: (requestId: string, callback: (result: string, connector?: string) => void) => void;
		setDomRequestCallback: (requestId: string, callback: (result: string, connector?: string) => void) => void;
		postMessageToWebview: (type: string, payload?: Record<string, unknown>) => void;
		getModes: () => string[];
		getMode: () => string;
		getTaskWithId?: (taskId: string) => Record<string, unknown> | undefined;
		executeCommand?: (command: string, args?: unknown) => Promise<void>;
		getExtensionVersion?: () => string | undefined;
	}

	export interface HostIdentity {
		workspaceFolder?: string;
		getWorkspaceFolder?: () => string | undefined;
		getFocused?: () => boolean;
	}

	export interface DevtoolServer {
		start(): Promise<void>;
		stop(): Promise<void>;
	}
	export const DevtoolServer: {
		new (
			init: { provider: DevtoolBridgeProvider } | Record<string, unknown> | undefined,
			model?: unknown,
			port?: number,
			interceptor?: unknown,
			statusPort?: number,
			identity?: HostIdentity,
			storeEnvs?: string[],
			frontendInterceptor?: unknown,
		): DevtoolServer;
		stopGlobalInstance(): Promise<void>;
	};
}
