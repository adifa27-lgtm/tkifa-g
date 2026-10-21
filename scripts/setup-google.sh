#!/usr/bin/env bash
# Creates (or reuses) the Google Cloud project, enables Sheets + Drive APIs, creates the
# service account and its key, and stores everything in git-ignored local files.
# Requires: `gcloud auth login` done. Never prints secrets.
set -euo pipefail
cd "$(dirname "$0")/.."

mkdir -p secrets
PROJECT_FILE=secrets/gcp-project
if [[ -f $PROJECT_FILE ]]; then
  PROJECT_ID=$(cat "$PROJECT_FILE")
else
  PROJECT_ID="tkifa-g-$(node -e 'process.stdout.write(require("crypto").randomBytes(4).toString("hex").slice(0,6))')"
  echo "$PROJECT_ID" >"$PROJECT_FILE"
fi
SA_NAME=tkifa-g-sheets
SA_EMAIL="$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com"
KEY=secrets/sa-key.json

echo "== Project: $PROJECT_ID"
if ! gcloud projects describe "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud projects create "$PROJECT_ID" --name="tkifa-g" --quiet
fi

echo "== Enabling Google Sheets + Drive APIs"
gcloud services enable sheets.googleapis.com drive.googleapis.com --project "$PROJECT_ID" --quiet

echo "== Service account"
if ! gcloud iam service-accounts describe "$SA_EMAIL" --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$SA_NAME" --display-name="tkifa-g sheet access" --project "$PROJECT_ID" --quiet
fi

if [[ ! -f $KEY ]]; then
  echo "== Creating key (saved to $KEY, git-ignored)"
  gcloud iam service-accounts keys create "$KEY" --iam-account "$SA_EMAIL" --project "$PROJECT_ID" --quiet
fi

node scripts/env-tool.mjs ensure-secret
node scripts/env-tool.mjs sa "$KEY"

cat <<EOF

Done.
  Service account (share the sheet with it as Editor): $SA_EMAIL
  OAuth consent screen: https://console.cloud.google.com/auth/overview?project=$PROJECT_ID
  OAuth clients:        https://console.cloud.google.com/auth/clients?project=$PROJECT_ID
EOF
