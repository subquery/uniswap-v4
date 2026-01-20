import { EthereumLog } from '@subql/types-ethereum'
import { Transaction } from '../types'
import { ONE_BD, ONE_BI, ZERO_BD, ZERO_BI } from '../utils/constants'
import bigDecimal from "js-big-decimal";

export function exponentToNumber(decimals: bigint): bigint {
  let result = BigInt(1);
  for (let i = ZERO_BI; i < decimals; i += ONE_BI) {
    result = result * BigInt(10);
  }
  return result;
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
      gasPrice: BigInt(0) // event.transaction.gasPrice - may need to fetch separately
    })
    await transaction.save()
  }
  return transaction
}
