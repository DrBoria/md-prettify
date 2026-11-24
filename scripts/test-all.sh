#!/usr/bin/env bash
# Runs every package's tests ONE AT A TIME.
#
# Why not `turbo test`: turbo starts the three packages concurrently, each of
# them runs `tsc -p ./` over the whole monorepo (the adapter packages include
# ../../apps/backend/**/*.ts), and three full compiles at once — on top of
# VS Code's own TypeScript/ESLint servers — is what drove the host into a global
# OOM that killed VS Code and plasmashell.
#
# Sequential runs stay around 1-2 GB peak each; together with scripts/guard.sh
# (cgroup cap + global lock) the total footprint is bounded by a single compile.
set -euo pipefail

cd "$(dirname "$0")/.."

run() {
	echo "=== tests: $1 ==="
	( cd "$1" && npm test )
}

run apps/backend
run packages/vscode-extension
run packages/webstorm-extension

echo "=== all package tests passed ==="
