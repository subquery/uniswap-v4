import { InitializeLog } from '../types/abi-interfaces/PoolManager'
import { PoolManager, Bundle, Pool, Token } from '../types'
import { ADDRESS_ZERO, ONE_BI, ZERO_BD, ZERO_BI } from '../utils/constants'
import { findNativePerToken, getNativePriceInUSD, sqrtPriceX96ToTokenPrices } from '../utils/pricing'
import { fetchTokenDecimals, fetchTokenName, fetchTokenSymbol, fetchTokenTotalSupply } from '../utils/token'
import { NativeTokenDetails } from '../utils/nativeTokenDetails'
import { StaticTokenDefinition } from '../utils/staticTokenDefinition'

// Simplified config for mainnet - can be expanded later
const MAINNET_CONFIG = {
  poolManagerAddress: '0x000000000004444c5dc75cB358380D2e3dE08A90',
  whitelistTokens: [
    '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
    '0xA0b86a33E6817Fd2Dd1f44e1e71eeEe5E4bB4EE2',  // USDC
    '0xdAC17F958D2ee523a2206206994597C13D831ec7',  // USDT
  ],
  tokenOverrides: [] as StaticTokenDefinition[],
  poolsToSkip: [] as string[],
  stablecoinWrappedNativePoolId: '',
  stablecoinIsToken0: true,
  wrappedNativeAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  stablecoinAddresses: ['0xA0b86a33E6817Fd2Dd1f44e1e71eeEe5E4bB4EE2'],
  minimumNativeLocked: 0,
  nativeTokenDetails: {
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: BigInt(18)
  } as NativeTokenDetails
}

export async function handleInitialize(log: InitializeLog): Promise<void> {
  if (!log.args) throw new Error('Log args are undefined')

  const config = MAINNET_CONFIG
  const poolManagerAddress = config.poolManagerAddress.toLowerCase()
  const whitelistTokens = config.whitelistTokens
  const tokenOverrides = config.tokenOverrides
  const poolsToSkip = config.poolsToSkip
  const wrappedNativeAddress = config.wrappedNativeAddress
  const stablecoinAddresses = config.stablecoinAddresses
  const minimumNativeLocked = config.minimumNativeLocked
  const nativeTokenDetails = config.nativeTokenDetails

  const poolId = log.args.id.toLowerCase()

  if (poolsToSkip.includes(poolId)) {
    return
  }

  // Load or create pool manager
  let poolManager = await PoolManager.get(poolManagerAddress)
  if (poolManager === undefined) {
    poolManager = PoolManager.create({
      id: poolManagerAddress,
      poolCount: ZERO_BI,
      totalVolumeETH: ZERO_BD,
      totalVolumeUSD: ZERO_BD,
      untrackedVolumeUSD: ZERO_BD,
      totalFeesUSD: ZERO_BD,
      totalFeesETH: ZERO_BD,
      totalValueLockedETH: ZERO_BD,
      totalValueLockedUSD: ZERO_BD,
      totalValueLockedUSDUntracked: ZERO_BD,
      totalValueLockedETHUntracked: ZERO_BD,
      txCount: ZERO_BI,
      owner: ADDRESS_ZERO
    })

    // Create new bundle for tracking eth price
    const bundle = Bundle.create({
      id: '1',
      ethPriceUSD: ZERO_BD
    })
    await bundle.save()
  }

  poolManager.poolCount = poolManager.poolCount + ONE_BI

  // Create tokens
  const token0Id = log.args.currency0.toLowerCase()
  const token1Id = log.args.currency1.toLowerCase()

  // Check if tokens exist in parallel
  const [existingToken0, existingToken1] = await Promise.all([
    Token.get(token0Id),
    Token.get(token1Id)
  ])

  let token0 = existingToken0
  let token1 = existingToken1

  // Collect promises for tokens that need to be created
  const tokenCreationPromises: Promise<void>[] = []

  if (token0 === undefined) {
    tokenCreationPromises.push(
      (async () => {
        // Fetch token details in parallel for better performance
        const [symbol, name, totalSupply, decimals] = await Promise.all([
          fetchTokenSymbol(token0Id, tokenOverrides, nativeTokenDetails),
          fetchTokenName(token0Id, tokenOverrides, nativeTokenDetails),
          fetchTokenTotalSupply(token0Id),
          fetchTokenDecimals(token0Id, nativeTokenDetails)
        ])

        token0 = Token.create({
          id: token0Id,
          symbol,
          name,
          totalSupply,
          decimals,
          derivedETH: ZERO_BD,
          volume: ZERO_BD,
          volumeUSD: ZERO_BD,
          feesUSD: ZERO_BD,
          untrackedVolumeUSD: ZERO_BD,
          totalValueLocked: ZERO_BD,
          totalValueLockedUSD: ZERO_BD,
          totalValueLockedUSDUntracked: ZERO_BD,
          txCount: ZERO_BI,
          poolCount: ZERO_BI
        })

        const derivedETH = await findNativePerToken(token0, wrappedNativeAddress, stablecoinAddresses, minimumNativeLocked)
        token0.derivedETH = derivedETH
        await token0.save()
      })()
    )
  }

  if (token1 === undefined) {
    tokenCreationPromises.push(
      (async () => {
        // Fetch token details in parallel for better performance
        const [symbol, name, totalSupply, decimals] = await Promise.all([
          fetchTokenSymbol(token1Id, tokenOverrides, nativeTokenDetails),
          fetchTokenName(token1Id, tokenOverrides, nativeTokenDetails),
          fetchTokenTotalSupply(token1Id),
          fetchTokenDecimals(token1Id, nativeTokenDetails)
        ])

        token1 = Token.create({
          id: token1Id,
          symbol,
          name,
          totalSupply,
          decimals,
          derivedETH: ZERO_BD,
          volume: ZERO_BD,
          volumeUSD: ZERO_BD,
          feesUSD: ZERO_BD,
          untrackedVolumeUSD: ZERO_BD,
          totalValueLocked: ZERO_BD,
          totalValueLockedUSD: ZERO_BD,
          totalValueLockedUSDUntracked: ZERO_BD,
          txCount: ZERO_BI,
          poolCount: ZERO_BI
        })

        const derivedETH = await findNativePerToken(token1, wrappedNativeAddress, stablecoinAddresses, minimumNativeLocked)
        token1.derivedETH = derivedETH
        await token1.save()
      })()
    )
  }

  // Execute all token creation promises in parallel
  await Promise.all(tokenCreationPromises)

  // Ensure tokens are defined (they should be after creation)
  if (!token0 || !token1) {
    throw new Error('Failed to create or load tokens')
  }

  // Create pool
  const pool = Pool.create({
    id: poolId,
    createdAtTimestamp: BigInt(log.block.timestamp),
    createdAtBlockNumber: BigInt(log.blockNumber),
    token0Id: token0Id,
    token1Id: token1Id,
    feeTier: BigInt(log.args.fee),
    tickSpacing: BigInt(log.args.tickSpacing),
    liquidity: ZERO_BI,
    sqrtPrice: BigInt(log.args.sqrtPriceX96.toString()),
    token0Price: ZERO_BD,
    token1Price: ZERO_BD,
    tick: BigInt(log.args.tick),
    observationIndex: ZERO_BI,
    volumeToken0: ZERO_BD,
    volumeToken1: ZERO_BD,
    volumeUSD: ZERO_BD,
    untrackedVolumeUSD: ZERO_BD,
    feesUSD: ZERO_BD,
    collectedFeesToken0: ZERO_BD,
    collectedFeesToken1: ZERO_BD,
    collectedFeesUSD: ZERO_BD,
    totalValueLockedToken0: ZERO_BD,
    totalValueLockedToken1: ZERO_BD,
    totalValueLockedETH: ZERO_BD,
    totalValueLockedUSD: ZERO_BD,
    totalValueLockedUSDUntracked: ZERO_BD,
    liquidityProviderCount: ZERO_BI,
    txCount: ZERO_BI,
    hooks: log.args.hooks.toLowerCase()
  })

  // Set initial prices
  const prices = sqrtPriceX96ToTokenPrices(
    BigInt(log.args.sqrtPriceX96.toString()),
    token0,
    token1,
    nativeTokenDetails
  )
  pool.token0Price = prices[0]
  pool.token1Price = prices[1]

  // Update token pool counts
  token0.poolCount = token0.poolCount + ONE_BI
  token1.poolCount = token1.poolCount + ONE_BI

  // Save all entities
  await pool.save()
  await token0.save()
  await token1.save()
  await poolManager.save()
}