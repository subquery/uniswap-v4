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

// Complete mapping from networks.json keys to NetworkName enum constants
// This ensures explicit, type-safe mapping for all supported networks
const NETWORK_KEY_TO_ENUM_NAME: Record<string, string> = {
  'mainnet': 'MAINNET',
  'sepolia': 'SEPOLIA',
  'arbitrum-one': 'ARBITRUM_ONE',
  'arbitrum-sepolia': 'ARBITRUM_SEPOLIA',
  'base': 'BASE',
  'base-sepolia': 'BASE_SEPOLIA',
  'matic': 'POLYGON',
  'bsc': 'BSC',
  'optimism': 'OPTIMISM',
  'avalanche': 'AVALANCHE',
  'worldchain-mainnet': 'WORLDCHAIN',
  'zora-mainnet': 'ZORA',
  'blast-mainnet': 'BLAST',
  'unichain': 'UNICHAIN',
  'unichain-sepolia': 'UNICHAIN_SEPOLIA',
  'soneium-mainnet': 'SONEIUM',
  'celo': 'CELO',
  'monad': 'MONAD',
  'xlayer-mainnet': 'XLAYER',
  'megaeth-mainnet': 'MEGAETH',
}

// Convert network key to NetworkName enum constant
// Uses explicit mapping to ensure all networks are accounted for
function networkKeyToEnumName(networkKey: string): string {
  const enumName = NETWORK_KEY_TO_ENUM_NAME[networkKey]

  if (!enumName) {
    throw new Error(
      `Unknown network key: "${networkKey}". ` +
      `Please add it to NETWORK_KEY_TO_ENUM_NAME mapping in scripts/generate-project.ts`
    )
  }

  return enumName
}

// Generate datasource for PoolManager
function generatePoolManagerDataSource(config: ContractConfig) {
  return `    {
      kind: EthereumDatasourceKind.Runtime,
      startBlock: ${config.startBlock},
      options: {
        abi: "PoolManager",
        address: "${config.address}",
      },
      assets: new Map([
        ["ERC20", { file: "./abis/ERC20.json" }],
        ["ERC20SymbolBytes", { file: "./abis/ERC20SymbolBytes.json" }],
        ["ERC20NameBytes", { file: "./abis/ERC20NameBytes.json" }],
        ["PoolManager", { file: "./abis/PoolManager.json" }],
        // Include all Hook ABIs for type generation
        ["EulerSwapFactory", { file: "./abis/EulerSwapFactory.json" }],
        ["ArrakisHookFactory", { file: "./abis/ArrakisHookFactory.json" }],
      ]),
      mapping: {
        file: "./dist/index.js",
        handlers: [
          {
            kind: EthereumHandlerKind.Event,
            handler: "handleInitialize",
            filter: {
              topics: [
                "Initialize(bytes32,address,address,uint24,int24,address,uint160,int24)",
              ],
            },
          },
          {
            kind: EthereumHandlerKind.Event,
            handler: "handleModifyLiquidity",
            filter: {
              topics: [
                "ModifyLiquidity(bytes32,address,int24,int24,int256,bytes32)",
              ],
            },
          },
          {
            kind: EthereumHandlerKind.Event,
            handler: "handleSwap",
            filter: {
              topics: [
                "Swap(bytes32,address,int128,int128,uint160,uint128,int24,uint24)",
              ],
            },
          },
        ],
      },
    }`
}

// Generate datasource for PositionManager
function generatePositionManagerDataSource(config: ContractConfig) {
  return `    {
      kind: EthereumDatasourceKind.Runtime,
      startBlock: ${config.startBlock},
      options: {
        abi: "PositionManager",
        address: "${config.address}",
      },
      assets: new Map([
        ["PositionManager", { file: "./abis/PositionManager.json" }],
      ]),
      mapping: {
        file: "./dist/index.js",
        handlers: [
          {
            kind: EthereumHandlerKind.Event,
            handler: "handleSubscription",
            filter: { topics: ["Subscription(uint256,address)"] },
          },
          {
            kind: EthereumHandlerKind.Event,
            handler: "handleUnsubscription",
            filter: { topics: ["Unsubscription(uint256,address)"] },
          },
          {
            kind: EthereumHandlerKind.Event,
            handler: "handleTransfer",
            filter: { topics: ["Transfer(address,address,uint256)"] },
          },
        ],
      },
    }`
}

// Generate datasource for EulerSwapFactory
function generateEulerSwapFactoryDataSource(config: ContractConfig) {
  return `    {
      kind: EthereumDatasourceKind.Runtime,
      startBlock: ${config.startBlock},
      options: {
        abi: "EulerSwapFactory",
        address: "${config.address}",
      },
      assets: new Map([
        ["EulerSwapFactory", { file: "./abis/EulerSwapFactory.json" }],
      ]),
      mapping: {
        file: "./dist/index.js",
        handlers: [
          {
            kind: EthereumHandlerKind.Event,
            handler: "handleHookDeployed",
            filter: {
              topics: ["PoolDeployed(address,address,address,address)"],
            },
          },
          {
            kind: EthereumHandlerKind.Event,
            handler: "handleHookUninstalled",
            filter: {
              topics: ["PoolUninstalled(address,address,address,address)"],
            },
          },
        ],
      },
    }`
}

// Generate datasource for ArrakisHookFactory
function generateArrakisHookFactoryDataSource(config: ContractConfig) {
  return `    {
      kind: EthereumDatasourceKind.Runtime,
      startBlock: ${config.startBlock},
      options: {
        abi: "ArrakisHookFactory",
        address: "${config.address}",
      },
      assets: new Map([
        ["ArrakisHookFactory", { file: "./abis/ArrakisHookFactory.json" }],
      ]),
      mapping: {
        file: "./dist/index.js",
        handlers: [
          {
            kind: EthereumHandlerKind.Event,
            handler: "handleArrakisHookDeployed",
            filter: {
              topics: ["LogCreatePrivateHook(address,address,bytes32)"],
            },
          },
        ],
      },
    }`
}

function generateRuntimeConfig(network: string, networkConfig: NetworkConfig): string {
  const enumName = networkKeyToEnumName(network)
  return `// Auto-generated by scripts/generate-project.ts for network: ${network}
// Do not edit manually. Run: npm run generate-project ${network}

import { NetworkName } from './network-types'

/**
 * The network name for this deployment.
 * This is set at build time based on the network specified during project generation.
 */
export const RUNTIME_NETWORK: NetworkName = NetworkName.${enumName}

/**
 * The chain ID for this deployment.
 * This is set at build time based on the network specified during project generation.
 */
export const RUNTIME_CHAIN_ID = '${networkConfig.chainId}'
`
}

function generateProjectTs(network: string, networkConfig: NetworkConfig): string {
  const dataSources: string[] = []

  if (networkConfig.PoolManager) {
    dataSources.push(generatePoolManagerDataSource(networkConfig.PoolManager))
  }

  if (networkConfig.PositionManager) {
    dataSources.push(generatePositionManagerDataSource(networkConfig.PositionManager))
  }

  if (networkConfig.EulerSwapFactory) {
    dataSources.push(generateEulerSwapFactoryDataSource(networkConfig.EulerSwapFactory))
  }

  if (networkConfig.ArrakisHookFactory) {
    dataSources.push(generateArrakisHookFactoryDataSource(networkConfig.ArrakisHookFactory))
  }

  return `// Auto-generated by scripts/generate-project.ts for network: ${network}
// Do not edit manually. Run: npm run generate-project ${network}

import {
  EthereumProject,
  EthereumDatasourceKind,
  EthereumHandlerKind,
} from "@subql/types-ethereum";

const project: EthereumProject = {
  specVersion: "1.0.0",
  version: "0.0.4",
  name: "uniswap-v4-subquery-${network}",
  description:
    "Uniswap V4 SubQuery indexer for ${network}",
  runner: {
    node: {
      name: "@subql/node-ethereum",
      version: ">=6.0.0",
    },
    query: {
      name: "@subql/query",
      version: "*",
    },
  },
  schema: {
    file: "./schema.graphql",
  },
  network: {
    chainId: "${networkConfig.chainId}",
    endpoint: ["${networkConfig.endpoint}"],
  },
  dataSources: [
${dataSources.join(',\n')}
  ],
  repository: "https://github.com/subquery/uniswap-v4",
};

export default project;
`
}

function main() {
  try {
    const network = process.argv[2]
    if (!network) {
      console.error('Please provide a network name as an argument')
      console.error('Usage: npm run generate-project <network>')
      console.error('')

      // Read networks.json and list available networks
      const networksConfigPath = path.join(__dirname, '..', 'networks.json')
      const networksConfig: NetworksConfig = JSON.parse(fs.readFileSync(networksConfigPath, 'utf8'))
      console.error('Available networks:', Object.keys(networksConfig).join(', '))
      process.exit(1)
    }

    // Read networks.json
    const networksConfigPath = path.join(__dirname, '..', 'networks.json')
    const networksConfig: NetworksConfig = JSON.parse(fs.readFileSync(networksConfigPath, 'utf8'))

    // Check if network exists
    if (!networksConfig[network]) {
      console.error(`Network "${network}" not found in networks.json`)
      console.error('Available networks:', Object.keys(networksConfig).join(', '))
      process.exit(1)
    }

    // Generate project.ts content
    const projectContent = generateProjectTs(network, networksConfig[network])

    // Write to project.ts
    const projectTsPath = path.join(__dirname, '..', 'project.ts')
    fs.writeFileSync(projectTsPath, projectContent, 'utf8')

    // Generate and write runtime-config.ts
    const runtimeConfigContent = generateRuntimeConfig(network, networksConfig[network])
    const runtimeConfigPath = path.join(__dirname, '..', 'src', 'utils', 'runtime-config.ts')
    fs.writeFileSync(runtimeConfigPath, runtimeConfigContent, 'utf8')

    console.log(`Successfully generated project.ts and runtime-config.ts for network: ${network}`)
    console.log(`Chain ID: ${networksConfig[network].chainId}`)
    console.log(`Endpoint: ${networksConfig[network].endpoint}`)
    console.log('')
    console.log('Data sources:')
    if (networksConfig[network].PoolManager) {
      console.log(`  - PoolManager: ${networksConfig[network].PoolManager.address} (block ${networksConfig[network].PoolManager.startBlock})`)
    }
    if (networksConfig[network].PositionManager) {
      console.log(`  - PositionManager: ${networksConfig[network].PositionManager.address} (block ${networksConfig[network].PositionManager.startBlock})`)
    }
    if (networksConfig[network].EulerSwapFactory) {
      console.log(`  - EulerSwapFactory: ${networksConfig[network].EulerSwapFactory.address} (block ${networksConfig[network].EulerSwapFactory.startBlock})`)
    }
    if (networksConfig[network].ArrakisHookFactory) {
      console.log(`  - ArrakisHookFactory: ${networksConfig[network].ArrakisHookFactory.address} (block ${networksConfig[network].ArrakisHookFactory.startBlock})`)
    }
    console.log('')
    console.log('Next steps:')
    console.log('  1. npm run build')
    console.log('  2. npm run start:docker')
  } catch (error) {
    console.error('Error generating project.ts:', error)
    process.exit(1)
  }
}

main()
