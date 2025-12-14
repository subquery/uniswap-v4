import { PoolDeployedLog, PoolUninstalledLog } from '../types/abi-interfaces/EulerSwapFactory'
import { EulerSwapHook } from '../types'

export async function handleHookDeployed(log: PoolDeployedLog): Promise<void> {
  if (!log.args) throw new Error('Log args are undefined')

  // Create EulerSwapHook entity
  const hook = EulerSwapHook.create({
    id: log.transactionHash + '-' + log.logIndex.toString(),
    hook: log.args.pool.toLowerCase(),
    asset0: log.args.asset0.toLowerCase(),
    asset1: log.args.asset1.toLowerCase(),
    eulerAccount: log.args.eulerAccount.toLowerCase()
  })

  await hook.save()
}

export async function handleHookUninstalled(log: PoolUninstalledLog): Promise<void> {
  if (!log.args) throw new Error('Log args are undefined')

  // For uninstall events, we could mark hooks as inactive or create a separate entity
  // For now, just create a record of the uninstall event
  const hook = EulerSwapHook.create({
    id: log.transactionHash + '-' + log.logIndex.toString() + '-uninstall',
    hook: log.args.pool.toLowerCase(),
    asset0: log.args.asset0.toLowerCase(),
    asset1: log.args.asset1.toLowerCase(),
    eulerAccount: log.args.eulerAccount.toLowerCase()
  })

  await hook.save()
}