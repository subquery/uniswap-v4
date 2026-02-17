import { ADDRESS_ZERO, ZERO_BI } from "./constants";
import { NativeTokenDetails } from "./nativeTokenDetails";
import {
  getStaticDefinition,
  StaticTokenDefinition,
} from "./staticTokenDefinition";
import { ERC20__factory } from "../types/contracts";
import { ethers } from "ethers";

// RPC timeout in milliseconds - allows for slower RPC nodes
const RPC_TIMEOUT_MS = 60000;

/**
 * Try to decode bytes32 symbol to string
 * Some tokens return bytes32 instead of string
 */
function decodeBytes32ToString(data: string): string {
  try {
    // Remove 0x prefix if present
    const hexString = data.startsWith("0x") ? data.slice(2) : data;
    // Convert hex to bytes
    const bytes = Buffer.from(hexString, "hex");
    // Find the null terminator
    const nullIndex = bytes.indexOf(0);
    const stringBytes = nullIndex === -1 ? bytes : bytes.slice(0, nullIndex);
    return stringBytes.toString("utf-8").trim();
  } catch {
    return "";
  }
}

/**
 * Check if error indicates "not implemented" (data="0x")
 * Returns true if should skip with default value
 * Returns false if should rethrow the error
 */
function isNotImplementedError(error: any): boolean {
  const errorData = (error.data || "").toLowerCase();
  return errorData === "0x" || errorData === "";
}

/**
 * Fetch token symbol from static definition or RPC
 * Tries string first, then bytes32 if needed
 * Matches v4-subgraph behavior: no caching, always retry
 * Throws on timeout to allow SubQuery to retry
 */
export async function fetchTokenSymbol(
  tokenAddress: string,
  tokenOverrides: StaticTokenDefinition[],
  nativeTokenDetails: NativeTokenDetails,
): Promise<string> {
  if (tokenAddress === ADDRESS_ZERO) {
    return nativeTokenDetails.symbol;
  }

  const staticTokenDefinition = getStaticDefinition(
    tokenAddress,
    tokenOverrides,
  );
  if (staticTokenDefinition != null) {
    return staticTokenDefinition.symbol;
  }

  const contract = ERC20__factory.connect(tokenAddress, api);

  // Try standard string symbol() call
  try {
    const result = await Promise.race([
      contract.symbol(),
      new Promise<string>((_, reject) =>
        setTimeout(
          () => reject(new Error(`symbol() timeout for ${tokenAddress}`)),
          RPC_TIMEOUT_MS,
        ),
      ),
    ]);
    return result;
  } catch (error: any) {
    // Check if it's "not implemented" - only skip in this case
    if (isNotImplementedError(error)) {
      return "unknown";
    }

    // All other errors: try bytes32 version, otherwise rethrow
    try {
      const iface = new ethers.utils.Interface([
        "function symbol() view returns (bytes32)",
      ]);
      const data = iface.encodeFunctionData("symbol", []);
      const result = await Promise.race([
        api.call({ to: tokenAddress, data }),
        new Promise<string>((_, reject) =>
          setTimeout(
            () =>
              reject(new Error(`symbol() bytes32 timeout for ${tokenAddress}`)),
            RPC_TIMEOUT_MS,
          ),
        ),
      ]);
      const decoded = iface.decodeFunctionResult("symbol", result);
      const symbol = decodeBytes32ToString(decoded[0]);
      if (symbol && symbol.length > 0) {
        return symbol;
      }
      // bytes32 returned empty
      return "unknown";
    } catch (bytesError: any) {
      // Check if bytes32 is also "not implemented"
      if (isNotImplementedError(bytesError)) {
        return "unknown";
      }
      // bytes32 also failed with other error, rethrow
      throw bytesError;
    }
  }
}

/**
 * Fetch token name from static definition or RPC
 * Tries string first, then bytes32 if needed
 * Matches v4-subgraph behavior: no caching, always retry
 * Throws on timeout to allow SubQuery to retry
 */
export async function fetchTokenName(
  tokenAddress: string,
  tokenOverrides: StaticTokenDefinition[],
  nativeTokenDetails: NativeTokenDetails,
): Promise<string> {
  if (tokenAddress === ADDRESS_ZERO) {
    return nativeTokenDetails.name;
  }

  const staticTokenDefinition = getStaticDefinition(
    tokenAddress,
    tokenOverrides,
  );
  if (staticTokenDefinition != null) {
    return staticTokenDefinition.name;
  }

  const contract = ERC20__factory.connect(tokenAddress, api);

  // Try standard string name() call
  try {
    const result = await Promise.race([
      contract.name(),
      new Promise<string>((_, reject) =>
        setTimeout(
          () => reject(new Error(`name() timeout for ${tokenAddress}`)),
          RPC_TIMEOUT_MS,
        ),
      ),
    ]);
    return result;
  } catch (error: any) {
    // Check if it's "not implemented" - only skip in this case
    if (isNotImplementedError(error)) {
      return "unknown";
    }

    // All other errors: try bytes32 version, otherwise rethrow
    try {
      const iface = new ethers.utils.Interface([
        "function name() view returns (bytes32)",
      ]);
      const data = iface.encodeFunctionData("name", []);
      const result = await Promise.race([
        api.call({ to: tokenAddress, data }),
        new Promise<string>((_, reject) =>
          setTimeout(
            () =>
              reject(new Error(`name() bytes32 timeout for ${tokenAddress}`)),
            RPC_TIMEOUT_MS,
          ),
        ),
      ]);
      const decoded = iface.decodeFunctionResult("name", result);
      const name = decodeBytes32ToString(decoded[0]);
      if (name && name.length > 0) {
        return name;
      }
      // bytes32 returned empty
      return "unknown";
    } catch (bytesError: any) {
      // Check if bytes32 is also "not implemented"
      if (isNotImplementedError(bytesError)) {
        return "unknown";
      }
      // bytes32 also failed with other error, rethrow
      throw bytesError;
    }
  }
}

/**
 * Fetch token total supply from RPC
 * Returns 0 if method fails or is not implemented
 * Throws on timeout to allow SubQuery to retry
 * Matches v4-subgraph behavior: no caching, always retry
 */
export async function fetchTokenTotalSupply(
  tokenAddress: string,
): Promise<bigint> {
  if (tokenAddress === ADDRESS_ZERO) {
    return ZERO_BI;
  }

  const contract = ERC20__factory.connect(tokenAddress, api);

  try {
    const totalSupply = await Promise.race([
      contract.totalSupply(),
      new Promise<any>((_, reject) =>
        setTimeout(
          () => reject(new Error(`totalSupply() timeout for ${tokenAddress}`)),
          RPC_TIMEOUT_MS,
        ),
      ),
    ]);
    return BigInt(totalSupply.toString());
  } catch (error: any) {
    // Check if it's "not implemented" - only skip in this case
    if (isNotImplementedError(error)) {
      return ZERO_BI;
    }

    // All other errors: rethrow to trigger SubQuery retry
    throw error;
  }
}

/**
 * Fetch token decimals from static definition or RPC
 * Returns null if method fails (matches v4-subgraph behavior)
 * Throws on timeout to allow SubQuery to retry
 * Matches v4-subgraph behavior: no caching, always retry
 */
export async function fetchTokenDecimals(
  tokenAddress: string,
  tokenOverrides: StaticTokenDefinition[],
  nativeTokenDetails: NativeTokenDetails,
): Promise<bigint | null> {
  if (tokenAddress === ADDRESS_ZERO) {
    return nativeTokenDetails.decimals;
  }

  // try with the static definition
  const staticTokenDefinition = getStaticDefinition(
    tokenAddress,
    tokenOverrides,
  );
  if (staticTokenDefinition != null) {
    return staticTokenDefinition.decimals;
  }

  const contract = ERC20__factory.connect(tokenAddress, api);

  try {
    const decimals = await Promise.race([
      contract.decimals(),
      new Promise<number>((_, reject) =>
        setTimeout(
          () => reject(new Error(`decimals() timeout for ${tokenAddress}`)),
          RPC_TIMEOUT_MS,
        ),
      ),
    ]);

    // Validate decimals value
    if (decimals >= 0 && decimals < 255) {
      return BigInt(decimals);
    }
  } catch (error: any) {
    // Check if it's "not implemented" - only skip in this case
    if (isNotImplementedError(error)) {
      return null;
    }

    // All other errors: rethrow to trigger SubQuery retry
    throw error;
  }

  return null;
}
