#!/usr/bin/env bash
# Copy the AI/research keys from .env.local to Vercel (production, preview, development).
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env.local; set +a
for v in OPENAI_API_KEY LINKUP_API_KEY; do
  [ -z "${!v:-}" ] && { echo "skip $v (empty in .env.local)"; continue; }
  for e in production preview; do printf "%s" "${!v}" | vercel env add "$v" "$e" --sensitive --non-interactive --force >/dev/null && echo "ok $v $e"; done
  printf "%s" "${!v}" | vercel env add "$v" development --no-sensitive --non-interactive --force >/dev/null && echo "ok $v development"
done
