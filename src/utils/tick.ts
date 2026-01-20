import { EthereumLog } from '@subql/types-ethereum'
import { Tick } from '../types'
import { ONE_BD, ZERO_BI } from './constants'
import { fastExponentiation, safeDiv } from './index'
import bigDecimal from "js-big-decimal";

export function createTick(tickId: string, tickIdx: number, poolId: string, event: EthereumLog): Tick {
  const tick = Tick.create({
    id: tickId,
    tickIdx: BigInt(tickIdx),
    poolId: poolId,
    createdAtTimestamp: BigInt(event.block.timestamp),
    createdAtBlockNumber: BigInt(event.blockNumber),
    liquidityGross: ZERO_BI,
    liquidityNet: ZERO_BI,
    price0: 1,
    price1: 1
  })

  // 1.0001^tick is token1/token0.
  const price0 = fastExponentiation(new bigDecimal('1.0001'), tickIdx)
  tick.price0 = Number(price0.getValue())
  tick.price1 = Number(safeDiv(ONE_BD, price0).getValue())

  return tick
}