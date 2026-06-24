#!/usr/bin/env bash
# Register OAuth redirect URLs in Stytch Live (or Test) via Management API.
#
# Prerequisites (Stytch Dashboard → Workspace settings → Management API):
#   STYTCH_WORKSPACE_KEY_ID
#   STYTCH_WORKSPACE_SECRET
#
# Also set:
#   STYTCH_PROJECT_SLUG   — project slug from dashboard URL (not project-live-... id)
#   STYTCH_ENVIRONMENT_SLUG — "live" for production, "test" for local
#
# Usage:
#   export STYTCH_WORKSPACE_KEY_ID=workspace-key-prod-...
#   export STYTCH_WORKSPACE_SECRET=...
#   export STYTCH_PROJECT_SLUG=your-project-slug
#   export STYTCH_ENVIRONMENT_SLUG=live
#   ./scripts/stytch-ensure-redirect-urls.sh

set -euo pipefail

: "${STYTCH_WORKSPACE_KEY_ID:?Set STYTCH_WORKSPACE_KEY_ID}"
: "${STYTCH_WORKSPACE_SECRET:?Set STYTCH_WORKSPACE_SECRET}"
: "${STYTCH_PROJECT_SLUG:?Set STYTCH_PROJECT_SLUG}"
: "${STYTCH_ENVIRONMENT_SLUG:=live}"

BASE="https://management.stytch.com/pwa/v3/projects/${STYTCH_PROJECT_SLUG}/environments/${STYTCH_ENVIRONMENT_SLUG}/redirect_urls"

add_redirect() {
  local url="$1"
  echo "Adding redirect URL: ${url}"
  curl -sS -X POST "${BASE}" \
    -u "${STYTCH_WORKSPACE_KEY_ID}:${STYTCH_WORKSPACE_SECRET}" \
    -H "Content-Type: application/json" \
    -d "{
      \"url\": \"${url}\",
      \"valid_types\": [
        { \"type\": \"LOGIN\", \"is_default\": true },
        { \"type\": \"SIGNUP\", \"is_default\": true }
      ]
    }"
  echo ""
}

if [[ "${STYTCH_ENVIRONMENT_SLUG}" == "live" ]]; then
  add_redirect "https://bank.creativeplatform.xyz/authenticate"
else
  add_redirect "http://localhost:3000/authenticate"
fi

echo "Done. Verify at https://stytch.com/dashboard/redirect-urls (${STYTCH_ENVIRONMENT_SLUG} environment)."
