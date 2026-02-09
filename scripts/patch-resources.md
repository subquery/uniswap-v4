```shell
# Auto-discover mode: list matching deployments, confirm interactively, then patch
bash ./scripts/patch-resources.sh

# Auto-discover mode: preview only, no changes applied
bash ./scripts/patch-resources.sh --dry-run

# Mapped mode: patch only deployments in DEPLOYMENT_MAP
bash ./scripts/patch-resources.sh --mapped

# Mapped mode: preview only
bash ./scripts/patch-resources.sh --mapped --dry-run

# Interactive mode: search by keyword
bash ./scripts/patch-resources-interactive.sh uniswap
bash ./scripts/patch-resources-interactive.sh uniswap --dry-run
```
