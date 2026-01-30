import { NativeTokenDetails } from './nativeTokenDetails'
import { StaticTokenDefinition } from './staticTokenDefinition'
import { NetworkName } from './network-types'
import { RUNTIME_NETWORK, RUNTIME_CHAIN_ID } from './runtime-config'

// Re-export NetworkName for backward compatibility
export { NetworkName }

// Chain ID to network name mapping
const CHAIN_ID_TO_NETWORK: Record<string, NetworkName> = {
  '1': NetworkName.MAINNET,
  '11155111': NetworkName.SEPOLIA,
  '42161': NetworkName.ARBITRUM_ONE,
  '421614': NetworkName.ARBITRUM_SEPOLIA,
  '8453': NetworkName.BASE,
  '84532': NetworkName.BASE_SEPOLIA,
  '137': NetworkName.POLYGON,
  '56': NetworkName.BSC,
  '10': NetworkName.OPTIMISM,
  '43114': NetworkName.AVALANCHE,
  '480': NetworkName.WORLDCHAIN,
  '7777777': NetworkName.ZORA,
  '81457': NetworkName.BLAST,
  '130': NetworkName.UNICHAIN,
  '1301': NetworkName.UNICHAIN_SEPOLIA,
  '1868': NetworkName.SONEIUM,
  '42220': NetworkName.CELO,
  '143': NetworkName.MONAD,
  '196': NetworkName.XLAYER,
  '4326': NetworkName.MEGAETH,
}

// Configuration interface for SubQuery
export interface SubqueryConfig {
  // Deployment address of PoolManager
  poolManagerAddress: string

  // The address of a pool where one token is a stablecoin and the other is wrapped native
  // Used to calculate the price of the native token
  stablecoinWrappedNativePoolId: string

  // true if stablecoin is token0, false if stablecoin is token1
  stablecoinIsToken0: boolean

  // The address of wrapped native token (e.g., WETH)
  wrappedNativeAddress: string

  // Minimum liquidity (in native token) needed for a pool to help calculate token prices
  minimumNativeLocked: number

  // List of stablecoin addresses
  stablecoinAddresses: string[]

  // A token must be in a pool with one of these tokens to derive a price
  // Also used to determine whether volume is tracked or not
  whitelistTokens: string[]

  // Token overrides for RPC calls (symbol, name, decimals)
  tokenOverrides: StaticTokenDefinition[]

  // Skip creation of these pools in handleInitialize
  poolsToSkip: string[]

  // Native token details for the chain
  nativeTokenDetails: NativeTokenDetails
}

// Helper function to convert address to lowercase for consistency
export const toLower = (address: string): string => address.toLowerCase()

// Helper function to normalize all addresses in config to lowercase
// This ensures consistency throughout the application
function normalizeConfig(config: SubqueryConfig): SubqueryConfig {
  return {
    ...config,
    poolManagerAddress: config.poolManagerAddress.toLowerCase(),
    stablecoinWrappedNativePoolId: config.stablecoinWrappedNativePoolId.toLowerCase(),
    wrappedNativeAddress: config.wrappedNativeAddress.toLowerCase(),
    stablecoinAddresses: config.stablecoinAddresses.map(addr => addr.toLowerCase()),
    whitelistTokens: config.whitelistTokens.map(addr => addr.toLowerCase()),
    poolsToSkip: config.poolsToSkip.map(addr => addr.toLowerCase()),
  }
}

// Mainnet configuration
const MAINNET_CONFIG: SubqueryConfig = {
  poolManagerAddress: '0x000000000004444c5dc75cB358380D2e3dE08A90',
  stablecoinWrappedNativePoolId: '0x4f88f7c99022eace4740c6898f59ce6a2e798a1e64ce54589720b7153eb224a7', // DAI/WETH 0.01%
  stablecoinIsToken0: true,
  wrappedNativeAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH
  minimumNativeLocked: 1,
  stablecoinAddresses: [
    '0x6b175474e89094c44da98b954eedeac495271d0f', // DAI
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
    '0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT
    '0x0000000000085d4780b73119b644ae5ecd22b376', // TUSD
    '0x956f47f50a910163d8bf957cf5846d573e7f87ca', // FEI
  ],
  whitelistTokens: [
    '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH
    '0x6b175474e89094c44da98b954eedeac495271d0f', // DAI
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
    '0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT
    '0x0000000000085d4780b73119b644ae5ecd22b376', // TUSD
    '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', // WBTC
    '0x5d3a536e4d6dbd6114cc1ead35777bab948e3643', // cDAI
    '0x39aa39c021dfbae8fac545936693ac917d5e7563', // cUSDC
    '0x86fadb80d8d2cff3c3680819e4da99c10232ba0f', // EBASE
    '0x57ab1ec28d129707052df4df418d58a2d46d5f51', // sUSD
    '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2', // MKR
    '0xc00e94cb662c3520282e6f5717214004a7f26888', // COMP
    '0x514910771af9ca656af840dff83e8264ecf986ca', // LINK
    '0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f', // SNX
    '0x0bc529c00c6401aef6d220be8c6ea1667f6ad93e', // YFI
    '0x111111111117dc0aa78b770fa6a738034120c302', // 1INCH
    '0xdf5e0e81dff6faf3a7e52ba697820c5e32d806a8', // yCurv
    '0x956f47f50a910163d8bf957cf5846d573e7f87ca', // FEI
    '0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0', // MATIC
    '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9', // AAVE
    '0xfe2e637202056d30016725477c5da089ab0a043a', // sETH2
    '0x0000000000000000000000000000000000000000', // Native ETH
  ],
  tokenOverrides: [
    new StaticTokenDefinition(
      '0xe0b7927c4af23765cb51314a0e0521a9645f0e2a',
      'DGD',
      'DGD',
      BigInt(9)
    ),
    new StaticTokenDefinition(
      '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9',
      'AAVE',
      'Aave Token',
      BigInt(18)
    ),
    new StaticTokenDefinition(
      '0xeb9951021698b42e4399f9cbb6267aa35f82d59d',
      'LIF',
      'Lif',
      BigInt(18)
    ),
    new StaticTokenDefinition(
      '0xbdeb4b83251fb146687fa19d1c6e3398b189413',
      'SVD',
      'savedroid',
      BigInt(18)
    ),
    new StaticTokenDefinition(
      '0xbb9bc244d798123fde783fcc1c72d3bb8c189413',
      'TheDAO',
      'TheDAO',
      BigInt(16)
    ),
    new StaticTokenDefinition(
      '0x38c6a68304cdefb9bec48bbfaaba5c5b47818bb2',
      'HPB',
      'HPBCoin',
      BigInt(18)
    ),
  ],
  poolsToSkip: [],
  nativeTokenDetails: new NativeTokenDetails('ETH', 'Ethereum', BigInt(18)),
}

// Sepolia testnet configuration
const SEPOLIA_CONFIG: SubqueryConfig = {
  poolManagerAddress: '0xe03a1074c86cfedd5c142c4f04f1a1536e203543',
  stablecoinWrappedNativePoolId: '0xabdb9820d36431e092c155f7151c4c781f09fb4e1b7894fa918a0aadcac87e16',
  stablecoinIsToken0: true,
  wrappedNativeAddress: '0xfff9976782d46cc05630d1f6ebab18b2324d6b14', // WETH
  minimumNativeLocked: 1,
  stablecoinAddresses: [
    '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238', // USDC
    '0xaa8e23fb1079ea71e0a56f48a2aa51851d8433d0', // USDT
  ],
  whitelistTokens: [
    '0x0000000000000000000000000000000000000000', // Native ETH
    '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238', // USDC
    '0xaa8e23fb1079ea71e0a56f48a2aa51851d8433d0', // USDT
    '0xfff9976782d46cc05630d1f6ebab18b2324d6b14', // WETH
  ],
  tokenOverrides: [],
  poolsToSkip: [],
  nativeTokenDetails: new NativeTokenDetails('ETH', 'Ethereum', BigInt(18)),
}

// Arbitrum One configuration
const ARBITRUM_ONE_CONFIG: SubqueryConfig = {
  poolManagerAddress: '0x360e68faccca8ca495c1b759fd9eee466db9fb32',
  stablecoinWrappedNativePoolId: '0xfc7b3ad139daaf1e9c3637ed921c154d1b04286f8a82b805a6c352da57028653',
  stablecoinIsToken0: false,
  wrappedNativeAddress: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1', // WETH
  minimumNativeLocked: 1,
  stablecoinAddresses: [
    '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8', // USDC.e
    '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1', // DAI
    '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9', // USDT
    '0xaf88d065e77c8cc2239327c5edb3a432268e5831', // USDC
  ],
  whitelistTokens: [
    '0x82af49447d8a07e3bd95bd0d56f35241523fbab1', // WETH
    '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8', // USDC.e
    '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1', // DAI
    '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9', // USDT
    '0xaf88d065e77c8cc2239327c5edb3a432268e5831', // USDC
    '0x0000000000000000000000000000000000000000', // Native ETH
  ],
  tokenOverrides: [
    new StaticTokenDefinition(
      '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
      'WETH',
      'Wrapped Ethereum',
      BigInt(18)
    ),
    new StaticTokenDefinition(
      '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8',
      'USDC',
      'USD Coin',
      BigInt(6)
    ),
  ],
  poolsToSkip: [],
  nativeTokenDetails: new NativeTokenDetails('ETH', 'Ethereum', BigInt(18)),
}

// Base configuration
const BASE_CONFIG: SubqueryConfig = {
  poolManagerAddress: '0x498581ff718922c3f8e6a244956af099b2652b2b',
  stablecoinWrappedNativePoolId: '0x90333bb05c258fe0dddb2840ef66f1a05165aa7dac6815d24e807cc6ebd943a0',
  stablecoinIsToken0: false,
  wrappedNativeAddress: '0x4200000000000000000000000000000000000006', // WETH
  minimumNativeLocked: 1,
  stablecoinAddresses: [
    '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // USDC
  ],
  whitelistTokens: [
    '0x4200000000000000000000000000000000000006', // WETH
    '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // USDC
    '0x0000000000000000000000000000000000000000', // Native ETH
    '0x1111111111166b7fe7bd91427724b487980afc69', // ZORA
  ],
  tokenOverrides: [],
  poolsToSkip: [],
  nativeTokenDetails: new NativeTokenDetails('ETH', 'Ethereum', BigInt(18)),
}

// Polygon configuration
const POLYGON_CONFIG: SubqueryConfig = {
  poolManagerAddress: '0x67366782805870060151383f4bbff9dab53e5cd6',
  stablecoinWrappedNativePoolId: '0x15484bc239f7554e7ead77c45834c722d3f74a9b20826fdf21bbb1b026444286',
  stablecoinIsToken0: false,
  wrappedNativeAddress: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270', // WMATIC
  minimumNativeLocked: 20000,
  stablecoinAddresses: [
    '0x2791bca1f2de4661ed88a30c99a7a9449aa84174', // USDC.e
    '0x8f3cf7ad23cd3cadbd9735aff958023239c6a063', // DAI
    '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359', // USDC
  ],
  whitelistTokens: [
    '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270', // WMATIC
    '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619', // WETH
    '0x2791bca1f2de4661ed88a30c99a7a9449aa84174', // USDC.e
    '0x8f3cf7ad23cd3cadbd9735aff958023239c6a063', // DAI
    '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359', // USDC
    '0x0000000000000000000000000000000000000000', // Native POL
  ],
  tokenOverrides: [],
  poolsToSkip: [],
  nativeTokenDetails: new NativeTokenDetails('POL', 'Polygon', BigInt(18)),
}

// BSC configuration
const BSC_CONFIG: SubqueryConfig = {
  poolManagerAddress: '0x28e2ea090877bf75740558f6bfb36a5ffee9e9df',
  stablecoinWrappedNativePoolId: '0x4c9dff5169d88f7fbf5e43fc8e2eb56bf9791785729b9fc8c22064a47af12052',
  stablecoinIsToken0: true,
  wrappedNativeAddress: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c', // WBNB
  minimumNativeLocked: 10,
  stablecoinAddresses: [
    '0x55d398326f99059ff775485246999027b3197955', // USDT
    '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', // USDC
  ],
  whitelistTokens: [
    '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c', // WBNB
    '0x55d398326f99059ff775485246999027b3197955', // USDT
    '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', // USDC
    '0x0000000000000000000000000000000000000000', // Native BNB
  ],
  tokenOverrides: [],
  poolsToSkip: [],
  nativeTokenDetails: new NativeTokenDetails('BNB', 'Binance Coin', BigInt(18)),
}

// Optimism configuration
const OPTIMISM_CONFIG: SubqueryConfig = {
  poolManagerAddress: '0x9a13f98cb987694c9f086b1f5eb990eea8264ec3',
  stablecoinWrappedNativePoolId: '0xedba0a2a9dc73acf4b130e07605cb4c212bbd98a31c9cd442cfb8cf5b4e093e7',
  stablecoinIsToken0: true,
  wrappedNativeAddress: '0x4200000000000000000000000000000000000006', // WETH
  minimumNativeLocked: 1,
  stablecoinAddresses: [
    '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1', // DAI
    '0x7f5c764cbc14f9669b88837ca1490cca17c31607', // USDC.e
    '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58', // USDT
    '0x0b2c639c533813f4aa9d7837caf62653d097ff85', // USDC
  ],
  whitelistTokens: [
    '0x4200000000000000000000000000000000000006', // WETH
    '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1', // DAI
    '0x7f5c764cbc14f9669b88837ca1490cca17c31607', // USDC.e
    '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58', // USDT
    '0x4200000000000000000000000000000042', // OP
    '0x9e1028f5f1d5ede59748ffcee5532509976840e0', // PERP
    '0x50c5725949a6f0c72e6c4a641f24049a917db0cb', // LYRA
    '0x68f180fcce6836688e9084f035309e29bf0a2095', // WBTC
    '0x0b2c639c533813f4aa9d7837caf62653d097ff85', // USDC
    '0x0000000000000000000000000000000000000000', // Native ETH
  ],
  tokenOverrides: [
    new StaticTokenDefinition(
      '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
      'WETH',
      'Wrapped Ethereum',
      BigInt(18)
    ),
  ],
  poolsToSkip: [],
  nativeTokenDetails: new NativeTokenDetails('ETH', 'Ethereum', BigInt(18)),
}

// Avalanche configuration
const AVALANCHE_CONFIG: SubqueryConfig = {
  poolManagerAddress: '0x06380c0e0912312b5150364b9dc4542ba0dbbc85',
  stablecoinWrappedNativePoolId: '0xd7a8035ddd9ec1dba25e3b27b685927fe63d65281f21c1c1d21d122fc48caeb7',
  stablecoinIsToken0: false,
  wrappedNativeAddress: '0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7', // WAVAX
  minimumNativeLocked: 100,
  stablecoinAddresses: [
    '0xd586e7f844cea2f87f50152665bcbc2c279d8d70', // DAI_E
    '0xba7deebbfc5fa1100fb055a87773e1e99cd3507a', // DAI
    '0xa7d7079b0fead91f3e65f86e8915cb59c1a4c664', // USDC_E
    '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e', // USDC
    '0xc7198437980c041c805a1edcba50c1ce5db95118', // USDT_E
    '0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7', // USDT
  ],
  whitelistTokens: [
    '0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7', // WAVAX
    '0xd586e7f844cea2f87f50152665bcbc2c279d8d70', // DAI_E
    '0xba7deebbfc5fa1100fb055a87773e1e99cd3507a', // DAI
    '0xa7d7079b0fead91f3e65f86e8915cb59c1a4c664', // USDC_E
    '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e', // USDC
    '0xc7198437980c041c805a1edcba50c1ce5db95118', // USDT_E
    '0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7', // USDT
    '0x130966628846bfd36ff31a822705796e8cb8c18d', // MIM
    '0x0000000000000000000000000000000000000000', // Native AVAX
  ],
  tokenOverrides: [],
  poolsToSkip: [],
  nativeTokenDetails: new NativeTokenDetails('AVAX', 'Avalanche', BigInt(18)),
}

// Placeholder configs for networks that may not have full V4 deployment yet
// These can be updated when pools become available
const createPlaceholderConfig = (poolManagerAddress: string, nativeSymbol: string, nativeName: string): SubqueryConfig => ({
  poolManagerAddress,
  stablecoinWrappedNativePoolId: '', // No pool available yet
  stablecoinIsToken0: true,
  wrappedNativeAddress: '0x0000000000000000000000000000000000000000',
  minimumNativeLocked: 1,
  stablecoinAddresses: [],
  whitelistTokens: [],
  tokenOverrides: [],
  poolsToSkip: [],
  nativeTokenDetails: new NativeTokenDetails(nativeSymbol, nativeName, BigInt(18)),
})

const ARBITRUM_SEPOLIA_CONFIG = createPlaceholderConfig(
  '0xfb3e0c6f74eb1a21cc1da29aec80d2dfe6c9a317',
  'ETH',
  'Ethereum'
)

const BASE_SEPOLIA_CONFIG = createPlaceholderConfig(
  '0x05e73354cfdd6745c338b50bcfdfa3aa6fa03408',
  'ETH',
  'Ethereum'
)

const WORLDCHAIN_CONFIG = createPlaceholderConfig(
  '0xb1860d529182ac3bc1f51fa2abd56662b7d13f33',
  'ETH',
  'Ethereum'
)

const ZORA_CONFIG = createPlaceholderConfig(
  '0x0575338e4c17006ae181b47900a84404247ca30f',
  'ETH',
  'Ethereum'
)

const BLAST_CONFIG = createPlaceholderConfig(
  '0x1631559198a9e474033433b2958dabc135ab6446',
  'ETH',
  'Ethereum'
)

const UNICHAIN_CONFIG = createPlaceholderConfig(
  '0x1f98400000000000000000000000000000000004',
  'ETH',
  'Ethereum'
)

const UNICHAIN_SEPOLIA_CONFIG = createPlaceholderConfig(
  '0x00b036b58a818b1bc34d502d3fe730db729e62ac',
  'ETH',
  'Ethereum'
)

const SONEIUM_CONFIG = createPlaceholderConfig(
  '0x360e68faccca8ca495c1b759fd9eee466db9fb32',
  'ETH',
  'Ethereum'
)

const CELO_CONFIG = createPlaceholderConfig(
  '0x288dc841a52fca2707c6947b3a777c5e56cd87bc',
  'CELO',
  'Celo'
)

const MONAD_CONFIG = createPlaceholderConfig(
  '0x188d586ddcf52439676ca21a244753fa19f9ea8e',
  'MON',
  'MON'
)

const XLAYER_CONFIG = createPlaceholderConfig(
  '0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32',
  'OKB',
  'OKB'
)

const MEGAETH_CONFIG = createPlaceholderConfig(
  '0x58dd83c317b03e6ebd72c3e912adf60a8e97aa95',
  'ETH',
  'Ethereum'
)

// Module-level flag to ensure we only log config once
let configLogged = false

// Mapping of network to config
const NETWORK_CONFIGS: Record<NetworkName, SubqueryConfig> = {
  [NetworkName.MAINNET]: MAINNET_CONFIG,
  [NetworkName.SEPOLIA]: SEPOLIA_CONFIG,
  [NetworkName.ARBITRUM_ONE]: ARBITRUM_ONE_CONFIG,
  [NetworkName.ARBITRUM_SEPOLIA]: ARBITRUM_SEPOLIA_CONFIG,
  [NetworkName.BASE]: BASE_CONFIG,
  [NetworkName.BASE_SEPOLIA]: BASE_SEPOLIA_CONFIG,
  [NetworkName.POLYGON]: POLYGON_CONFIG,
  [NetworkName.BSC]: BSC_CONFIG,
  [NetworkName.OPTIMISM]: OPTIMISM_CONFIG,
  [NetworkName.AVALANCHE]: AVALANCHE_CONFIG,
  [NetworkName.WORLDCHAIN]: WORLDCHAIN_CONFIG,
  [NetworkName.ZORA]: ZORA_CONFIG,
  [NetworkName.BLAST]: BLAST_CONFIG,
  [NetworkName.UNICHAIN]: UNICHAIN_CONFIG,
  [NetworkName.UNICHAIN_SEPOLIA]: UNICHAIN_SEPOLIA_CONFIG,
  [NetworkName.SONEIUM]: SONEIUM_CONFIG,
  [NetworkName.CELO]: CELO_CONFIG,
  [NetworkName.MONAD]: MONAD_CONFIG,
  [NetworkName.XLAYER]: XLAYER_CONFIG,
  [NetworkName.MEGAETH]: MEGAETH_CONFIG,
}

/**
 * Get the configuration for the current chain.
 * In SubQuery, the chain ID is specified in project.yaml under network.chainId
 *
 * For development/testing, you can pass a specific chainId or network name.
 * Otherwise, it uses the runtime configuration from the auto-generated runtime-config.ts.
 */
export function getConfig(chainId?: string, network?: NetworkName): SubqueryConfig {
  let selectedConfig: SubqueryConfig
  let selectedNetworkName: NetworkName

  // If network is explicitly provided, use it
  if (network && NETWORK_CONFIGS[network]) {
    selectedConfig = NETWORK_CONFIGS[network]
    selectedNetworkName = network
  }
  // If chainId is provided, map to network
  else if (chainId && CHAIN_ID_TO_NETWORK[chainId]) {
    selectedNetworkName = CHAIN_ID_TO_NETWORK[chainId]
    selectedConfig = NETWORK_CONFIGS[selectedNetworkName]
  }
  // Use runtime configuration (from auto-generated file)
  else if (RUNTIME_NETWORK && NETWORK_CONFIGS[RUNTIME_NETWORK]) {
    selectedConfig = NETWORK_CONFIGS[RUNTIME_NETWORK]
    selectedNetworkName = RUNTIME_NETWORK
  }
  // Fallback to mainnet (should never reach here in production)
  else {
    selectedConfig = NETWORK_CONFIGS[NetworkName.MAINNET]
    selectedNetworkName = NetworkName.MAINNET
  }

  // Log which configuration is being used (only on first call)
  if (!configLogged) {
    logger.info(`Using SubQuery configuration for network: ${selectedNetworkName} (chainId: ${RUNTIME_CHAIN_ID})`)
    configLogged = true
  }

  // Normalize all addresses to lowercase for consistency
  return normalizeConfig(selectedConfig)
}

// Export default config (mainnet) for convenience
export const DEFAULT_CONFIG = MAINNET_CONFIG

// Export chainId to network mapping for external use
export { CHAIN_ID_TO_NETWORK }
