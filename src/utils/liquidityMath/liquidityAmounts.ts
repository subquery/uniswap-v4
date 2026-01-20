import { ZERO_BI } from '../constants'
import { getAmount0Delta, getAmount1Delta } from './sqrtPriceMath'
import { getSqrtRatioAtTick } from './tickMath'

// https://github.com/Uniswap/v3-sdk/blob/4e16fe8e56c8c26541545f138c89133794c7ce72/src/entities/position.ts#L68-L127
export function getAmount0(
  tickLower: number,
  tickUpper: number,
  currTick: number,
  amount: bigint,
  currSqrtPriceX96: bigint,
): bigint {
  const sqrtRatioAX96 = getSqrtRatioAtTick(tickLower)
  const sqrtRatioBX96 = getSqrtRatioAtTick(tickUpper)

  let amount0 = ZERO_BI
  const roundUp = amount > ZERO_BI

  if (currTick < tickLower) {
    amount0 = getAmount0Delta(sqrtRatioAX96, sqrtRatioBX96, amount, roundUp)
  } else if (currTick < tickUpper) {
    amount0 = getAmount0Delta(currSqrtPriceX96, sqrtRatioBX96, amount, roundUp)
  } else {
    amount0 = ZERO_BI
  }

  return amount0
}

export function getAmount1(
  tickLower: number,
  tickUpper: number,
  currTick: number,
  amount: bigint,
  currSqrtPriceX96: bigint,
): bigint {
  const sqrtRatioAX96 = getSqrtRatioAtTick(tickLower)
  const sqrtRatioBX96 = getSqrtRatioAtTick(tickUpper)

  let amount1 = ZERO_BI
  const roundUp = amount > ZERO_BI

  if (currTick < tickLower) {
    amount1 = ZERO_BI
  } else if (currTick < tickUpper) {
    amount1 = getAmount1Delta(sqrtRatioAX96, currSqrtPriceX96, amount, roundUp)
  } else {
    amount1 = getAmount1Delta(sqrtRatioAX96, sqrtRatioBX96, amount, roundUp)
  }

  return amount1
}
