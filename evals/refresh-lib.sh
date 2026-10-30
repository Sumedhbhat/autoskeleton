#!/usr/bin/env bash
# Rebuild + repack the library and install it into the eval template.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root" && npm run build >/dev/null && rm -f evals/autoskeleton-react-*.tgz && npm pack --pack-destination evals/ >/dev/null 2>&1
cd "$root/evals/template" && npm i ../autoskeleton-react-0.1.0.tgz >/dev/null 2>&1
echo "refreshed"
