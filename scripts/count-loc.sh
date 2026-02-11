#!/usr/bin/env bash
# Count lines of code in the project, excluding generated/vendor files

find . \
  -type f \
  \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' -o -name '*.css' -o -name '*.json' -o -name '*.prisma' \) \
  ! -path './node_modules/*' \
  ! -path './.next/*' \
  ! -path './generated/*' \
  ! -path '*/node_modules/*' \
  ! -path '*/.next/*' \
  ! -path '*/generated/*' \
  ! -path '*/dist/*' \
  ! -path '*/.turbo/*' \
  ! -path '*/coverage/*' \
  ! -path '*pnpm-lock*' \
  -print0 \
| xargs -0 wc -l \
| sort -n \
| tail -1

echo ""
echo "--- Breakdown by extension ---"
for ext in ts tsx js jsx css json prisma; do
  total=$(find . \
    -type f -name "*.${ext}" \
    ! -path './node_modules/*' \
    ! -path './.next/*' \
    ! -path './generated/*' \
    ! -path '*/node_modules/*' \
    ! -path '*/.next/*' \
    ! -path '*/generated/*' \
    ! -path '*/dist/*' \
    ! -path '*/.turbo/*' \
    ! -path '*/coverage/*' \
    ! -path '*pnpm-lock*' \
    -print0 \
  | xargs -0 cat 2>/dev/null | wc -l)
  if [ "$total" -gt 0 ]; then
    printf "%8d  .%s\n" "$total" "$ext"
  fi
done

echo ""
echo "--- Breakdown by directory ---"
for dir in apps/web packages/core packages/db packages/pokemon-data packages/formats packages/smogon-data packages/data-pipeline packages/teams packages/analysis packages/damage-calc packages/recommendations packages/llm packages/battle-engine packages/ui packages/mcp-server tests; do
  if [ -d "$dir" ]; then
    total=$(find "$dir" \
      -type f \
      \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' \) \
      ! -path '*/node_modules/*' \
      ! -path '*/.next/*' \
      ! -path '*/generated/*' \
      ! -path '*/dist/*' \
      -print0 \
    | xargs -0 cat 2>/dev/null | wc -l)
    if [ "$total" -gt 0 ]; then
      printf "%8d  %s\n" "$total" "$dir"
    fi
  fi
done
