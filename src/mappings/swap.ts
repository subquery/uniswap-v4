import { SwapLog } from '../types/abi-interfaces/PoolManager'
import { Bundle, Pool, PoolManager, Swap, Token } from '../types'
import { ONE_BI, ZERO_BD } from '../utils/constants'
import { convertTokenToDecimal, loadTransaction, safeDiv } from '../utils/index'
import { findNativePerToken, getNativePriceInUSD, getTrackedAmountUSD, sqrtPriceX96ToTokenPrices } from '../utils/pricing'

export async function handleSwap(log: SwapLog): Promise<void> {
  if (!log.args) throw new Error('Log args are undefined')

  const poolId = log.args.id.toLowerCase()
  const pool = await Pool.get(poolId)

  if (!pool) {
    // Pool doesn't exist, skip this swap
    return
  }

  const token0 = await Token.get(pool.token0Id)
  const token1 = await Token.get(pool.token1Id)

  if (!token0 || !token1) {
    return
  }

  // Convert amounts (note: in V4, amounts can be negative)
  const amount0 = Number(log.args.amount0.toString())
  const amount1 = Number(log.args.amount1.toString())

  // Calculate absolute amounts for volume tracking
  const amount0Abs = Math.abs(amount0)
  const amount1Abs = Math.abs(amount1)

  // Convert to token decimals
  const amount0Decimal = convertTokenToDecimal(BigInt(Math.abs(amount0)), token0.decimals)
  const amount1Decimal = convertTokenToDecimal(BigInt(Math.abs(amount1)), token1.decimals)

  // Update pool sqrt price and tick
  pool.sqrtPrice = BigInt(log.args.sqrtPriceX96.toString())
  pool.tick = BigInt(log.args.tick)

  // Calculate new token prices
  const prices = sqrtPriceX96ToTokenPrices(
    BigInt(log.args.sqrtPriceX96.toString()),
    token0,
    token1,
    { name: 'Ethereum', symbol: 'ETH', decimals: BigInt(18) }
  )
  pool.token0Price = prices[0]
  pool.token1Price = prices[1]

  // Update volume
  pool.volumeToken0 = pool.volumeToken0 + amount0Decimal
  pool.volumeToken1 = pool.volumeToken1 + amount1Decimal
  pool.txCount = pool.txCount + ONE_BI

  // Update token volumes
  token0.volume = token0.volume + amount0Decimal
  token1.volume = token1.volume + amount1Decimal
  token0.txCount = token0.txCount + ONE_BI
  token1.txCount = token1.txCount + ONE_BI

  // Calculate USD amounts (simplified)
  const bundle = await Bundle.get('1')
  if (bundle) {
    const amount0USD = amount0Decimal * token0.derivedETH * bundle.ethPriceUSD
    const amount1USD = amount1Decimal * token1.derivedETH * bundle.ethPriceUSD

    pool.volumeUSD = pool.volumeUSD + amount0USD + amount1USD
    token0.volumeUSD = token0.volumeUSD + amount0USD
    token1.volumeUSD = token1.volumeUSD + amount1USD

    // Update pool manager
    const poolManager = await PoolManager.get('0x000000000004444c5dc75cB358380D2e3dE08A90')
    if (poolManager) {
      poolManager.totalVolumeUSD = poolManager.totalVolumeUSD + amount0USD + amount1USD
      poolManager.txCount = poolManager.txCount + ONE_BI
      await poolManager.save()
    }
  }

  // Create swap entity
  const swap = Swap.create({
    id: log.transactionHash + '-' + log.logIndex.toString(),
    transactionId: log.transactionHash,
    timestamp: BigInt(log.block.timestamp),
    poolId: poolId,
    token0Id: pool.token0Id,
    token1Id: pool.token1Id,
    sender: log.args.sender.toLowerCase(),
    origin: log.transaction.from.toLowerCase(),
    amount0: Number(amount0),
    amount1: Number(amount1),
    amountUSD: bundle ? (Math.abs(amount0Decimal) * token0.derivedETH * bundle.ethPriceUSD + Math.abs(amount1Decimal) * token1.derivedETH * bundle.ethPriceUSD) : 0,
    sqrtPriceX96: BigInt(log.args.sqrtPriceX96.toString()),
    tick: BigInt(log.args.tick)
  })

  // Save all entities
  await swap.save()
  await pool.save()
  await token0.save()
  await token1.save()
}