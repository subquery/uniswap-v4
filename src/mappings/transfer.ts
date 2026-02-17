import { TransferLog } from '../types/abi-interfaces/PositionManager'
import { Position, Transfer } from '../types'
import { loadTransaction } from '../utils'

export async function handleTransfer(log: TransferLog): Promise<void> {
  if (!log.args) throw new Error('Log args are undefined')

  const tokenId = log.args.id.toString()
  const from = log.args.from.toLowerCase()
  const to = log.args.to.toLowerCase()

  // Load or create Position entity
  let position = await Position.get(tokenId)
  if (position === undefined) {
    position = Position.create({
      id: tokenId,
      tokenId: BigInt(log.args.id.toString()),
      owner: to,  // Initial owner is the 'to' address
      origin: log.transaction.from.toLowerCase(),
      createdAtTimestamp: BigInt(log.block.timestamp)
    })
  } else {
    // Update owner to the new recipient
    position.owner = to
  }

  await position.save()

  const transaction = await loadTransaction(log)

  // Create Transfer entity
  const transfer = Transfer.create({
    id: transaction.id + '-' + log.logIndex.toString(),
    transactionId: transaction.id,
    timestamp: transaction.timestamp,
    from: from,
    to: to,
    tokenId: BigInt(log.args.id.toString()),
    logIndex: BigInt(log.logIndex),
    origin: log.transaction.from.toLowerCase(),
    positionId: position.id
  })

  await transfer.save()
}