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

interface ChainIdCheckResult {
  network: string
  expectedChainId: string
  actualChainId: string | null
  match: boolean
  error?: string
}

async function getChainId(endpoint: string): Promise<string | null> {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_chainId',
        params: [],
        id: 1,
      }),
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json()

    if (data.error) {
      return null
    }

    // Convert hex to decimal string
    return parseInt(data.result, 16).toString()
  } catch (error) {
    return null
  }
}

async function checkAllChainIds() {
  try {
    // Read networks.json
    const networksConfigPath = path.join(__dirname, '..', 'networks.json')
    const networksConfig: NetworksConfig = JSON.parse(fs.readFileSync(networksConfigPath, 'utf8'))

    console.log('Checking Chain IDs for all networks...\n')

    const results: ChainIdCheckResult[] = []

    // Check each network
    for (const [networkName, networkConfig] of Object.entries(networksConfig)) {
      const expectedChainId = networkConfig.chainId
      const actualChainId = await getChainId(networkConfig.endpoint)

      const match = actualChainId === expectedChainId

      results.push({
        network: networkName,
        expectedChainId,
        actualChainId,
        match: actualChainId !== null && match,
        error: actualChainId === null ? 'Failed to fetch chain ID' : undefined,
      })

      const status = actualChainId === null ? '❌ ERROR' : match ? '✓ OK' : '❌ MISMATCH'
      console.log(
        `${networkName.padEnd(25)} Expected: ${expectedChainId.padEnd(12)} Actual: ${
          (actualChainId || 'N/A').padEnd(12)
        } ${status}`
      )
    }

    // Summary
    const mismatches = results.filter(r => r.actualChainId !== null && !r.match)
    const errors = results.filter(r => r.actualChainId === null)

    console.log('\n' + '='.repeat(80))
    console.log('SUMMARY')
    console.log('='.repeat(80))
    console.log(`Total networks: ${results.length}`)
    console.log(`Matching: ${results.filter(r => r.match).length}`)
    console.log(`Mismatches: ${mismatches.length}`)
    console.log(`Errors: ${errors.length}`)

    if (mismatches.length > 0) {
      console.log('\n' + '='.repeat(80))
      console.log('CHAIN ID MISMATCHES:')
      console.log('='.repeat(80))
      for (const result of mismatches) {
        console.log(
          `${result.network}: Expected ${result.expectedChainId}, but got ${result.actualChainId}`
        )
      }
    }

    if (errors.length > 0) {
      console.log('\n' + '='.repeat(80))
      console.log('NETWORKS WITH ERRORS:')
      console.log('='.repeat(80))
      for (const result of errors) {
        console.log(`${result.network}: ${result.error}`)
      }
    }

    if (mismatches.length === 0 && errors.length === 0) {
      console.log('\n✓ All chain IDs match correctly!')
    }

    console.log('='.repeat(80))
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

checkAllChainIds()
