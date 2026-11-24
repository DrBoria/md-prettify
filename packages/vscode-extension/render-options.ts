/**
 * The VS Code decoration render options: the SDK's spelling of the style the
 * backend computes. Only the paint path needs this translation, so it lives in
 * its own module instead of the whole ide surface.
 */
import * as vscode from 'vscode';
import type { ContentBlock, DecorationRenderOptions } from '@md-prettify/types';

/** rangeBehaviorOf: the SDK's enum for the behaviour the ide spells out, because
 * @param {string} behavior the ide's spelling, when it has one
 * @returns {vscode.DecorationRangeBehavior | undefined} the enum value, or undefined */
function rangeBehaviorOf(behavior?: string): vscode.DecorationRangeBehavior | undefined {
	switch (behavior) {
		case 'OpenOpen':
			return vscode.DecorationRangeBehavior.OpenOpen;
		case 'ClosedClosed':
			return vscode.DecorationRangeBehavior.ClosedClosed;
		case 'OpenClosed':
			return vscode.DecorationRangeBehavior.OpenClosed;
		case 'ClosedOpen':
			return vscode.DecorationRangeBehavior.ClosedOpen;
		default:
			return undefined;
	}
}

/** decorationOptionsOf: translates the ide render options into the vscode's own
 * @param {Partial<DecorationRenderOptions>} options the ide's record of style fields
 * @returns {vscode.DecorationRenderOptions} the options the vscode accepts */
export function decorationOptionsOf(options: Partial<DecorationRenderOptions>): vscode.DecorationRenderOptions {
	/** The options being built, so a field the ide omits is never written. */
	const result: vscode.DecorationRenderOptions = {};
	/** The SDK's enum for the ide's spelling, so an unknown spelling is simply skipped. */
	const behavior = rangeBehaviorOf(options.rangeBehavior);
	if (behavior !== undefined) result.rangeBehavior = behavior;
	/** The keys copied verbatim, because the SDK and the ide agree on their spelling. */
	const copied = [
		'color',
		'letterSpacing',
		'fontStyle',
		'fontWeight',
		'backgroundColor',
		'outline',
		'border',
		'borderRadius',
		'textDecoration',
		'cursor',
	] as const;
	for (const key of copied) {
		/** The ide's value for one key, absent when the style leaves it out. */
		const value = options[key];
		if (value !== undefined) result[key] = value;
	}
	// Spread (rather than field-by-field copy) so unknown fields like
	// contentIcon pass through untouched.
	/** The block drawn before the token, copied so the caller's object is not shared. */
	const before: ContentBlock | undefined = options.before;
	if (before) result.before = { ...before };
	/** The block drawn after the token, copied for the same reason. */
	const after: ContentBlock | undefined = options.after;
	if (after) result.after = { ...after };
	if (options.dark !== undefined) result.dark = decorationOptionsOf(options.dark);
	if (options.light !== undefined) result.light = decorationOptionsOf(options.light);

	return result;
}
