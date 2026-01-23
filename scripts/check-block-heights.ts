import * as fs from 'fs'
import * as path from 'path'

interface ContractConfig {
  address: string
  startBlock: number
}

interface NetworkConfig {
  chainId: string
  endpoint: string
  PoolManager?: ContractConfig
  PositionManager?: ContractConfig
  EulerSwapFactory?: ContractConfig
  ArrakisHookFactory?: ContractConfig
}

interface NetworksConfig {
  [network: string]: NetworkConfig
}

interface BlockHeightResult {
  network: string
  chainId: string
  currentBlock: number | null
  startBlock: number
  blocksToSync: number | null
  error?: string
}

async function getCurrentBlockNumber(endpoint: string): Promise<number> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_blockNumber',
      params: [],
      id: 1,
    }),
  })

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const data = await response.json()

  if (data.error) {
    throw new Error(data.error.message || 'RPC error')
  }

  // Convert hex to decimal
  return parseInt(data.result, 16)
}

function getMinStartBlock(networkConfig: NetworkConfig): number {
  const startBlocks: number[] = []

  if (networkConfig.PoolManager) {
    startBlocks.push(networkConfig.PoolManager.startBlock)
  }
  if (networkConfig.PositionManager) {
    startBlocks.push(networkConfig.PositionManager.startBlock)
  }
  if (networkConfig.EulerSwapFactory) {
    startBlocks.push(networkConfig.EulerSwapFactory.startBlock)
  }
  if (networkConfig.ArrakisHookFactory) {
    startBlocks.push(networkConfig.ArrakisHookFactory.startBlock)
  }

  return startBlocks.length > 0 ? Math.min(...startBlocks) : 0
}

async function checkAllNetworks() {
  try {
    // Read networks.json
    const networksConfigPath = path.join(__dirname, '..', 'networks.json')
    const networksConfig: NetworksConfig = JSON.parse(fs.readFileSync(networksConfigPath, 'utf8'))

    console.log('Fetching current block heights for all networks...\n')

    const results: BlockHeightResult[] = []

    // Check each network
    for (const [networkName, networkConfig] of Object.entries(networksConfig)) {
      const startBlock = getMinStartBlock(networkConfig)

      try {
        const currentBlock = await getCurrentBlockNumber(networkConfig.endpoint)
        const blocksToSync = currentBlock - startBlock

        results.push({
          network: networkName,
          chainId: networkConfig.chainId,
          currentBlock,
          startBlock,
          blocksToSync,
        })

        console.log(`✓ ${networkName} (chainId: ${networkConfig.chainId})`)
      } catch (error) {
        results.push({
          network: networkName,
          chainId: networkConfig.chainId,
          currentBlock: null,
          startBlock,
          blocksToSync: null,
          error: error instanceof Error ? error.message : 'Unknown error',
        })

        console.log(`✗ ${networkName} (chainId: ${networkConfig.chainId}) - Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    // Sort results by blocks to sync (lowest first)
    const successfulResults = results.filter(r => r.currentBlock !== null)
    const failedResults = results.filter(r => r.currentBlock === null)

    successfulResults.sort((a, b) => {
      if (a.blocksToSync === null) return 1
      if (b.blocksToSync === null) return -1
      return a.blocksToSync - b.blocksToSync
    })

    // Display results table
    console.log('\n' + '='.repeat(100))
    console.log('BLOCK HEIGHT SUMMARY (sorted by blocks to sync)')
    console.log('='.repeat(100))
    console.log(
      'Network'.padEnd(25) +
      'Chain ID'.padEnd(15) +
      'Current Block'.padEnd(18) +
      'Start Block'.padEnd(18) +
      'Blocks to Sync'
    )
    console.log('-'.repeat(100))

    for (const result of successfulResults) {
      console.log(
        result.network.padEnd(25) +
        result.chainId.padEnd(15) +
        (result.currentBlock?.toLocaleString() || 'N/A').padEnd(18) +
        result.startBlock.toLocaleString().padEnd(18) +
        (result.blocksToSync?.toLocaleString() || 'N/A')
      )
    }

    if (failedResults.length > 0) {
      console.log('\n' + '='.repeat(100))
      console.log('FAILED NETWORKS')
      console.log('='.repeat(100))
      for (const result of failedResults) {
        console.log(`${result.network} (chainId: ${result.chainId}): ${result.error}`)
      }
    }

    console.log('\n' + '='.repeat(100))
    console.log(`Total networks: ${results.length}`)
    console.log(`Successful: ${successfulResults.length}`)
    console.log(`Failed: ${failedResults.length}`)
    console.log('='.repeat(100))

    // Show top 5 networks with lowest blocks to sync
    console.log('\nTOP 5 NETWORKS WITH LOWEST SYNC REQUIREMENTS:')
    console.log('-'.repeat(100))
    for (let i = 0; i < Math.min(5, successfulResults.length); i++) {
      const result = successfulResults[i]
      console.log(
        `${i + 1}. ${result.network.padEnd(25)} - ${result.blocksToSync?.toLocaleString()} blocks to sync`
      )
    }

  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

checkAllNetworks()
