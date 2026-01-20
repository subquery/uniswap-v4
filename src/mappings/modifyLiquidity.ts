import { ModifyLiquidityLog } from '../types/abi-interfaces/PoolManager'
import { Bundle, Pool, PoolManager, ModifyLiquidity, Tick, Token } from '../types'
import { ONE_BI, ZERO_BI } from '../utils/constants'
import { convertTokenToDecimal, loadTransaction } from '../utils/index'
import {
  updatePoolDayData,
  updatePoolHourData,
  updateTokenDayData,
  updateTokenHourData,
  updateUniswapDayData,
} from '../utils/intervalUpdates'
import { getAmount0, getAmount1 } from '../utils/liquidityMath'
import { calculateAmountUSD, calculateTickPrice } from '../utils/pricing'

const POOL_MANAGER_ADDRESS = '0x000000000004444c5dc75cB358380D2e3dE08A90'

export async function handleModifyLiquidity(log: ModifyLiquidityLog): Promise<void> {
  if (!log.args) throw new Error('Log args are undefined')

  const poolId = log.args.id.toLowerCase()
  const pool = await Pool.get(poolId)

  if (!pool) {
    // Pool doesn't exist, skip this event
    return
  }

  const poolManager = await PoolManager.get(POOL_MANAGER_ADDRESS)
  if (!poolManager) {
    return
  }

  const token0 = await Token.get(pool.token0Id)
  const token1 = await Token.get(pool.token1Id)

  if (!token0 || !token1) {
    return
  }

  const bundle = await Bundle.get('1')
  if (!bundle) {
    return
  }

  const currTick = Number(pool.tick || 0)
  const currSqrtPriceX96 = pool.sqrtPrice

  // Get the amounts using the getAmounts function
  const tickLower = Number(log.args.tickLower)
  const tickUpper = Number(log.args.tickUpper)
  const liquidityDelta = BigInt(log.args.liquidityDelta.toString())

  const amount0Raw = getAmount0(
    tickLower,
    tickUpper,
    currTick,
    liquidityDelta,
    currSqrtPriceX96,
  )
  const amount1Raw = getAmount1(
    tickLower,
    tickUpper,
    currTick,
    liquidityDelta,
    currSqrtPriceX96,
  )
  const amount0 = convertTokenToDecimal(amount0Raw, token0.decimals)
  const amount1 = convertTokenToDecimal(amount1Raw, token1.decimals)

  const amountUSD = calculateAmountUSD(amount0, amount1, token0.derivedETH, token1.derivedETH, bundle.ethPriceUSD)

  // reset tvl aggregates until new amounts calculated
  poolManager.totalValueLockedETH = poolManager.totalValueLockedETH - pool.totalValueLockedETH

  // update globals
  poolManager.txCount = poolManager.txCount + ONE_BI

  // update token0 data
  token0.txCount = token0.txCount + ONE_BI
  token0.totalValueLocked = token0.totalValueLocked + amount0
  token0.totalValueLockedUSD = token0.totalValueLocked * token0.derivedETH * bundle.ethPriceUSD

  // update token1 data
  token1.txCount = token1.txCount + ONE_BI
  token1.totalValueLocked = token1.totalValueLocked + amount1
  token1.totalValueLockedUSD = token1.totalValueLocked * token1.derivedETH * bundle.ethPriceUSD

  // pool data
  pool.txCount = pool.txCount + ONE_BI

  // Pools liquidity tracks the currently active liquidity given pools current tick.
  // We only want to update it if the new position includes the current tick.
  const tickLowerBigInt = BigInt(tickLower)
  const tickUpperBigInt = BigInt(tickUpper)

  if (
    pool.tick !== undefined &&
    tickLowerBigInt <= (pool.tick as bigint) &&
    tickUpperBigInt > (pool.tick as bigint)
  ) {
    pool.liquidity = pool.liquidity + liquidityDelta
  }

  pool.totalValueLockedToken0 = pool.totalValueLockedToken0 + amount0
  pool.totalValueLockedToken1 = pool.totalValueLockedToken1 + amount1
  pool.totalValueLockedETH =
    pool.totalValueLockedToken0 * token0.derivedETH +
    pool.totalValueLockedToken1 * token1.derivedETH
  pool.totalValueLockedUSD = pool.totalValueLockedETH * bundle.ethPriceUSD

  // reset aggregates with new amounts
  poolManager.totalValueLockedETH = poolManager.totalValueLockedETH + pool.totalValueLockedETH
  poolManager.totalValueLockedUSD = poolManager.totalValueLockedETH * bundle.ethPriceUSD

  const transaction = await loadTransaction(log)
  const modifyLiquidityEntity = ModifyLiquidity.create({
    id: transaction.id + '-' + log.logIndex.toString(),
    transactionId: transaction.id,
    timestamp: transaction.timestamp,
    poolId: poolId,
    token0Id: pool.token0Id,
    token1Id: pool.token1Id,
    sender: log.args.sender.toLowerCase(),
    origin: log.transaction.from.toLowerCase(),
    amount: liquidityDelta,
    amount0: amount0,
    amount1: amount1,
    amountUSD: amountUSD,
    tickLower: tickLowerBigInt,
    tickUpper: tickUpperBigInt,
    logIndex: BigInt(log.logIndex)
  })

  // tick entities
  const lowerTickIdx = tickLower
  const upperTickIdx = tickUpper

  const lowerTickId = poolId + '#' + tickLowerBigInt.toString()
  const upperTickId = poolId + '#' + tickUpperBigInt.toString()

  let lowerTick = await Tick.get(lowerTickId)
  let upperTick = await Tick.get(upperTickId)

  if (lowerTick === undefined) {
    const tickPrices = calculateTickPrice(lowerTickIdx)
    lowerTick = Tick.create({
      id: lowerTickId,
      poolAddress: poolId,
      poolId: poolId,
      tickIdx: tickLowerBigInt,
      liquidityGross: ZERO_BI,
      liquidityNet: ZERO_BI,
      price0: tickPrices.price0,
      price1: tickPrices.price1,
      createdAtTimestamp: BigInt(log.block.timestamp),
      createdAtBlockNumber: BigInt(log.blockNumber)
    })
  }

  if (upperTick === undefined) {
    const tickPrices = calculateTickPrice(upperTickIdx)
    upperTick = Tick.create({
      id: upperTickId,
      poolAddress: poolId,
      poolId: poolId,
      tickIdx: tickUpperBigInt,
      liquidityGross: ZERO_BI,
      liquidityNet: ZERO_BI,
      price0: tickPrices.price0,
      price1: tickPrices.price1,
      createdAtTimestamp: BigInt(log.block.timestamp),
      createdAtBlockNumber: BigInt(log.blockNumber)
    })
  }

  const amount = liquidityDelta
  lowerTick.liquidityGross = lowerTick.liquidityGross + amount
  lowerTick.liquidityNet = lowerTick.liquidityNet + amount
  upperTick.liquidityGross = upperTick.liquidityGross + amount
  upperTick.liquidityNet = upperTick.liquidityNet - amount

  await lowerTick.save()
  await upperTick.save()

  await updateUniswapDayData(log, POOL_MANAGER_ADDRESS)
  await updatePoolDayData(poolId, log)
  await updatePoolHourData(poolId, log)
  await updateTokenDayData(token0, log)
  await updateTokenDayData(token1, log)
  await updateTokenHourData(token0, log)
  await updateTokenHourData(token1, log)

  await token0.save()
  await token1.save()
  await pool.save()
  await poolManager.save()
  await modifyLiquidityEntity.save()
}
