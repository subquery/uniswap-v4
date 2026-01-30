import { ADDRESS_ZERO, ZERO_BI } from './constants'
import { isNullEthValue } from './index'
import { NativeTokenDetails } from './nativeTokenDetails'
import { getStaticDefinition, StaticTokenDefinition } from './staticTokenDefinition'
import { ERC20__factory } from '../types/contracts'

// Timeout wrapper to prevent RPC calls from hanging indefinitely
// Throws error on both timeout and actual errors to ensure data quality
async function withTimeout<T>(
  promise: Promise<T>, 
  timeoutMs: number, 
  operationName: string,
  tokenAddress: string
): Promise<T> {
  let didTimeout = false
  
  const timeoutPromise = new Promise<T>((_, reject) => setTimeout(() => {
    didTimeout = true
    const error = new Error(`${operationName} for token ${tokenAddress} timed out after ${timeoutMs}ms`)
    logger.warn(`[TIMEOUT] ${error.message} - SubQuery will retry this block`)
    reject(error)
  }, timeoutMs))

  try {
    const result = await Promise.race([promise, timeoutPromise])
    
    // Log success
    if (!didTimeout) {
    }
    
    return result
  } catch (error) {
    // Error occurred (timeout or real error) - throw it so SubQuery can retry the block
    if (!didTimeout) {
      logger.error(`[FATAL] ${operationName} for token ${tokenAddress} failed: ${error} - SubQuery will retry this block`)
    }
    throw error
  }
}

// Timeout for RPC calls (60 seconds - allows for slower RPC nodes)
const RPC_TIMEOUT_MS = 60000

export async function fetchTokenSymbol(
  tokenAddress: string,
  tokenOverrides: StaticTokenDefinition[],
  nativeTokenDetails: NativeTokenDetails,
): Promise<string> {
  if (tokenAddress === ADDRESS_ZERO) {
    return nativeTokenDetails.symbol
  }
  // try with the static definition
  const staticTokenDefinition = getStaticDefinition(tokenAddress, tokenOverrides)
  if (staticTokenDefinition != null) {
    return staticTokenDefinition.symbol
  }

  const contract = ERC20__factory.connect(tokenAddress, api)
  const symbol = await withTimeout(contract.symbol(), RPC_TIMEOUT_MS, 'fetchTokenSymbol', tokenAddress)
  return symbol
}

export async function fetchTokenName(
  tokenAddress: string,
  tokenOverrides: StaticTokenDefinition[],
  nativeTokenDetails: NativeTokenDetails,
): Promise<string> {
  if (tokenAddress === ADDRESS_ZERO) {
    return nativeTokenDetails.name
  }
  // try with the static definition
  const staticTokenDefinition = getStaticDefinition(tokenAddress, tokenOverrides)
  if (staticTokenDefinition != null) {
    return staticTokenDefinition.name
  }

  const contract = ERC20__factory.connect(tokenAddress, api)
  const name = await withTimeout(contract.name(), RPC_TIMEOUT_MS, 'fetchTokenName', tokenAddress)
  return name
}

export async function fetchTokenTotalSupply(tokenAddress: string): Promise<bigint> {
  if (tokenAddress === ADDRESS_ZERO) {
    return ZERO_BI
  }

  const contract = ERC20__factory.connect(tokenAddress, api)
  const totalSupply = await withTimeout(contract.totalSupply(), RPC_TIMEOUT_MS, 'fetchTokenTotalSupply', tokenAddress)
  return BigInt(totalSupply.toString())
}

export async function fetchTokenDecimals(tokenAddress: string, nativeTokenDetails: NativeTokenDetails): Promise<bigint> {
  if (tokenAddress === ADDRESS_ZERO) {
    return nativeTokenDetails.decimals
  }

  const contract = ERC20__factory.connect(tokenAddress, api)
  const decimals = await withTimeout(contract.decimals(), RPC_TIMEOUT_MS, 'fetchTokenDecimals', tokenAddress)
  return BigInt(decimals)
}