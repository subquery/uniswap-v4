import { ADDRESS_ZERO, ZERO_BI } from './constants'
import { NativeTokenDetails } from './nativeTokenDetails'
import { getStaticDefinition, StaticTokenDefinition } from './staticTokenDefinition'
import { ERC20__factory } from '../types/contracts'
import { ethers } from 'ethers'

// RPC timeout in milliseconds - allows for slower RPC nodes
const RPC_TIMEOUT_MS = 60000

/**
 * Try to decode bytes32 symbol to string
 * Some tokens return bytes32 instead of string
 */
function decodeBytes32ToString(data: string): string {
  try {
    // Remove 0x prefix if present
    const hexString = data.startsWith('0x') ? data.slice(2) : data
    // Convert hex to bytes
    const bytes = Buffer.from(hexString, 'hex')
    // Find the null terminator
    const nullIndex = bytes.indexOf(0)
    const stringBytes = nullIndex === -1 ? bytes : bytes.slice(0, nullIndex)
    return stringBytes.toString('utf-8').trim()
  } catch {
    return ''
  }
}

/**
 * Fetch token symbol from static definition or RPC
 * Handles both standard string and bytes32 returns
 */
export async function fetchTokenSymbol(
  tokenAddress: string,
  tokenOverrides: StaticTokenDefinition[],
  nativeTokenDetails: NativeTokenDetails,
): Promise<string> {
  if (tokenAddress === ADDRESS_ZERO) {
    return nativeTokenDetails.symbol
  }
  
  const staticTokenDefinition = getStaticDefinition(tokenAddress, tokenOverrides)
  if (staticTokenDefinition != null) {
    return staticTokenDefinition.symbol
  }

  // Try standard string symbol() call
  try {
    const contract = ERC20__factory.connect(tokenAddress, api)
    return await Promise.race([
      contract.symbol(),
      new Promise<string>((_, reject) => 
        setTimeout(() => reject(new Error(`symbol() timeout for ${tokenAddress}`)), RPC_TIMEOUT_MS)
      )
    ])
  } catch (error: any) {
    // Try bytes32 version using low-level call
    try {
      const iface = new ethers.utils.Interface(['function symbol() view returns (bytes32)'])
      const data = iface.encodeFunctionData('symbol', [])
      const result = await Promise.race([
        api.call({ to: tokenAddress, data }),
        new Promise<string>((_, reject) => 
          setTimeout(() => reject(new Error(`symbol() bytes32 timeout for ${tokenAddress}`)), RPC_TIMEOUT_MS)
        )
      ])
      const decoded = iface.decodeFunctionResult('symbol', result)
      const symbol = decodeBytes32ToString(decoded[0])
      if (symbol.length > 0) {
        return symbol
      }
    } catch {
      // bytes32 attempt also failed, let original error propagate
    }
    
    // Both attempts failed, rethrow original error
    throw error
  }
}

/**
 * Fetch token name from static definition or RPC
 * Handles both standard string and bytes32 returns
 */
export async function fetchTokenName(
  tokenAddress: string,
  tokenOverrides: StaticTokenDefinition[],
  nativeTokenDetails: NativeTokenDetails,
): Promise<string> {
  if (tokenAddress === ADDRESS_ZERO) {
    return nativeTokenDetails.name
  }
  
  const staticTokenDefinition = getStaticDefinition(tokenAddress, tokenOverrides)
  if (staticTokenDefinition != null) {
    return staticTokenDefinition.name
  }

  // Try standard string name() call
  try {
    const contract = ERC20__factory.connect(tokenAddress, api)
    return await Promise.race([
      contract.name(),
      new Promise<string>((_, reject) => 
        setTimeout(() => reject(new Error(`name() timeout for ${tokenAddress}`)), RPC_TIMEOUT_MS)
      )
    ])
  } catch (error: any) {
    // Try bytes32 version using low-level call
    try {
      const iface = new ethers.utils.Interface(['function name() view returns (bytes32)'])
      const data = iface.encodeFunctionData('name', [])
      const result = await Promise.race([
        api.call({ to: tokenAddress, data }),
        new Promise<string>((_, reject) => 
          setTimeout(() => reject(new Error(`name() bytes32 timeout for ${tokenAddress}`)), RPC_TIMEOUT_MS)
        )
      ])
      const decoded = iface.decodeFunctionResult('name', result)
      const name = decodeBytes32ToString(decoded[0])
      if (name.length > 0) {
        return name
      }
    } catch {
      // bytes32 attempt also failed, let original error propagate
    }
    
    // Both attempts failed, rethrow original error
    throw error
  }
}

/**
 * Fetch token total supply from RPC
 */
export async function fetchTokenTotalSupply(tokenAddress: string): Promise<bigint> {
  if (tokenAddress === ADDRESS_ZERO) {
    return ZERO_BI
  }
  
  const contract = ERC20__factory.connect(tokenAddress, api)
  const totalSupply = await Promise.race([
    contract.totalSupply(),
    new Promise<any>((_, reject) => 
      setTimeout(() => reject(new Error(`totalSupply() timeout for ${tokenAddress}`)), RPC_TIMEOUT_MS)
    )
  ])
  return BigInt(totalSupply.toString())
}

/**
 * Fetch token decimals from static definition or RPC
 * Critical for accurate price calculations
 */
export async function fetchTokenDecimals(
  tokenAddress: string, 
  nativeTokenDetails: NativeTokenDetails
): Promise<bigint> {
  if (tokenAddress === ADDRESS_ZERO) {
    return nativeTokenDetails.decimals
  }

  const staticTokenDefinition = getStaticDefinition(tokenAddress, [])
  if (staticTokenDefinition != null) {
    return staticTokenDefinition.decimals
  }

  // RPC call with timeout - let SubQuery retry on failure
  const contract = ERC20__factory.connect(tokenAddress, api)
  const decimals = await Promise.race([
    contract.decimals(),
    new Promise<number>((_, reject) => 
      setTimeout(() => reject(new Error(`decimals() timeout for ${tokenAddress}`)), RPC_TIMEOUT_MS)
    )
  ])
  
  if (decimals < 0 || decimals >= 255) {
    throw new Error(`Invalid decimals ${decimals} for token ${tokenAddress}`)
  }
  
  return BigInt(decimals)
}