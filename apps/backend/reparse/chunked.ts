/**
 * Async chunked reparse driver.
 *
 * Strategy: parse the viewport range synchronously (small, ~50–100 lines),
 * then process remaining lines in background chunks yielding via setImmediate
 * so the event loop stays responsive. Each chunk is a contiguous line range
 * sized from the scheduler calibration (effective range ~1024–2048 lines).
 *
 * The existing `reparsePretties` already supports partial reparse via its
 * `lineRange` parameter, so each chunk is a single call to it.
 */
import { reparsePretties } from "./pretties";
import type { DocumentStore } from "../document/type";
import type { Range } from "../host";
import { rangeFrom } from "../host";

/** Default chunk size in lines. Calibrated: 2048 lines ≈ 200–400ms with
 *  the real TS grammar + 25 rules. Yields between chunks keep the event
 *  loop responsive. */
export const defaultChunkSize = 2048;

/** Maximum lines to parse synchronously in the viewport pass. The viewport
 *  is typically 50–100 lines; we cap at 500 to be safe for zoomed-out views. */
export const viewportSyncLimit = 500;

export interface ChunkedReparseOptions {
  /** The line range to parse synchronously first (viewport). */
  viewportRange?: Range;
  /** Chunk size for background passes. */
  chunkSize?: number;
  /** Called after a chunk completes with the chunk's line range.
   *  The controller uses this to push incremental decorations.
   *  Throttled by `pushEvery`; the final chunk always fires. */
  onChunkComplete?: (range: Range) => void;
  /** Push decorations every Nth background chunk (default 1 = every chunk).
   *  The viewport sync pass and the final chunk always push regardless. */
  pushEvery?: number;
  /** Called when the full reparse is done. */
  onComplete?: () => void;
  /** If set, the reparse is cancelled when a new token is issued. */
  token?: { cancelled: boolean };
}

/**
 * Runs a full-document reparse in chunks. The viewport range (if provided)
 * is parsed synchronously first; the rest is processed in background chunks
 * with setImmediate yields between them.
 *
 * Returns a Promise that resolves when all chunks are done.
 */
export const chunkedFullReparse = (
  state: DocumentStore,
  opts: ChunkedReparseOptions = {},
): Promise<void> => {
  const chunkSize = opts.chunkSize ?? defaultChunkSize;
  const pushEvery = Math.max(1, opts.pushEvery ?? 1);
  const token = opts.token;
  const totalLines = state.document.getLineCount();

  // Determine the viewport sync range.
  let vpStart = 0;
  let vpEnd = 0;
  if (opts.viewportRange) {
    const vr = opts.viewportRange;
    vpStart = Math.max(0, vr.start.line - Math.floor(viewportSyncLimit / 2));
    vpEnd = Math.min(totalLines, vr.end.line + Math.ceil(viewportSyncLimit / 2));
    reparsePretties(state, rangeFrom(vpStart, 0, vpEnd, 0));
    opts.onChunkComplete?.(rangeFrom(vpStart, 0, vpEnd, 0));
  }

  // Build background chunks: everything outside [vpStart, vpEnd).
  const chunks: Range[] = [];
  for (let s = 0; s < vpStart; s += chunkSize) {
    const e = Math.min(s + chunkSize, vpStart);
    chunks.push(rangeFrom(s, 0, e, 0));
  }
  for (let s = vpEnd; s < totalLines; s += chunkSize) {
    const e = Math.min(s + chunkSize, totalLines);
    chunks.push(rangeFrom(s, 0, e, 0));
  }

  // Process chunks asynchronously.
  return processNext(state, chunks, 0, pushEvery, token, opts);
};

/** Processes one chunk, then yields to the event loop before the next. */
const processNext = (
  state: DocumentStore,
  chunks: Range[],
  index: number,
  pushEvery: number,
  token: { cancelled: boolean } | undefined,
  opts: ChunkedReparseOptions,
): Promise<void> => {
  if (token?.cancelled) return Promise.resolve();
  if (index >= chunks.length) {
    opts.onComplete?.();
    return Promise.resolve();
  }
  const chunk = chunks[index];
  // Parse this chunk synchronously (blocks for ~200ms at 2048 lines).
  reparsePretties(state, chunk);
  // Throttle decoration pushes: every push re-marshals the ENTIRE growing
  // range list through setDecorations, so pushing after every chunk is
  // O(chunks × totalRanges). Fire on the final chunk unconditionally.
  const isLast = index === chunks.length - 1;
  if (isLast || (index + 1) % pushEvery === 0) {
    opts.onChunkComplete?.(chunk);
  }
  // Yield to the event loop before the next chunk.
  return new Promise<void>(function (resolve) {
    setImmediate(function () {
      if (token?.cancelled) {
        resolve();
        return;
      }
      void processNext(state, chunks, index + 1, pushEvery, token, opts).then(resolve);
    });
  });
};

