#!/bin/bash
#
# Interactive resource patcher for SubQuery indexer deployments.
#
# Usage:
#   ./scripts/patch-resources-interactive.sh <keyword> [--dry-run]
#
# Searches for indexer deployments whose projectName contains <keyword>,
# displays a numbered list, then prompts for selection.
#
# Examples:
#   ./scripts/patch-resources-interactive.sh uniswap
#   ./scripts/patch-resources-interactive.sh uniswap-v4 --dry-run
#

set -euo pipefail

# ============================================================================
# Global Configuration
# ============================================================================

CLUSTER_CONTEXT="hm"
NAMESPACE="subquery"

# ============================================================================
# Target Resource Values
# ============================================================================

TARGET_REQUESTS_CPU="100m"
TARGET_REQUESTS_MEMORY="1000Mi"
TARGET_LIMITS_CPU="2000m"
TARGET_LIMITS_MEMORY="2000Mi"

# ============================================================================
# Parse Arguments
# ============================================================================

KEYWORD=""
DRY_RUN=""

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN="true" ;;
    --*)       echo "Unknown option: $arg"; exit 1 ;;
    *)         KEYWORD="$arg" ;;
  esac
done

if [[ -z "$KEYWORD" ]]; then
  echo "Usage: $0 <keyword> [--dry-run]"
  echo "  keyword: search projectName (e.g. 'uniswap', 'uniswap-v4')"
  exit 1
fi

# ============================================================================
# Helpers
# ============================================================================

# Normalize CPU value to millicores for comparison (e.g. "2" -> "2000m", "500m" -> "500m")
normalize_cpu() {
  local val="$1"
  if [[ "$val" =~ ^[0-9]+$ ]]; then
    echo "$((val * 1000))m"
  else
    echo "$val"
  fi
}

needs_change() {
  local cur_req_cpu="$1" cur_req_mem="$2" cur_lim_cpu="$3" cur_lim_mem="$4"
  if [[ "$(normalize_cpu "$cur_req_cpu")" == "$(normalize_cpu "$TARGET_REQUESTS_CPU")" && \
        "$cur_req_mem" == "$TARGET_REQUESTS_MEMORY" && \
        "$(normalize_cpu "$cur_lim_cpu")" == "$(normalize_cpu "$TARGET_LIMITS_CPU")" && \
        "$cur_lim_mem" == "$TARGET_LIMITS_MEMORY" ]]; then
    return 1
  fi
  return 0
}

patch_deployment() {
  local deploy_id="$1"
  local deployment_name="subquery-${deploy_id}-indexer-deployment"

  local patch_json=$(cat <<EOF
{
  "spec": {
    "template": {
      "spec": {
        "containers": [{
          "name": "indexer",
          "resources": {
            "requests": {
              "cpu": "${TARGET_REQUESTS_CPU}",
              "memory": "${TARGET_REQUESTS_MEMORY}"
            },
            "limits": {
              "cpu": "${TARGET_LIMITS_CPU}",
              "memory": "${TARGET_LIMITS_MEMORY}"
            }
          }
        }]
      }
    }
  }
}
EOF
)

  if [[ "$DRY_RUN" == "true" ]]; then
    echo "  (dry-run) would patch ${deployment_name}"
  else
    kubectl --context "${CLUSTER_CONTEXT}" -n "${NAMESPACE}" \
      patch deployment "${deployment_name}" \
      --type=strategic \
      -p "${patch_json}"
  fi
}

# ============================================================================
# Main
# ============================================================================

echo "=== SubQuery Interactive Resource Patcher ==="
echo "Cluster: ${CLUSTER_CONTEXT} | Namespace: ${NAMESPACE}"
echo "Target: requests(${TARGET_REQUESTS_CPU}/${TARGET_REQUESTS_MEMORY}) limits(${TARGET_LIMITS_CPU}/${TARGET_LIMITS_MEMORY})"
[[ "$DRY_RUN" == "true" ]] && echo "DRY RUN: no changes will be applied"
echo ""
echo "Searching for deployments matching '${KEYWORD}'..."
echo ""

# Query cluster
raw=$(kubectl --context "${CLUSTER_CONTEXT}" -n "${NAMESPACE}" \
  get deployments -l role=indexer \
  -o jsonpath='{range .items[*]}{.metadata.labels.deploymentId}{"\t"}{.metadata.labels.projectName}{"\t"}{.spec.template.spec.containers[0].resources.requests.cpu}{"\t"}{.spec.template.spec.containers[0].resources.requests.memory}{"\t"}{.spec.template.spec.containers[0].resources.limits.cpu}{"\t"}{.spec.template.spec.containers[0].resources.limits.memory}{"\n"}{end}')

matched=$(echo "$raw" | grep -i "$KEYWORD" | sort -t$'\t' -k2)

if [[ -z "$matched" ]]; then
  echo "No deployments found matching '${KEYWORD}'."
  exit 0
fi

# Parse results into arrays
IDS=()
NAMES=()
CUR_REQS=()
CUR_LIMS=()
CHANGEABLE=()

while IFS=$'\t' read -r dep_id proj_name cur_req_cpu cur_req_mem cur_lim_cpu cur_lim_mem; do
  IDS+=("$dep_id")
  NAMES+=("$proj_name")
  CUR_REQS+=("${cur_req_cpu}/${cur_req_mem}")
  CUR_LIMS+=("${cur_lim_cpu}/${cur_lim_mem}")

  if needs_change "$cur_req_cpu" "$cur_req_mem" "$cur_lim_cpu" "$cur_lim_mem"; then
    CHANGEABLE+=("1")
  else
    CHANGEABLE+=("0")
  fi
done <<< "$matched"

ITEM_COUNT=${#IDS[@]}
TARGET_REQ="${TARGET_REQUESTS_CPU}/${TARGET_REQUESTS_MEMORY}"
TARGET_LIM="${TARGET_LIMITS_CPU}/${TARGET_LIMITS_MEMORY}"

# Display numbered list
printf "  #   %-8s %-30s %-16s %-16s  =>  %-16s %-16s\n" \
  "ID" "PROJECT" "CUR REQ" "CUR LIM" "NEW REQ" "NEW LIM"
printf "  %s\n" "$(printf '%.0s-' {1..115})"

changeable_nums=()
for i in $(seq 0 $((ITEM_COUNT - 1))); do
  num=$((i + 1))
  marker=""
  if [[ "${CHANGEABLE[$i]}" == "0" ]]; then
    marker=" (no change)"
  else
    changeable_nums+=("$num")
  fi
  printf "  %-3s %-8s %-30s %-16s %-16s  =>  %-16s %-16s%s\n" \
    "$num" "${IDS[$i]}" "${NAMES[$i]}" "${CUR_REQS[$i]}" "${CUR_LIMS[$i]}" \
    "$TARGET_REQ" "$TARGET_LIM" "$marker"
done

echo ""
echo "${#changeable_nums[@]} of ${ITEM_COUNT} deployments need changes."

if [[ ${#changeable_nums[@]} -eq 0 ]]; then
  echo "Nothing to patch."
  exit 0
fi

# Prompt for selection
echo ""
echo "Enter 'all' to patch all, or numbers separated by commas (e.g. 1,3,5), or 'q' to quit:"
read -r -p "> " selection

if [[ "$selection" == "q" || "$selection" == "Q" ]]; then
  echo "Aborted."
  exit 0
fi

# Parse selection
selected_indices=()
if [[ "$selection" == "all" || "$selection" == "ALL" ]]; then
  for n in "${changeable_nums[@]}"; do
    selected_indices+=($((n - 1)))
  done
else
  IFS=',' read -ra parts <<< "$selection"
  for part in "${parts[@]}"; do
    # Trim whitespace
    num=$(echo "$part" | tr -d ' ')
    # Validate
    if ! [[ "$num" =~ ^[0-9]+$ ]] || [[ "$num" -lt 1 ]] || [[ "$num" -gt "$ITEM_COUNT" ]]; then
      echo "Invalid number: $part (must be 1-${ITEM_COUNT})"
      exit 1
    fi
    idx=$((num - 1))
    if [[ "${CHANGEABLE[$idx]}" == "0" ]]; then
      echo "Skipping #${num} (${NAMES[$idx]}): already matches target, no change needed."
      continue
    fi
    selected_indices+=("$idx")
  done
fi

if [[ ${#selected_indices[@]} -eq 0 ]]; then
  echo "No deployments selected. Nothing to do."
  exit 0
fi

echo ""
echo "Patching ${#selected_indices[@]} deployment(s)..."
echo ""

success=0
failed=0

for i in "${selected_indices[@]}"; do
  local_id="${IDS[$i]}"
  local_name="${NAMES[$i]}"

  echo "[${local_name}] Patching ID ${local_id} -> requests(${TARGET_REQ}) limits(${TARGET_LIM})"
  if patch_deployment "$local_id"; then
    ((success++))
  else
    echo "  ERROR: Failed to patch ${local_name} (ID: ${local_id})"
    ((failed++))
  fi
done

echo ""
echo "=== Done: ${success} patched, ${failed} failed ==="
