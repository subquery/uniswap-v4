import { EthereumLog } from '@subql/types-ethereum'
import { Transaction } from '../types'
import { ONE_BD, ONE_BI, ZERO_BD, ZERO_BI } from '../utils/constants'
import bigDecimal from "js-big-decimal";

// Export liquidity math utilities
export * from './liquidityMath'

// Export interval update utilities
export * from './intervalUpdates'

export function exponentToNumber(decimals: bigint): bigint {
  // Validate decimals to prevent infinite loops
  if (decimals < BigInt(0) || decimals > BigInt(77)) {
    logger.error(`[FATAL] Invalid decimals value: ${decimals}. Must be between 0 and 77.`)
    throw new Error(`Invalid decimals: ${decimals}`)
  }
  
  // Use optimized power calculation instead of loop
  // 10^decimals
  return BigInt(10) ** decimals
}

// return 0 if denominator is 0 in division
export function safeDiv(amount0: bigDecimal, amount1: bigDecimal, precision=18): bigDecimal {
  if (amount1.compareTo(ZERO_BD) === 0) {
    return ZERO_BD;
  } else {
    return amount0.divide(amount1, precision);
  }
}

/**
 * Implements exponentiation by squaring
 * (see https://en.wikipedia.org/wiki/Exponentiation_by_squaring )
 * to minimize the number of operations and their impact on performance.
 */
export function fastExponentiation(value: bigDecimal, power: number): bigDecimal {
  // For the specific case of 1.0001^n (used in tick price calculation),
  // use logarithm-based calculation for better performance with large exponents
  // Formula: 1.0001^n = e^(n * ln(1.0001))
  const valueNum = Number(value.getValue())

  // Use logarithm method for large absolute powers (faster than recursive bigDecimal multiplication)
  if (Math.abs(power) > 100) {
    const result = Math.pow(valueNum, power)
    // Handle extreme values
    if (!isFinite(result) || result === 0) {
      if (power > 0) {
        // For very large positive powers, return a large number
        return new bigDecimal(Number.MAX_SAFE_INTEGER.toString())
      } else {
        // For very large negative powers, return a very small number
        return new bigDecimal((1 / Number.MAX_SAFE_INTEGER).toString())
      }
    }
    return new bigDecimal(result.toString())
  }

  // For smaller powers, use the original recursive method for precision
  if (power < 0) {
    const result = fastExponentiation(value, -power)
    return safeDiv(ONE_BD, result)
  }

  if (power == 0) {
    return ONE_BD
  }

  if (power == 1) {
    return value
  }

  const halfPower = Math.floor(power / 2)
  const halfResult = fastExponentiation(value, halfPower)

  // Use the fact that x ^ (2n) = (x ^ n) * (x ^ n) and we can compute (x ^ n) only once.
  let result = halfResult.multiply(halfResult)

  // For odd powers, x ^ (2n + 1) = (x ^ 2n) * x
  if (power % 2 == 1) {
    result = result.multiply(value)
  }
  return result
}

const NULL_ETH_HEX_STRING = '0x0000000000000000000000000000000000000000000000000000000000000001'

export function isNullEthValue(value: string): boolean {
  return value == NULL_ETH_HEX_STRING
}

export function convertTokenToDecimal(tokenAmount: bigint, exchangeDecimals: bigint): number {
  if (exchangeDecimals == ZERO_BI) {
    return Number(tokenAmount)
  }
  return Number(safeDiv(new bigDecimal(tokenAmount), new bigDecimal(exponentToNumber(exchangeDecimals))).getValue());
}

export async function loadTransaction(event: EthereumLog): Promise<Transaction> {
  let transaction = await Transaction.get(event.transactionHash)
  if (transaction === undefined) {
    transaction = Transaction.create({
      id: event.transactionHash,
      blockNumber: BigInt(event.blockNumber),
      timestamp: BigInt(event.block.timestamp),
      gasUsed: BigInt(0), // needs to be moved to transaction receipt
      gasPrice: event.transaction.gasPrice || BigInt(0)
    })
  }
  // Always update transaction fields to match v4-subgraph behavior
  transaction.blockNumber = BigInt(event.blockNumber)
  transaction.timestamp = BigInt(event.block.timestamp)
  transaction.gasUsed = BigInt(0)
  transaction.gasPrice = event.transaction.gasPrice || BigInt(0)
  await transaction.save()
  return transaction
}
