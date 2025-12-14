export class NativeTokenDetails {
  symbol: string
  name: string
  decimals: bigint

  constructor(symbol: string, name: string, decimals: bigint) {
    this.symbol = symbol
    this.name = name
    this.decimals = decimals
  }
}