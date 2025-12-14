// Initialize a Token Definition with the attributes
export class StaticTokenDefinition {
  address: string
  symbol: string
  name: string
  decimals: bigint

  constructor(address: string, symbol: string, name: string, decimals: bigint) {
    this.address = address
    this.symbol = symbol
    this.name = name
    this.decimals = decimals
  }
}

export const getStaticDefinition = (
  tokenAddress: string,
  staticDefinitions: Array<StaticTokenDefinition>,
): StaticTokenDefinition | null => {
  const tokenAddressHex = tokenAddress.toLowerCase()

  // Search the definition using the address
  for (let i = 0; i < staticDefinitions.length; i++) {
    const staticDefinition = staticDefinitions[i]
    if (staticDefinition.address.toLowerCase() == tokenAddressHex) {
      return staticDefinition
    }
  }

  // If not found, return null
  return null
}