// The SCHEDULER entity: calibrates chunk size against measured cost, then
// plans structure-aligned chunks over the full document.

export const CALIBRATION_SIZES = [512, 1024, 2048, 4096, 8192, 16384];

// Split [0, totalLines) into chunks of ~targetSize lines. A chunk may END at
// a boundary if one lies within ±25% of the chunk's nominal end (nearest wins);
// a chunk must never exceed targetSize * 1.5 (the boundary snap is clamped).
// The last chunk takes the remainder.
export const planChunks = (totalLines, targetSize, boundaries) => {
  const maxChunk = Math.floor(targetSize * 1.5);
  const chunks = [];
  let start = 0;
  while (start < totalLines) {
    const nominalEnd = Math.min(start + targetSize, totalLines);
    let end = nominalEnd;
    // Nearest boundary within ±25% of the nominal end, clamped to maxChunk.
    const lo = Math.max(start + 1, Math.floor(nominalEnd - targetSize * 0.25));
    const hi = Math.min(totalLines, nominalEnd + Math.floor(targetSize * 0.25));
    let best = -1;
    let bestDist = Infinity;
    for (const b of boundaries) {
      if (b < lo || b > hi) continue;
      const d = Math.abs(b - nominalEnd);
      if (d < bestDist) {
        bestDist = d;
        best = b;
      }
    }
    if (best > start && best <= maxChunk - start) end = best;
    chunks.push({ start, end });
    start = end;
  }
  return chunks;
};

// From calibration rows pick the candidate with the LOWEST ms/line
// (ties -> larger size).
export const pickEffectiveChunk = (calibration) => {
  const rows = calibration.map((c) => ({ size: c.size, msPerLine: c.ms / c.size }));
  // Lowest ms/line first; ties -> larger size first.
  rows.sort((a, b) => a.msPerLine - b.msPerLine || b.size - a.size);
  return rows[0];
};
