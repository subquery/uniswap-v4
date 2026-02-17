#!/bin/bash
#
# Patch resource limits for SubQuery indexer deployments on a target cluster.
#
# Modes:
#   Auto-discover (default):
#     ./scripts/patch-resources.sh [--dry-run]
#     Queries the cluster for uniswap-v3-* and uniswap-v4-* deployments,
#     lists current resources, and asks for confirmation before patching.
#
#   Mapped (uses hardcoded ID list):
#     ./scripts/patch-resources.sh --mapped [--dry-run]
#     Patches only deployments listed in MAPPED_ENTRIES below.
#     The deployment IDs correspond to projects generated from networks.json.
#

set -euo pipefail

# ============================================================================
# Global Configuration
# ============================================================================

CLUSTER_CONTEXT="hm"
NAMESPACE="subquery"
PROJECT_PREFIXES="uniswap-v3-|uniswap-v4-"

# ============================================================================
# Default Resource Values (applied unless overridden per-deployment)
# ============================================================================

DEFAULT_REQUESTS_CPU="100m"
DEFAULT_REQUESTS_MEMORY="1000Mi"
DEFAULT_LIMITS_CPU="2000m"
DEFAULT_LIMITS_MEMORY="2000Mi"

# ============================================================================
# Network → Deployment ID Mapping (used in --mapped mode only)
# Derived from networks.json project deployments on the SubQuery Network.
# Format: "network-name:deployment-id" per line.
# Edit this list to add/remove deployments to patch.
# ============================================================================

MAPPED_ENTRIES=(
  # "uniswap-v4-sepolia:24476"
  # "uniswap-v3-ethereum:24484"
  # "uniswap-v4-arbitrum-one:24485"
  # "uniswap-v4-xlayer:24487"
  # "uniswap-v4-base:24493"
  # "uniswap-v4-megaeth:24494"
  # "uniswap-v4-unichain:24495"
  # "uniswap-v4-optimism:24496"
)

# ============================================================================
# Per-Deployment Resource Overrides (optional, applies in both modes)
# Format: OVERRIDE_<ID>="requests_cpu requests_memory limits_cpu limits_memory"
# Only specify entries that differ from the defaults.
# ============================================================================

# OVERRIDE_24493="100m 1000Mi 2000m 2000Mi"  # uniswap-v4-base: higher limits

# ============================================================================
# Parse Arguments
# ============================================================================

MODE="auto"
DRY_RUN=""

for arg in "$@"; do
  case "$arg" in
    --mapped)  MODE="mapped" ;;
    --dry-run) DRY_RUN="true" ;;
    *)         echo "Unknown argument: $arg"; exit 1 ;;
  esac
done

# ============================================================================
# Patch Logic
# ============================================================================

patch_deployment() {
  local network="$1"
  local deploy_id="$2"
  local req_cpu="$3"
  local req_mem="$4"
  local lim_cpu="$5"
  local lim_mem="$6"

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
              "cpu": "${req_cpu}",
              "memory": "${req_mem}"
            },
            "limits": {
              "cpu": "${lim_cpu}",
              "memory": "${lim_mem}"
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

# Normalize CPU value to millicores for comparison (e.g. "2" -> "2000m", "500m" -> "500m")
normalize_cpu() {
  local val="$1"
  if [[ "$val" =~ ^[0-9]+$ ]]; then
    echo "$((val * 1000))m"
  else
    echo "$val"
  fi
}

get_resource_values() {
  local deploy_id="$1"
  local override_var="OVERRIDE_${deploy_id}"
  if [[ -n "${!override_var:-}" ]]; then
    echo "${!override_var}"
  else
    echo "${DEFAULT_REQUESTS_CPU} ${DEFAULT_REQUESTS_MEMORY} ${DEFAULT_LIMITS_CPU} ${DEFAULT_LIMITS_MEMORY}"
  fi
}

# ============================================================================
# Auto-discover Mode
# ============================================================================

run_auto_mode() {
  echo "Discovering uniswap deployments on cluster ${CLUSTER_CONTEXT}..."
  echo ""

  # Query all indexer deployments and filter by project name prefix
  local raw
  raw=$(kubectl --context "${CLUSTER_CONTEXT}" -n "${NAMESPACE}" \
    get deployments -l role=indexer \
    -o jsonpath='{range .items[*]}{.metadata.labels.deploymentId}{"\t"}{.metadata.labels.projectName}{"\t"}{.spec.template.spec.containers[0].resources.requests.cpu}{"\t"}{.spec.template.spec.containers[0].resources.requests.memory}{"\t"}{.spec.template.spec.containers[0].resources.limits.cpu}{"\t"}{.spec.template.spec.containers[0].resources.limits.memory}{"\n"}{end}')

  local matched
  matched=$(echo "$raw" | grep -E "$PROJECT_PREFIXES" | sort -t$'\t' -k2)

  if [[ -z "$matched" ]]; then
    echo "No matching deployments found."
    exit 0
  fi

  local count
  count=$(echo "$matched" | wc -l | tr -d ' ')

  # Display current state and planned changes
  printf "%-8s %-30s %-20s %-20s  =>  %-20s %-20s\n" \
    "ID" "PROJECT" "CURRENT REQ" "CURRENT LIM" "NEW REQ" "NEW LIM"
  printf "%s\n" "$(printf '%.0s-' {1..130})"

  local ids=()
  local networks=()
  local changes=()

  while IFS=$'\t' read -r dep_id proj_name cur_req_cpu cur_req_mem cur_lim_cpu cur_lim_mem; do
    read -r new_req_cpu new_req_mem new_lim_cpu new_lim_mem <<< "$(get_resource_values "$dep_id")"

    local cur_req="${cur_req_cpu}/${cur_req_mem}"
    local cur_lim="${cur_lim_cpu}/${cur_lim_mem}"
    local new_req="${new_req_cpu}/${new_req_mem}"
    local new_lim="${new_lim_cpu}/${new_lim_mem}"

    local marker=""
    if [[ "$(normalize_cpu "$cur_req_cpu")" == "$(normalize_cpu "$new_req_cpu")" && \
          "$cur_req_mem" == "$new_req_mem" && \
          "$(normalize_cpu "$cur_lim_cpu")" == "$(normalize_cpu "$new_lim_cpu")" && \
          "$cur_lim_mem" == "$new_lim_mem" ]]; then
      marker=" (no change)"
    fi

    printf "%-8s %-30s %-20s %-20s  =>  %-20s %-20s%s\n" \
      "$dep_id" "$proj_name" "$cur_req" "$cur_lim" "$new_req" "$new_lim" "$marker"

    ids+=("$dep_id")
    networks+=("$proj_name")
    if [[ -z "$marker" ]]; then
      changes+=("$dep_id")
    fi
  done <<< "$matched"

  echo ""
  echo "Total: ${count} deployments found, ${#changes[@]} need changes."

  if [[ ${#changes[@]} -eq 0 ]]; then
    echo "Nothing to patch."
    exit 0
  fi

  if [[ "$DRY_RUN" == "true" ]]; then
    echo "(dry-run mode, skipping confirmation)"
  else
    echo ""
    read -r -p "Proceed with patching ${#changes[@]} deployments? [y/N] " confirm
    if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
      echo "Aborted."
      exit 0
    fi
  fi

  echo ""
  local success=0
  local failed=0
  local skipped=0

  for i in "${!ids[@]}"; do
    local dep_id="${ids[$i]}"
    local proj_name="${networks[$i]}"
    read -r req_cpu req_mem lim_cpu lim_mem <<< "$(get_resource_values "$dep_id")"

    # Skip if no change needed
    local is_change=false
    for cid in "${changes[@]}"; do
      [[ "$cid" == "$dep_id" ]] && is_change=true && break
    done
    if [[ "$is_change" == false ]]; then
      ((skipped++))
      continue
    fi

    echo "[${proj_name}] Patching ID ${dep_id} -> requests(${req_cpu}/${req_mem}) limits(${lim_cpu}/${lim_mem})"
    if patch_deployment "$proj_name" "$dep_id" "$req_cpu" "$req_mem" "$lim_cpu" "$lim_mem"; then
      ((success++))
    else
      echo "  ERROR: Failed to patch ${proj_name} (ID: ${dep_id})"
      ((failed++))
    fi
  done

  echo ""
  echo "=== Done: ${success} patched, ${failed} failed, ${skipped} skipped (no change) ==="
}

# ============================================================================
# Mapped Mode
# ============================================================================

run_mapped_mode() {
  if [[ ${#MAPPED_ENTRIES[@]} -eq 0 ]]; then
    echo "MAPPED_ENTRIES is empty. Edit the script to uncomment entries."
    exit 0
  fi

  # Query current resources for each mapped deployment
  local success=0
  local failed=0
  local skipped=0

  for entry in "${MAPPED_ENTRIES[@]}"; do
    local network="${entry%%:*}"
    local deploy_id="${entry##*:}"
    local deployment_name="subquery-${deploy_id}-indexer-deployment"
    read -r req_cpu req_mem lim_cpu lim_mem <<< "$(get_resource_values "$deploy_id")"

    # Get current resources from cluster
    local cur
    cur=$(kubectl --context "${CLUSTER_CONTEXT}" -n "${NAMESPACE}" \
      get deployment "${deployment_name}" \
      -o jsonpath='{.spec.template.spec.containers[0].resources.requests.cpu}{"\t"}{.spec.template.spec.containers[0].resources.requests.memory}{"\t"}{.spec.template.spec.containers[0].resources.limits.cpu}{"\t"}{.spec.template.spec.containers[0].resources.limits.memory}' 2>/dev/null) || true

    if [[ -n "$cur" ]]; then
      local cur_req_cpu cur_req_mem cur_lim_cpu cur_lim_mem
      IFS=$'\t' read -r cur_req_cpu cur_req_mem cur_lim_cpu cur_lim_mem <<< "$cur"

      if [[ "$(normalize_cpu "$cur_req_cpu")" == "$(normalize_cpu "$req_cpu")" && \
            "$cur_req_mem" == "$req_mem" && \
            "$(normalize_cpu "$cur_lim_cpu")" == "$(normalize_cpu "$lim_cpu")" && \
            "$cur_lim_mem" == "$lim_mem" ]]; then
        echo "[${network}] ID ${deploy_id} (no change, skipped)"
        ((skipped++))
        continue
      fi
    fi

    echo "[${network}] Patching ID ${deploy_id} -> requests(${req_cpu}/${req_mem}) limits(${lim_cpu}/${lim_mem})"
    if patch_deployment "$network" "$deploy_id" "$req_cpu" "$req_mem" "$lim_cpu" "$lim_mem"; then
      ((success++))
    else
      echo "  ERROR: Failed to patch ${network} (ID: ${deploy_id})"
      ((failed++))
    fi
  done

  echo ""
  echo "=== Done: ${success} patched, ${failed} failed, ${skipped} skipped (no change) ==="
}

# ============================================================================
# Main
# ============================================================================

echo "=== SubQuery Indexer Resource Patcher ==="
echo "Cluster: ${CLUSTER_CONTEXT} | Namespace: ${NAMESPACE} | Mode: ${MODE}"
[[ "$DRY_RUN" == "true" ]] && echo "DRY RUN: no changes will be applied"
echo ""

case "$MODE" in
  auto)   run_auto_mode ;;
  mapped) run_mapped_mode ;;
esac
