import { EthereumLog } from '@subql/types-ethereum'
import { Tick } from '../types'
import { ONE_BD, ZERO_BI } from './constants'
import { fastExponentiation, safeDiv } from './index'

export function createTick(tickId: string, tickIdx: number, poolId: string, event: EthereumLog): Tick {
  const tick = Tick.create({
    id: tickId,
    tickIdx: BigInt(tickIdx),
    poolId: poolId,
    createdAtTimestamp: BigInt(event.block.timestamp),
    createdAtBlockNumber: BigInt(event.blockNumber),
    liquidityGross: ZERO_BI,
    liquidityNet: ZERO_BI,
    price0: ONE_BD,
    price1: ONE_BD
  })

  return tick
}

export function feeTierToTickSpacing(feeTier: bigint): number {
  if (feeTier == BigInt(100)) {
    return 1
  }
  if (feeTier == BigInt(500)) {
    return 10
  }
  if (feeTier == BigInt(3000)) {
    return 60
  }
  if (feeTier == BigInt(10000)) {
    return 200
  }

  throw new Error('Unexpected fee tier')
}