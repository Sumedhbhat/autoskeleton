#!/usr/bin/env bash
# Usage: evals/new-run.sh <name>  → fresh copy of the template in evals/runs/<name>
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
tpl="${2:-template}"
dest="$here/runs/$1"
rm -rf "$dest"
mkdir -p "$dest"
(cd "$here/$tpl" && tar --exclude=node_modules --exclude='grade*' -cf - .) | (cd "$dest" && tar xf -)
cp -al "$here/$tpl/node_modules" "$dest/node_modules"
echo "$dest"
