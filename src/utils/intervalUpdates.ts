import { EthereumLog } from '@subql/types-ethereum'
import { Bundle, Pool, PoolDayData, PoolHourData, PoolManager, Token, TokenDayData, TokenHourData, UniswapDayData } from '../types'
import { ONE_BI, ZERO_BI } from './constants'

/**
 * Tracks global aggregate data over daily windows
 */
export async function updateUniswapDayData(event: EthereumLog, poolManagerAddress: string): Promise<UniswapDayData> {
  const poolManager = await PoolManager.get(poolManagerAddress)
  if (!poolManager) {
    throw new Error('PoolManager not found')
  }

  const timestamp = Number(event.block.timestamp)
  const dayID = Math.floor(timestamp / 86400) // rounded
  const dayStartTimestamp = dayID * 86400

  let uniswapDayData = await UniswapDayData.get(dayID.toString())
  if (uniswapDayData === undefined) {
    uniswapDayData = UniswapDayData.create({
      id: dayID.toString(),
      date: dayStartTimestamp,
      volumeETH: 0,
      volumeUSD: 0,
      volumeUSDUntracked: 0,
      feesUSD: 0,
      txCount: ZERO_BI,
      tvlUSD: 0
    })
  }

  uniswapDayData.tvlUSD = poolManager.totalValueLockedUSD
  uniswapDayData.txCount = poolManager.txCount
  await uniswapDayData.save()

  return uniswapDayData
}

export async function updatePoolDayData(poolId: string, event: EthereumLog): Promise<PoolDayData> {
  const pool = await Pool.get(poolId)
  if (!pool) {
    throw new Error('Pool not found')
  }

  const timestamp = Number(event.block.timestamp)
  const dayID = Math.floor(timestamp / 86400)
  const dayStartTimestamp = dayID * 86400
  const dayPoolID = poolId + '-' + dayID.toString()

  let poolDayData = await PoolDayData.get(dayPoolID)
  if (poolDayData === undefined) {
    poolDayData = PoolDayData.create({
      id: dayPoolID,
      date: dayStartTimestamp,
      poolId: poolId,
      liquidity: ZERO_BI,
      sqrtPrice: ZERO_BI,
      token0Price: 0,
      token1Price: 0,
      tick: ZERO_BI,
      tvlUSD: 0,
      volumeToken0: 0,
      volumeToken1: 0,
      volumeUSD: 0,
      feesUSD: 0,
      txCount: ZERO_BI,
      open: pool.token0Price,
      high: pool.token0Price,
      low: pool.token0Price,
      close: pool.token0Price
    })
  }

  if (pool.token0Price > poolDayData.high) {
    poolDayData.high = pool.token0Price
  }
  if (pool.token0Price < poolDayData.low) {
    poolDayData.low = pool.token0Price
  }

  poolDayData.liquidity = pool.liquidity
  poolDayData.sqrtPrice = pool.sqrtPrice
  poolDayData.token0Price = pool.token0Price
  poolDayData.token1Price = pool.token1Price
  poolDayData.close = pool.token0Price
  poolDayData.tick = pool.tick || ZERO_BI
  poolDayData.tvlUSD = pool.totalValueLockedUSD
  poolDayData.txCount = poolDayData.txCount + ONE_BI
  await poolDayData.save()

  return poolDayData
}

export async function updatePoolHourData(poolId: string, event: EthereumLog): Promise<PoolHourData> {
  const pool = await Pool.get(poolId)
  if (!pool) {
    throw new Error('Pool not found')
  }

  const timestamp = Number(event.block.timestamp)
  const hourIndex = Math.floor(timestamp / 3600) // get unique hour within unix history
  const hourStartUnix = hourIndex * 3600 // want the rounded effect
  const hourPoolID = poolId + '-' + hourIndex.toString()

  let poolHourData = await PoolHourData.get(hourPoolID)
  if (poolHourData === undefined) {
    poolHourData = PoolHourData.create({
      id: hourPoolID,
      periodStartUnix: hourStartUnix,
      poolId: poolId,
      liquidity: ZERO_BI,
      sqrtPrice: ZERO_BI,
      token0Price: 0,
      token1Price: 0,
      tick: ZERO_BI,
      tvlUSD: 0,
      volumeToken0: 0,
      volumeToken1: 0,
      volumeUSD: 0,
      feesUSD: 0,
      txCount: ZERO_BI,
      open: pool.token0Price,
      high: pool.token0Price,
      low: pool.token0Price,
      close: pool.token0Price
    })
  }

  if (pool.token0Price > poolHourData.high) {
    poolHourData.high = pool.token0Price
  }
  if (pool.token0Price < poolHourData.low) {
    poolHourData.low = pool.token0Price
  }

  poolHourData.liquidity = pool.liquidity
  poolHourData.sqrtPrice = pool.sqrtPrice
  poolHourData.token0Price = pool.token0Price
  poolHourData.token1Price = pool.token1Price
  poolHourData.close = pool.token0Price
  poolHourData.tick = pool.tick || ZERO_BI
  poolHourData.tvlUSD = pool.totalValueLockedUSD
  poolHourData.txCount = poolHourData.txCount + ONE_BI
  await poolHourData.save()

  return poolHourData
}

export async function updateTokenDayData(token: Token, event: EthereumLog): Promise<TokenDayData> {
  const bundle = await Bundle.get('1')
  if (!bundle) {
    throw new Error('Bundle not found')
  }

  const timestamp = Number(event.block.timestamp)
  const dayID = Math.floor(timestamp / 86400)
  const dayStartTimestamp = dayID * 86400
  const tokenDayID = token.id.toString() + '-' + dayID.toString()
  const tokenPrice = token.derivedETH * bundle.ethPriceUSD

  let tokenDayData = await TokenDayData.get(tokenDayID)
  if (tokenDayData === undefined) {
    tokenDayData = TokenDayData.create({
      id: tokenDayID,
      date: dayStartTimestamp,
      tokenId: token.id,
      volume: 0,
      volumeUSD: 0,
      untrackedVolumeUSD: 0,
      totalValueLocked: 0,
      totalValueLockedUSD: 0,
      priceUSD: tokenPrice,
      feesUSD: 0,
      open: tokenPrice,
      high: tokenPrice,
      low: tokenPrice,
      close: tokenPrice
    })
  }

  if (tokenPrice > tokenDayData.high) {
    tokenDayData.high = tokenPrice
  }

  if (tokenPrice < tokenDayData.low) {
    tokenDayData.low = tokenPrice
  }

  tokenDayData.close = tokenPrice
  tokenDayData.priceUSD = tokenPrice
  tokenDayData.totalValueLocked = token.totalValueLocked
  tokenDayData.totalValueLockedUSD = token.totalValueLockedUSD
  await tokenDayData.save()

  return tokenDayData
}

export async function updateTokenHourData(token: Token, event: EthereumLog): Promise<TokenHourData> {
  const bundle = await Bundle.get('1')
  if (!bundle) {
    throw new Error('Bundle not found')
  }

  const timestamp = Number(event.block.timestamp)
  const hourIndex = Math.floor(timestamp / 3600) // get unique hour within unix history
  const hourStartUnix = hourIndex * 3600 // want the rounded effect
  const tokenHourID = token.id.toString() + '-' + hourIndex.toString()
  const tokenPrice = token.derivedETH * bundle.ethPriceUSD

  let tokenHourData = await TokenHourData.get(tokenHourID)
  if (tokenHourData === undefined) {
    tokenHourData = TokenHourData.create({
      id: tokenHourID,
      periodStartUnix: hourStartUnix,
      tokenId: token.id,
      volume: 0,
      volumeUSD: 0,
      untrackedVolumeUSD: 0,
      totalValueLocked: 0,
      totalValueLockedUSD: 0,
      priceUSD: tokenPrice,
      feesUSD: 0,
      open: tokenPrice,
      high: tokenPrice,
      low: tokenPrice,
      close: tokenPrice
    })
  }

  if (tokenPrice > tokenHourData.high) {
    tokenHourData.high = tokenPrice
  }

  if (tokenPrice < tokenHourData.low) {
    tokenHourData.low = tokenPrice
  }

  tokenHourData.close = tokenPrice
  tokenHourData.priceUSD = tokenPrice
  tokenHourData.totalValueLocked = token.totalValueLocked
  tokenHourData.totalValueLockedUSD = token.totalValueLockedUSD
  await tokenHourData.save()

  return tokenHourData
}
