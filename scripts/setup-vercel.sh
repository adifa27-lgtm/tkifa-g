#!/usr/bin/env bash
# Links (or creates) the Vercel project "tkifa-g" and loads the env vars from .env.local.
# Requires: `vercel login` done and .env.local complete (scripts/env-tool.mjs check).
# Never echoes secrets.
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT=${VERCEL_PROJECT:-tkifa-g}

if [[ ! -f .vercel/project.json ]]; then
  echo "== Linking Vercel project $PROJECT"
  vercel link --yes --project "$PROJECT"
fi

echo "== Checking local env"
node scripts/env-tool.mjs check
if node scripts/env-tool.mjs check | grep -q MISSING; then
  echo "Some values are missing; finish SETUP.md first." >&2
  exit 1
fi

echo "== Loading env vars into Vercel (production + preview)"
node scripts/env-tool.mjs push-vercel

echo "== Done. Deploy with: vercel deploy --prod"
