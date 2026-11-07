#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "Zero local secret setup"
echo "Inputs are hidden and values are never printed."
echo "Press Enter to keep the current value; type __CLEAR__ to clear it."
echo

if [ ! -r /dev/tty ]; then
  echo "Run this script from an interactive Terminal window." >&2
  exit 1
fi

while IFS='|' read -r key label <&3; do
  [ -n "$key" ] || continue
  printf '%s: ' "$label" > /dev/tty
  IFS= read -r -s value < /dev/tty
  printf '\n' > /dev/tty
  if [ -z "$value" ]; then value="__KEEP__"; fi
  export "ZERO_SECRET_${key}=${value}"
done 3<<'PROMPTS'
GOOGLE_CLIENT_ID|Google OAuth client ID
GOOGLE_CLIENT_SECRET|Google OAuth client secret
OPENROUTER_API_KEY|OpenRouter API key
GOOGLE_GENERATIVE_AI_API_KEY|Optional Google AI Studio API key
REDIS_URL|Upstash Redis REST URL
REDIS_TOKEN|Upstash Redis REST token
PROMPTS

python3 - <<'PY'
import json
import os
from pathlib import Path

path = Path('.env')
lines = path.read_text().splitlines()
keys = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'OPENROUTER_API_KEY',
    'GOOGLE_GENERATIVE_AI_API_KEY',
    'REDIS_URL',
    'REDIS_TOKEN',
]
updates = {}
for key in keys:
    value = os.environ[f'ZERO_SECRET_{key}']
    if value == '__KEEP__':
        continue
    updates[key] = '' if value == '__CLEAR__' else value

seen = set()
out = []
for line in lines:
    if '=' in line and not line.lstrip().startswith('#'):
        key = line.split('=', 1)[0].strip()
        if key in updates:
            out.append(f'{key}={json.dumps(updates[key])}')
            seen.add(key)
            continue
    out.append(line)

for key, value in updates.items():
    if key not in seen:
        out.append(f'{key}={json.dumps(value)}')

path.write_text('\n'.join(out) + '\n')
PY

chmod 600 .env
npx --yes pnpm@10.12.1 nizzy sync
chmod 600 .env apps/mail/.dev.vars apps/mail/.env apps/server/.dev.vars

echo
echo "Local secrets were saved and synced. Values were not printed."
echo "AI stays free-only; Gemini fallback remains disabled unless explicitly enabled."
