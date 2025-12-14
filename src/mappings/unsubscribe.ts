import { UnsubscriptionLog } from '../types/abi-interfaces/PositionManager'
import { Unsubscribe } from '../types'

export async function handleUnsubscription(log: UnsubscriptionLog): Promise<void> {
  if (!log.args) throw new Error('Log args are undefined')

  // Create Unsubscribe entity
  const unsubscribe = Unsubscribe.create({
    id: log.transactionHash + '-' + log.logIndex.toString(),
    transactionId: log.transactionHash,
    timestamp: BigInt(log.block.timestamp),
    tokenId: BigInt(log.args.tokenId.toString()),
    address: log.args.subscriber.toLowerCase(),
    logIndex: BigInt(log.logIndex),
    origin: log.transaction.from.toLowerCase(),
    positionId: log.args.tokenId.toString()
  })

  await unsubscribe.save()
}