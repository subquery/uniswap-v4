import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'

interface NetworksConfig {
  [network: string]: {
    chainId: string
    endpoint: string
    [key: string]: any
  }
}

interface DeployStatus {
  network: string
  status: 'success' | 'failed' | 'pending'
  cid?: string
  error?: string
  deployedAt?: string
  lastAttempt?: string
}

interface DeployStatusFile {
  lastUpdated: string
  networks: DeployStatus[]
}

const DEPLOY_STATUS_FILE = path.join(__dirname, '..', 'deploy-status.json')
const NETWORKS_FILE = path.join(__dirname, '..', 'networks.json')

function loadNetworks(): string[] {
  const networksConfig: NetworksConfig = JSON.parse(fs.readFileSync(NETWORKS_FILE, 'utf8'))
  return Object.keys(networksConfig)
}

function loadDeployStatus(): DeployStatusFile {
  if (fs.existsSync(DEPLOY_STATUS_FILE)) {
    return JSON.parse(fs.readFileSync(DEPLOY_STATUS_FILE, 'utf8'))
  }
  return {
    lastUpdated: new Date().toISOString(),
    networks: []
  }
}

function saveDeployStatus(status: DeployStatusFile): void {
  status.lastUpdated = new Date().toISOString()
  fs.writeFileSync(DEPLOY_STATUS_FILE, JSON.stringify(status, null, 2), 'utf8')
}

function getNetworkStatus(deployStatus: DeployStatusFile, network: string): DeployStatus | undefined {
  return deployStatus.networks.find(n => n.network === network)
}

function updateNetworkStatus(deployStatus: DeployStatusFile, status: DeployStatus): void {
  const index = deployStatus.networks.findIndex(n => n.network === status.network)
  if (index >= 0) {
    deployStatus.networks[index] = status
  } else {
    deployStatus.networks.push(status)
  }
}

function runCommand(command: string): { success: boolean; output: string } {
  try {
    const output = execSync(command, {
      encoding: 'utf8',
      cwd: path.join(__dirname, '..'),
      stdio: ['pipe', 'pipe', 'pipe']
    })
    return { success: true, output }
  } catch (error: any) {
    return {
      success: false,
      output: error.stdout?.toString() || '' + error.stderr?.toString() || error.message
    }
  }
}

function extractCid(output: string): string | undefined {
  // SubQuery deploy output usually contains CID in format like:
  // "Qm..." or "bafy..." (IPFS CID formats)
  // Also look for patterns like "CID: xxx" or "ipfs://xxx"

  const patterns = [
    /CID:\s*([a-zA-Z0-9]+)/i,
    /ipfs:\/\/([a-zA-Z0-9]+)/i,
    /\b(Qm[a-zA-Z0-9]{44,})\b/,
    /\b(bafy[a-zA-Z0-9]{50,})\b/,
    /Published:\s*([a-zA-Z0-9]+)/i,
    /deployment\s+id[:\s]+([a-zA-Z0-9]+)/i
  ]

  for (const pattern of patterns) {
    const match = output.match(pattern)
    if (match) {
      return match[1]
    }
  }

  return undefined
}

async function deployNetwork(network: string): Promise<DeployStatus> {
  const now = new Date().toISOString()
  console.log(`\n${'='.repeat(60)}`)
  console.log(`Deploying: ${network}`)
  console.log('='.repeat(60))

  // Step 1: Generate project
  console.log(`[1/3] Generating project for ${network}...`)
  const generateResult = runCommand(`npm run generate-project ${network}`)
  if (!generateResult.success) {
    console.log(`  ❌ Failed to generate project`)
    return {
      network,
      status: 'failed',
      error: `Generate failed: ${generateResult.output.slice(0, 500)}`,
      lastAttempt: now
    }
  }
  console.log(`  ✓ Project generated`)

  // Step 2: Build
  console.log(`[2/3] Building...`)
  const buildResult = runCommand('npm run build')
  if (!buildResult.success) {
    console.log(`  ❌ Failed to build`)
    return {
      network,
      status: 'failed',
      error: `Build failed: ${buildResult.output.slice(0, 500)}`,
      lastAttempt: now
    }
  }
  console.log(`  ✓ Build successful`)

  // Step 3: Deploy
  console.log(`[3/3] Deploying...`)
  const deployResult = runCommand('npm run deploy')
  if (!deployResult.success) {
    console.log(`  ❌ Failed to deploy`)
    return {
      network,
      status: 'failed',
      error: `Deploy failed: ${deployResult.output.slice(0, 500)}`,
      lastAttempt: now
    }
  }

  const cid = extractCid(deployResult.output)
  if (cid) {
    console.log(`  ✓ Deployed successfully`)
    console.log(`  CID: ${cid}`)
    return {
      network,
      status: 'success',
      cid,
      deployedAt: now,
      lastAttempt: now
    }
  } else {
    console.log(`  ⚠ Deploy completed but CID not found in output`)
    console.log(`  Output: ${deployResult.output.slice(0, 200)}...`)
    return {
      network,
      status: 'success',
      cid: 'unknown',
      deployedAt: now,
      lastAttempt: now,
      error: 'CID not found in output'
    }
  }
}

async function main() {
  const args = process.argv.slice(2)
  const forceAll = args.includes('--all') || args.includes('-a')
  const dryRun = args.includes('--dry-run') || args.includes('-d')
  const specificNetwork = args.find(arg => !arg.startsWith('-'))

  console.log('SubQuery Multi-Network Deploy Script')
  console.log('=====================================\n')

  // Load networks and status
  const allNetworks = loadNetworks()
  const deployStatus = loadDeployStatus()

  console.log(`Total networks: ${allNetworks.length}`)
  console.log(`Deploy status file: ${fs.existsSync(DEPLOY_STATUS_FILE) ? 'exists' : 'not found (will deploy all)'}`)

  // Determine which networks to deploy
  let networksToDeploy: string[]

  if (specificNetwork && allNetworks.includes(specificNetwork)) {
    networksToDeploy = [specificNetwork]
    console.log(`\nDeploying specific network: ${specificNetwork}`)
  } else if (forceAll) {
    networksToDeploy = allNetworks
    console.log(`\nForce deploying all networks`)
  } else {
    // Filter to only pending or failed networks
    networksToDeploy = allNetworks.filter(network => {
      const status = getNetworkStatus(deployStatus, network)
      return !status || status.status !== 'success'
    })
    console.log(`\nNetworks to deploy (pending/failed): ${networksToDeploy.length}`)
  }

  if (networksToDeploy.length === 0) {
    console.log('\nAll networks already deployed successfully!')
    console.log('Use --all to force redeploy all networks')
    return
  }

  console.log(`\nNetworks queued for deployment:`)
  networksToDeploy.forEach((n, i) => {
    const status = getNetworkStatus(deployStatus, n)
    const statusStr = status ? `[${status.status}]` : '[new]'
    console.log(`  ${i + 1}. ${n} ${statusStr}`)
  })

  if (dryRun) {
    console.log('\n--dry-run mode: No actual deployment will be performed')
    return
  }

  console.log(`\nStarting deployment...`)

  // Deploy each network
  let successCount = 0
  let failCount = 0

  for (const network of networksToDeploy) {
    const result = await deployNetwork(network)
    updateNetworkStatus(deployStatus, result)
    saveDeployStatus(deployStatus)

    if (result.status === 'success') {
      successCount++
    } else {
      failCount++
    }
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`)
  console.log('DEPLOYMENT SUMMARY')
  console.log('='.repeat(60))
  console.log(`Total: ${networksToDeploy.length}`)
  console.log(`Success: ${successCount}`)
  console.log(`Failed: ${failCount}`)

  if (failCount > 0) {
    console.log(`\nFailed networks:`)
    deployStatus.networks
      .filter(n => n.status === 'failed')
      .forEach(n => console.log(`  - ${n.network}: ${n.error?.slice(0, 100)}`))
  }

  console.log(`\nDeploy status saved to: ${DEPLOY_STATUS_FILE}`)

  // Show all CIDs
  const successNetworks = deployStatus.networks.filter(n => n.status === 'success' && n.cid)
  if (successNetworks.length > 0) {
    console.log(`\nDeployed CIDs:`)
    successNetworks.forEach(n => console.log(`  ${n.network}: ${n.cid}`))
  }
}

main().catch(console.error)
