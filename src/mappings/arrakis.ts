import { LogCreatePrivateHookLog } from '../types/abi-interfaces/ArrakisHookFactory'
import { ArrakisHook } from '../types'

export async function handleArrakisHookDeployed(log: LogCreatePrivateHookLog): Promise<void> {
  if (!log.args) throw new Error('Log args are undefined')

  // Create ArrakisHook entity using hook address as ID (matching original subgraph)
  const hook = ArrakisHook.create({
    id: log.args.hook.toLowerCase(),
    module: log.args.module.toLowerCase(),
    salt: log.args.salt,
    createdAtTimestamp: BigInt(log.block.timestamp),
    createdAtBlockNumber: BigInt(log.block.number)
  })

  await hook.save()
}
