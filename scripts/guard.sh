#!/usr/bin/env bash
# Runs one shell command inside a transient systemd user scope with a HARD
# memory cap AND a global lock, so only one heavy run can exist at a time.
#
# Why both:
#   * MemoryMax alone caps a single run — but three runs in parallel (which is
#     exactly what happens when a command is fired repeatedly) still exhaust the
#     machine, and the kernel then kills the biggest processes: VS Code and
#     plasmashell.
#   * The lock makes the second, third, ... invocation WAIT instead of starting,
#     so the total footprint of build/test/lint work is bounded by one run.
#   * NODE_OPTIONS caps the V8 heap of every node process started under the
#     guard, so a runaway allocation inside one process fails fast instead of
#     eating the host.
#
# Usage: guard.sh '<shell command>'
# Tunables: GUARD_MEM_MAX (default 3G), GUARD_MEM_SWAP_MAX (default 0),
#           GUARD_HEAP_MB (default 1536), GUARD_LOCK.
set -uo pipefail

CMD="${1:?usage: guard.sh '<command>'}"
MEM_MAX="${GUARD_MEM_MAX:-3G}"
MEM_SWAP_MAX="${GUARD_MEM_SWAP_MAX:-0}"
HEAP_MB="${GUARD_HEAP_MB:-1536}"
LOCK="${GUARD_LOCK:-/tmp/md-prettify-guard.lock}"

export NODE_OPTIONS="--max-old-space-size=${HEAP_MB} ${NODE_OPTIONS:-}"

# One heavy run at a time. fd 9 stays open across exec, so the lock is held for
# the whole lifetime of the command below.
exec 9>"$LOCK"
flock 9

if systemd-run --user --scope -q true >/dev/null 2>&1; then
	exec systemd-run --user --scope -q \
		-p "MemoryMax=${MEM_MAX}" \
		-p "MemorySwapMax=${MEM_SWAP_MAX}" \
		bash -lc "$CMD"
fi

# Fallback for environments without user scopes (containers, CI): a plain
# address-space cap, 3 GiB in KiB.
ulimit -v $((3 * 1024 * 1024))
exec bash -lc "$CMD"
