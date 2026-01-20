import { SwapLog } from '../types/abi-interfaces/PoolManager'
import { Bundle, Pool, PoolManager, Swap, Token } from '../types'
import { ONE_BI, ZERO_BD } from '../utils/constants'
import { convertTokenToDecimal, loadTransaction, safeDiv } from '../utils/index'
import bigDecimal from 'js-big-decimal'
import { findNativePerToken, getNativePriceInUSD, getTrackedAmountUSD, sqrtPriceX96ToTokenPrices } from '../utils/pricing'
import {
  updatePoolDayData,
  updatePoolHourData,
  updateTokenDayData,
  updateTokenHourData,
  updateUniswapDayData,
} from '../utils/intervalUpdates'
import { getConfig } from '../utils/config'

// Get the configuration for the current chain
const CONFIG = getConfig()

export async function handleSwap(log: SwapLog): Promise<void> {
  if (!log.args) throw new Error('Log args are undefined')

  const poolId = log.args.id.toLowerCase()
  const pool = await Pool.get(poolId)

  if (!pool) {
    // Pool doesn't exist, skip this swap
    return
  }

  const poolManager = await PoolManager.get(CONFIG.poolManagerAddress)
  if (!poolManager) {
    return
  }

  const bundle = await Bundle.get('1')
  if (!bundle) {
    return
  }

  const token0 = await Token.get(pool.token0Id)
  const token1 = await Token.get(pool.token1Id)

  if (!token0 || !token1) {
    return
  }

  const whitelistTokens = CONFIG.whitelistTokens
  const wrappedNativeAddress = CONFIG.wrappedNativeAddress
  const stablecoinAddresses = CONFIG.stablecoinAddresses
  const minimumNativeLocked = CONFIG.minimumNativeLocked
  const nativeTokenDetails = CONFIG.nativeTokenDetails

  // amounts - 0/1 are token deltas: can be positive or negative
  // Unlike V3, a negative amount represents that amount is being sent to the pool and vice versa, so invert the sign
  const amount0 = convertTokenToDecimal(BigInt(log.args.amount0.toString()), token0.decimals) * -1
  const amount1 = convertTokenToDecimal(BigInt(log.args.amount1.toString()), token1.decimals) * -1

  // need absolute amounts for volume
  const amount0Abs = Math.abs(amount0)
  const amount1Abs = Math.abs(amount1)

  // Update the pool feeTier with the fee from the swap event
  // This is important for dynamic fee pools where we want to keep store the actual last fee rather storing the dynamic flag (8388608)
  pool.feeTier = BigInt(log.args.fee)

  const amount0ETH = amount0Abs * token0.derivedETH
  const amount1ETH = amount1Abs * token1.derivedETH

  // get amount that should be tracked only - div 2 because cant count both input and output as volume
  const amountTotalUSDTracked = await getTrackedAmountUSD(amount0Abs, token0, amount1Abs, token1, whitelistTokens) / 2
  const amountTotalETHTracked = safeDiv(new bigDecimal(amountTotalUSDTracked), new bigDecimal(bundle.ethPriceUSD), 18)
  const amountTotalUSDUntracked = (amount0ETH + amount1ETH) * bundle.ethPriceUSD / 2

  const feesETH = Number(amountTotalETHTracked.getValue()) * Number(pool.feeTier) / 1000000
  const feesUSD = amountTotalUSDTracked * Number(pool.feeTier) / 1000000

  // global updates
  poolManager.txCount = poolManager.txCount + ONE_BI
  poolManager.totalVolumeETH = poolManager.totalVolumeETH + Number(amountTotalETHTracked.getValue())
  poolManager.totalVolumeUSD = poolManager.totalVolumeUSD + amountTotalUSDTracked
  poolManager.untrackedVolumeUSD = poolManager.untrackedVolumeUSD + amountTotalUSDUntracked
  poolManager.totalFeesETH = poolManager.totalFeesETH + feesETH
  poolManager.totalFeesUSD = poolManager.totalFeesUSD + feesUSD

  // reset aggregate tvl before individual pool tvl updates
  const currentPoolTvlETH = pool.totalValueLockedETH
  poolManager.totalValueLockedETH = poolManager.totalValueLockedETH - currentPoolTvlETH

  // pool volume
  pool.volumeToken0 = pool.volumeToken0 + amount0Abs
  pool.volumeToken1 = pool.volumeToken1 + amount1Abs
  pool.volumeUSD = pool.volumeUSD + amountTotalUSDTracked
  pool.untrackedVolumeUSD = pool.untrackedVolumeUSD + amountTotalUSDUntracked
  pool.feesUSD = pool.feesUSD + feesUSD
  pool.txCount = pool.txCount + ONE_BI

  // Update the pool with the new active liquidity, price, and tick.
  pool.liquidity = BigInt(log.args.liquidity.toString())
  pool.tick = BigInt(log.args.tick)
  pool.sqrtPrice = BigInt(log.args.sqrtPriceX96.toString())
  pool.totalValueLockedToken0 = pool.totalValueLockedToken0 + amount0
  pool.totalValueLockedToken1 = pool.totalValueLockedToken1 + amount1

  // update token0 data
  token0.volume = token0.volume + amount0Abs
  token0.totalValueLocked = token0.totalValueLocked + amount0
  token0.volumeUSD = token0.volumeUSD + amountTotalUSDTracked
  token0.untrackedVolumeUSD = token0.untrackedVolumeUSD + amountTotalUSDUntracked
  token0.feesUSD = token0.feesUSD + feesUSD / 2
  token0.txCount = token0.txCount + ONE_BI

  // update token1 data
  token1.volume = token1.volume + amount1Abs
  token1.totalValueLocked = token1.totalValueLocked + amount1
  token1.volumeUSD = token1.volumeUSD + amountTotalUSDTracked
  token1.untrackedVolumeUSD = token1.untrackedVolumeUSD + amountTotalUSDUntracked
  token1.feesUSD = token1.feesUSD + feesUSD / 2
  token1.txCount = token1.txCount + ONE_BI

  // updated pool rates
  const prices = sqrtPriceX96ToTokenPrices(
    BigInt(log.args.sqrtPriceX96.toString()),
    token0,
    token1,
    nativeTokenDetails
  )
  pool.token0Price = prices[0]
  pool.token1Price = prices[1]

  // update USD pricing
  // Use the USDC/WETH pool for ETH price discovery
  bundle.ethPriceUSD = await getNativePriceInUSD(CONFIG.stablecoinWrappedNativePoolId, CONFIG.stablecoinIsToken0)

  await bundle.save()
  token0.derivedETH = await findNativePerToken(token0, wrappedNativeAddress, stablecoinAddresses, minimumNativeLocked)
  token1.derivedETH = await findNativePerToken(token1, wrappedNativeAddress, stablecoinAddresses, minimumNativeLocked)

  /**
   * Things affected by new USD rates
   */
  pool.totalValueLockedETH =
    pool.totalValueLockedToken0 * token0.derivedETH +
    pool.totalValueLockedToken1 * token1.derivedETH
  pool.totalValueLockedUSD = pool.totalValueLockedETH * bundle.ethPriceUSD

  poolManager.totalValueLockedETH = poolManager.totalValueLockedETH + pool.totalValueLockedETH
  poolManager.totalValueLockedUSD = poolManager.totalValueLockedETH * bundle.ethPriceUSD

  token0.totalValueLockedUSD = token0.totalValueLocked * token0.derivedETH * bundle.ethPriceUSD
  token1.totalValueLockedUSD = token1.totalValueLocked * token1.derivedETH * bundle.ethPriceUSD

  // create swap event
  const transaction = await loadTransaction(log)
  const swap = Swap.create({
    id: transaction.id + '-' + log.logIndex.toString(),
    transactionId: transaction.id,
    timestamp: transaction.timestamp,
    poolId: poolId,
    token0Id: pool.token0Id,
    token1Id: pool.token1Id,
    sender: log.args.sender.toLowerCase(),
    origin: log.transaction.from.toLowerCase(),
    amount0: amount0,
    amount1: amount1,
    amountUSD: amountTotalUSDTracked,
    sqrtPriceX96: BigInt(log.args.sqrtPriceX96.toString()),
    tick: BigInt(log.args.tick),
    logIndex: BigInt(log.logIndex)
  })

  // interval data
  const uniswapDayData = await updateUniswapDayData(log, CONFIG.poolManagerAddress)
  const poolDayData = await updatePoolDayData(poolId, log)
  const poolHourData = await updatePoolHourData(poolId, log)
  const token0DayData = await updateTokenDayData(token0, log)
  const token1DayData = await updateTokenDayData(token1, log)
  const token0HourData = await updateTokenHourData(token0, log)
  const token1HourData = await updateTokenHourData(token1, log)

  // update volume metrics
  uniswapDayData.volumeETH = uniswapDayData.volumeETH + Number(amountTotalETHTracked.getValue())
  uniswapDayData.volumeUSD = uniswapDayData.volumeUSD + amountTotalUSDTracked
  uniswapDayData.feesUSD = uniswapDayData.feesUSD + feesUSD
  await uniswapDayData.save()

  poolDayData.volumeUSD = poolDayData.volumeUSD + amountTotalUSDTracked
  poolDayData.volumeToken0 = poolDayData.volumeToken0 + amount0Abs
  poolDayData.volumeToken1 = poolDayData.volumeToken1 + amount1Abs
  poolDayData.feesUSD = poolDayData.feesUSD + feesUSD
  await poolDayData.save()

  poolHourData.volumeUSD = poolHourData.volumeUSD + amountTotalUSDTracked
  poolHourData.volumeToken0 = poolHourData.volumeToken0 + amount0Abs
  poolHourData.volumeToken1 = poolHourData.volumeToken1 + amount1Abs
  poolHourData.feesUSD = poolHourData.feesUSD + feesUSD
  await poolHourData.save()

  token0DayData.volume = token0DayData.volume + amount0Abs
  token0DayData.volumeUSD = token0DayData.volumeUSD + amountTotalUSDTracked
  token0DayData.untrackedVolumeUSD = token0DayData.untrackedVolumeUSD + amountTotalUSDUntracked
  token0DayData.feesUSD = token0DayData.feesUSD + feesUSD / 2
  await token0DayData.save()

  token0HourData.volume = token0HourData.volume + amount0Abs
  token0HourData.volumeUSD = token0HourData.volumeUSD + amountTotalUSDTracked
  token0HourData.untrackedVolumeUSD = token0HourData.untrackedVolumeUSD + amountTotalUSDUntracked
  token0HourData.feesUSD = token0HourData.feesUSD + feesUSD / 2
  await token0HourData.save()

  token1DayData.volume = token1DayData.volume + amount1Abs
  token1DayData.volumeUSD = token1DayData.volumeUSD + amountTotalUSDTracked
  token1DayData.untrackedVolumeUSD = token1DayData.untrackedVolumeUSD + amountTotalUSDUntracked
  token1DayData.feesUSD = token1DayData.feesUSD + feesUSD / 2
  await token1DayData.save()

  token1HourData.volume = token1HourData.volume + amount1Abs
  token1HourData.volumeUSD = token1HourData.volumeUSD + amountTotalUSDTracked
  token1HourData.untrackedVolumeUSD = token1HourData.untrackedVolumeUSD + amountTotalUSDUntracked
  token1HourData.feesUSD = token1HourData.feesUSD + feesUSD / 2
  await token1HourData.save()

  await swap.save()
  await poolManager.save()
  await pool.save()
  await token0.save()
  await token1.save()
}
