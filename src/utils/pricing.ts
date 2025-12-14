import { exponentToNumber, safeDiv } from '../utils/index'
import { Bundle, Pool, Token } from '../types'
import { ADDRESS_ZERO, ONE_BD, ZERO_BD, ZERO_BI } from './constants'
import { NativeTokenDetails } from './nativeTokenDetails'

const Q192 = BigInt(2) ** BigInt(192)

export function sqrtPriceX96ToTokenPrices(
  sqrtPriceX96: bigint,
  token0: Token,
  token1: Token,
  nativeTokenDetails: NativeTokenDetails,
): number[] {
  const token0Decimals = token0.id == ADDRESS_ZERO ? nativeTokenDetails.decimals : token0.decimals
  const token1Decimals = token1.id == ADDRESS_ZERO ? nativeTokenDetails.decimals : token1.decimals

  const num = Number(sqrtPriceX96 * sqrtPriceX96)
  const denom = Number(Q192)
  const price1 = (num / denom) * exponentToNumber(token0Decimals) / exponentToNumber(token1Decimals)

  const price0 = safeDiv(1, price1)
  return [price0, price1]
}

export async function getNativePriceInUSD(stablecoinWrappedNativePoolId: string, stablecoinIsToken0: boolean): Promise<number> {
  const stablecoinWrappedNativePool = await Pool.get(stablecoinWrappedNativePoolId)
  if (stablecoinWrappedNativePool !== undefined) {
    return stablecoinIsToken0 ? stablecoinWrappedNativePool.token0Price : stablecoinWrappedNativePool.token1Price
  } else {
    return ZERO_BD
  }
}

/**
 * Search through graph to find derived Eth per token.
 * Simplified implementation for SubQuery migration
 */
export async function findNativePerToken(
  token: Token,
  wrappedNativeAddress: string,
  stablecoinAddresses: string[],
  minimumNativeLocked: number,
): Promise<number> {
  if (token.id == wrappedNativeAddress || token.id == ADDRESS_ZERO) {
    return ONE_BD
  }

  // Simplified implementation - to be enhanced later with proper pool querying
  const bundle = await Bundle.get('1')

  // hardcoded fix for incorrect rates
  // if whitelist includes token - get the safe price
  if (stablecoinAddresses.includes(token.id)) {
    return bundle ? safeDiv(ONE_BD, bundle.ethPriceUSD) : ZERO_BD
  }

  // For now, return the token's derivedETH or a default value
  return token.derivedETH || ZERO_BD
}

/**
 * Accepts tokens and amounts, return tracked amount based on token whitelist
 * If one token on whitelist, return amount in that token converted to USD * 2.
 * If both are, return sum of two amounts
 * If neither is, return 0
 */
export async function getTrackedAmountUSD(
  tokenAmount0: number,
  token0: Token,
  tokenAmount1: number,
  token1: Token,
  whitelistTokens: string[],
): Promise<number> {
  const bundle = await Bundle.get('1')
  if (!bundle) return ZERO_BD

  const price0USD = token0.derivedETH * bundle.ethPriceUSD
  const price1USD = token1.derivedETH * bundle.ethPriceUSD

  // both are whitelist tokens, return sum of both amounts
  if (whitelistTokens.includes(token0.id) && whitelistTokens.includes(token1.id)) {
    return tokenAmount0 * price0USD + tokenAmount1 * price1USD
  }

  // take double value of the whitelisted token amount
  if (whitelistTokens.includes(token0.id) && !whitelistTokens.includes(token1.id)) {
    return tokenAmount0 * price0USD * 2
  }

  // take double value of the whitelisted token amount
  if (!whitelistTokens.includes(token0.id) && whitelistTokens.includes(token1.id)) {
    return tokenAmount1 * price1USD * 2
  }

  // neither token is on white list, tracked amount is 0
  return ZERO_BD
}

export function calculateAmountUSD(
  amount0: number,
  amount1: number,
  token0DerivedETH: number,
  token1DerivedETH: number,
  ethPriceUSD: number,
): number {
  return amount0 * token0DerivedETH * ethPriceUSD + amount1 * token1DerivedETH * ethPriceUSD
}