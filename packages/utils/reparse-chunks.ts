import type { Range } from "@md-prettify/types";
import { rangeFrom } from "./range";

export interface ChunkReparseOptions {
	viewportRange?: Range;
	chunkSize?: number;
	onChunkComplete?: (range: Range) => void;
	pushEvery?: number;
	onComplete?: () => void;
	token?: { cancelled: boolean };
}

const defaultChunkSize = 2048;
const viewportSyncLimit = 500;

/**
 * Schedules a full-document reparse in chunks, yielding to the event loop
 * between chunks. Pure: the per-chunk work is delegated to `reparseChunk`.
 */
export const chunkedFullReparse = (
	totalLines: number,
	opts: ChunkReparseOptions = {},
	reparseChunk: (range: Range) => void,
): Promise<void> => {
	const chunkSize = opts.chunkSize ?? defaultChunkSize;
	const pushEvery = Math.max(1, opts.pushEvery ?? 1);
	const token = opts.token;
	const onChunkComplete = opts.onChunkComplete;
	const onComplete = opts.onComplete;
	const viewportRange = opts.viewportRange;

	let vpStart = 0;
	let vpEnd = 0;
	if (viewportRange) {
		const vr = viewportRange;
		vpStart = Math.max(0, vr.start.line - Math.floor(viewportSyncLimit / 2));
		vpEnd = Math.min(totalLines, vr.end.line + Math.ceil(viewportSyncLimit / 2));
		reparseChunk(rangeFrom(vpStart, 0, vpEnd, 0));
		onChunkComplete?.(rangeFrom(vpStart, 0, vpEnd, 0));
	}

	const chunks: Range[] = [];
	for (let s = 0; s < vpStart; s += chunkSize) {
		const e = Math.min(s + chunkSize, vpStart);
		chunks.push(rangeFrom(s, 0, e, 0));
	}
	for (let s = vpEnd; s < totalLines; s += chunkSize) {
		const e = Math.min(s + chunkSize, totalLines);
		chunks.push(rangeFrom(s, 0, e, 0));
	}

	return processNext(chunks, 0, pushEvery, token, reparseChunk, onChunkComplete, onComplete);
};

/** Processes one chunk, then yields to the event loop before the next. */
const processNext = (
	chunks: Range[],
	index: number,
	pushEvery: number,
	token: { cancelled: boolean } | undefined,
	reparseChunk: (range: Range) => void,
	onChunkComplete: ((range: Range) => void) | undefined,
	onComplete: (() => void) | undefined,
): Promise<void> => {
	if (token?.cancelled) return Promise.resolve();
	if (index >= chunks.length) {
		onComplete?.();
		return Promise.resolve();
	}
	const chunk = chunks[index];
	reparseChunk(chunk);
	const isLast = index === chunks.length - 1;
	if (isLast || (index + 1) % pushEvery === 0) {
		onChunkComplete?.(chunk);
	}
	return new Promise<void>(function (resolve) {
		setImmediate(function () {
			if (token?.cancelled) {
				resolve();
				return;
			}
			void processNext(chunks, index + 1, pushEvery, token, reparseChunk, onChunkComplete, onComplete).then(resolve);
		});
	});
};
