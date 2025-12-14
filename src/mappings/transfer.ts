import { TransferLog } from '../types/abi-interfaces/PositionManager'
import { Transfer } from '../types'

export async function handleTransfer(log: TransferLog): Promise<void> {
  if (!log.args) throw new Error('Log args are undefined')

  // Create Transfer entity
  const transfer = Transfer.create({
    id: log.transactionHash + '-' + log.logIndex.toString(),
    transactionId: log.transactionHash,
    timestamp: BigInt(log.block.timestamp),
    from: log.args.from.toLowerCase(),
    to: log.args.to.toLowerCase(),
    tokenId: BigInt(log.args.id.toString()),
    logIndex: BigInt(log.logIndex),
    origin: log.transaction.from.toLowerCase(),
    positionId: log.args.id.toString()
  })

  await transfer.save()
}