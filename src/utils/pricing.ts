import bigDecimal from "js-big-decimal";
import { exponentToNumber, safeDiv } from '../utils/index'
import { Bundle, Pool, Token } from '../types'
import { ADDRESS_ZERO, ONE_BD, Q192, ZERO_BD, ZERO_BI } from './constants'
import { NativeTokenDetails } from './nativeTokenDetails'


export function sqrtPriceX96ToTokenPrices(
  sqrtPriceX96: bigint,
  token0: Token,
  token1: Token,
  nativeTokenDetails: NativeTokenDetails,
): number[] {
  const token0Decimals = token0.id == ADDRESS_ZERO ? nativeTokenDetails.decimals : token0.decimals
  const token1Decimals = token1.id == ADDRESS_ZERO ? nativeTokenDetails.decimals : token1.decimals

  const num = sqrtPriceX96 * sqrtPriceX96;
  const denom = Q192;

  // const price1 = (num / denom) * exponentToBigint(BI_18) / exponentToBigint(BI_18);
  const price1 =
    new bigDecimal(num).divide(new bigDecimal(denom), 18)
      .multiply(new bigDecimal(exponentToNumber(token0Decimals)))
      .divide(new bigDecimal(exponentToNumber(token1Decimals)), 18);

  const price0 = safeDiv(ONE_BD, price1, 18);
  return [Number(price0.getValue()), Number(price1.getValue())];
}

export async function getNativePriceInUSD(stablecoinWrappedNativePoolId: string, stablecoinIsToken0: boolean): Promise<number> {
  const stablecoinWrappedNativePool = await Pool.get(stablecoinWrappedNativePoolId)
  if (stablecoinWrappedNativePool !== undefined) {
    return stablecoinIsToken0 ? stablecoinWrappedNativePool.token0Price : stablecoinWrappedNativePool.token1Price
  } else {
    return 0;
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
    return 1;
  }

  // Simplified implementation - to be enhanced later with proper pool querying
  const bundle = await Bundle.get('1')

  // hardcoded fix for incorrect rates
  // if whitelist includes token - get the safe price
  if (stablecoinAddresses.includes(token.id)) {
    return bundle ? Number(safeDiv(ONE_BD, new bigDecimal(bundle.ethPriceUSD)).getValue()) : 0
  }

  // For now, return the token's derivedETH or a default value
  return token.derivedETH || 0
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
  if (!bundle) return 0

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
  return 0
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

// Tick utility for creating tick entities
export function calculateTickPrice(tickIdx: number): { price0: number; price1: number } {
  // 1.0001^tick is token1/token0.
  const price0 = Math.pow(1.0001, tickIdx)
  const price1 = safeDiv(ONE_BD, new bigDecimal(price0), 18)
  return { price0, price1: Number(price1.getValue()) }
}