import { ModifyLiquidityLog } from '../types/abi-interfaces/PoolManager'
import { Bundle, Pool, PoolManager, ModifyLiquidity, Token } from '../types'
import { ONE_BI, ZERO_BD } from '../utils/constants'
import { convertTokenToDecimal, loadTransaction } from '../utils/index'

export async function handleModifyLiquidity(log: ModifyLiquidityLog): Promise<void> {
  if (!log.args) throw new Error('Log args are undefined')

  const poolId = log.args.id.toLowerCase()
  const pool = await Pool.get(poolId)

  if (!pool) {
    // Pool doesn't exist, skip this event
    return
  }

  const token0 = await Token.get(pool.token0Id)
  const token1 = await Token.get(pool.token1Id)

  if (!token0 || !token1) {
    return
  }

  // Update pool liquidity - note: liquidityDelta can be positive or negative
  const liquidityDelta = BigInt(log.args.liquidityDelta.toString())
  pool.liquidity = pool.liquidity + liquidityDelta

  // Create ModifyLiquidity entity
  const modifyLiquidity = ModifyLiquidity.create({
    id: log.transactionHash + '-' + log.logIndex.toString(),
    transactionId: log.transactionHash,
    timestamp: BigInt(log.block.timestamp),
    poolId: poolId,
    token0Id: pool.token0Id,
    token1Id: pool.token1Id,
    origin: log.args.sender.toLowerCase(),
    amount: liquidityDelta,
    amount0: 0, // These would need to be calculated from the liquidity delta
    amount1: 0,
    tickLower: BigInt(log.args.tickLower),
    tickUpper: BigInt(log.args.tickUpper),
    amountUSD: 0,
    logIndex: BigInt(log.logIndex)
  })

  // Update transaction count
  pool.txCount = pool.txCount + ONE_BI

  // Save entities
  await modifyLiquidity.save()
  await pool.save()
}