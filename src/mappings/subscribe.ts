import { SubscriptionLog } from '../types/abi-interfaces/PositionManager'
import { Subscribe } from '../types'
import { ONE_BI } from '../utils/constants'

export async function handleSubscription(log: SubscriptionLog): Promise<void> {
  if (!log.args) throw new Error('Log args are undefined')

  // Create Subscribe entity
  const subscribe = Subscribe.create({
    id: log.transactionHash + '-' + log.logIndex.toString(),
    transactionId: log.transactionHash,
    timestamp: BigInt(log.block.timestamp),
    tokenId: BigInt(log.args.tokenId.toString()),
    address: log.args.subscriber.toLowerCase(),
    logIndex: BigInt(log.logIndex),
    origin: log.transaction.from.toLowerCase(),
    positionId: log.args.tokenId.toString()
  })

  await subscribe.save()
}