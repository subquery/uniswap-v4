import { ADDRESS_ZERO, ZERO_BI } from './constants'
import { isNullEthValue } from './index'
import { NativeTokenDetails } from './nativeTokenDetails'
import { getStaticDefinition, StaticTokenDefinition } from './staticTokenDefinition'
import { ERC20__factory } from '../types/contracts'

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

  try {
    const contract = ERC20__factory.connect(tokenAddress, api)
    const symbol = await contract.symbol()
    return symbol
  } catch (error) {
    logger.warn(`Failed to fetch symbol for token ${tokenAddress}: ${error}`)
    return 'unknown'
  }
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

  try {
    const contract = ERC20__factory.connect(tokenAddress, api)
    const name = await contract.name()
    return name
  } catch (error) {
    logger.warn(`Failed to fetch name for token ${tokenAddress}: ${error}`)
    return 'unknown'
  }
}

export async function fetchTokenTotalSupply(tokenAddress: string): Promise<bigint> {
  if (tokenAddress === ADDRESS_ZERO) {
    return ZERO_BI
  }

  try {
    const contract = ERC20__factory.connect(tokenAddress, api)
    const totalSupply = await contract.totalSupply()
    return BigInt(totalSupply.toString())
  } catch (error) {
    logger.warn(`Failed to fetch total supply for token ${tokenAddress}: ${error}`)
    return ZERO_BI
  }
}

export async function fetchTokenDecimals(tokenAddress: string, nativeTokenDetails: NativeTokenDetails): Promise<bigint> {
  if (tokenAddress === ADDRESS_ZERO) {
    return nativeTokenDetails.decimals
  }

  try {
    const contract = ERC20__factory.connect(tokenAddress, api)
    const decimals = await contract.decimals()
    return BigInt(decimals)
  } catch (error) {
    logger.warn(`Failed to fetch decimals for token ${tokenAddress}: ${error}`)
    return BigInt(18)
  }
}