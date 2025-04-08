// Unit tests for the SCHEDULER pure functions (planChunks, pickEffectiveChunk).
// Run directly with node (ESM), or via the backend `test` script:
//   node scripts/perf/scheduler.test.mjs
// Exits non-zero on the first failed assertion.

import assert from "node:assert/strict";
import { CALIBRATION_SIZES, pickEffectiveChunk, planChunks } from "./scheduler.mjs";

let passed = 0;
const test = (name, fn) => {
	fn();
	passed += 1;
	console.log(`  √ ${name}`);
};

console.log("scheduler (planChunks / pickEffectiveChunk)");

test("covers the whole document with no gaps or overlaps", () => {
	const chunks = planChunks(10_000, 1000, []);
	assert.equal(chunks[0].start, 0);
	assert.equal(chunks.at(-1).end, 10_000);
	for (let i = 1; i < chunks.length; i++) {
		assert.equal(chunks[i].start, chunks[i - 1].end, "chunks must be contiguous");
	}
	for (const c of chunks) assert.ok(c.end > c.start, "no empty chunks");
});

test("never exceeds targetSize * 1.5 (the boundary snap is clamped)", () => {
	// A boundary sits far past the nominal end; the snap must be clamped.
	const chunks = planChunks(10_000, 1000, [9999]);
	for (const c of chunks) assert.ok(c.end - c.start <= 1000 * 1.5, `chunk too large: ${c}`);
});

test("snaps a chunk end to a nearby structure boundary (within ±25%)", () => {
	// Boundary at 1100 is within ±25% (±250) of the nominal end 1000 → snap to it.
	const chunks = planChunks(5000, 1000, [1100, 2100, 3100, 4100]);
	const first = chunks[0];
	assert.equal(first.end, 1100, `expected first chunk to end at 1100, got ${first.end}`);
});

test("does NOT snap to a boundary outside the ±25% window", () => {
	// Boundary at 1400 is 400 past nominal end 1000 (> 250) → no snap, plain 1000.
	const chunks = planChunks(5000, 1000, [1400]);
	assert.equal(chunks[0].end, 1000);
});

test("picks the nearest boundary when several lie in the window", () => {
	// 1080 and 1180 are both within ±250 of 1000; 1080 is nearer.
	const chunks = planChunks(5000, 1000, [1080, 1180]);
	assert.equal(chunks[0].end, 1080);
});

test("a boundary must be after the chunk start to be used", () => {
	// Boundary at 500 is before the nominal end but the chunk starts at 0;
	// it is within the window lower bound, so it must not create a zero/short snap
	// that violates contiguity — the nearest-in-window rule still yields a valid end.
	const chunks = planChunks(5000, 1000, [500]);
	assert.ok(chunks[0].end > chunks[0].start);
	assert.ok(chunks[0].end <= 1000 * 1.5);
});

test("the last chunk takes the remainder", () => {
	const chunks = planChunks(2500, 1000, []);
	assert.equal(chunks.at(-1).end, 2500);
	assert.equal(chunks.at(-1).start, 2000);
});

test("pickEffectiveChunk picks the lowest ms/line", () => {
	const calibration = [
		{ size: 512, ms: 100 }, // 0.195
		{ size: 1024, ms: 120 }, // 0.117  ← best
		{ size: 2048, ms: 260 }, // 0.127
		{ size: 4096, ms: 560 }, // 0.137
	];
	assert.equal(pickEffectiveChunk(calibration).size, 1024);
});

test("pickEffectiveChunk breaks ties toward the larger size", () => {
	const calibration = [
		{ size: 512, ms: 102.4 }, // 0.2
		{ size: 1024, ms: 204.8 }, // 0.2  ← tie, larger wins
	];
	assert.equal(pickEffectiveChunk(calibration).size, 1024);
});

test("CALIBRATION_SIZES is a strictly increasing positive sequence", () => {
	assert.ok(CALIBRATION_SIZES.length > 1);
	for (let i = 1; i < CALIBRATION_SIZES.length; i++) {
		assert.ok(CALIBRATION_SIZES[i] > CALIBRATION_SIZES[i - 1]);
	}
	assert.ok(CALIBRATION_SIZES.every((n) => n > 0));
});

console.log(`\n  ${passed} passing`);
