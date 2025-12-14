// Auto-generated , please modify to ensure correctness

import {
  EthereumProject,
  EthereumDatasourceKind,
  EthereumHandlerKind,
} from "@subql/types-ethereum";

// Can expand the Datasource processor types via the generic param
const project: EthereumProject = {
  specVersion: "1.0.0",
  version: "0.0.4",
  name: "uniswap-v4-subquery",
  description:
    "Uniswap is a decentralized protocol for automated token exchange on Ethereum.",
  runner: {
    node: {
      name: "@subql/node-ethereum",
      version: ">=6.0.0",
    },
    query: {
      name: "@subql/query",
      version: "*",
    },
  },
  schema: {
    file: "./schema.graphql",
  },
  network: {
    chainId: "1",
    /**
     * These endpoint(s) should be public non-pruned archive node
     * We recommend providing more than one endpoint for improved reliability, performance, and uptime
     * Public nodes may be rate limited, which can affect indexing speed
     * When developing your project we suggest getting a private API key
     * If you use a rate limited endpoint, adjust the --batch-size and --workers parameters
     * These settings can be found in your docker-compose.yaml, they will slow indexing but prevent your project being rate limited
     */
    endpoint: ["https://eth.llamarpc.com"],
  },
  dataSources: [
    {
      kind: EthereumDatasourceKind.Runtime,
      startBlock: 21688329,
      options: {
        abi: "PoolManager",
        address: "0x000000000004444c5dc75cB358380D2e3dE08A90",
      },
      assets: new Map([
        ["ERC20", { file: "./abis/ERC20.json" }],
        ["ERC20SymbolBytes", { file: "./abis/ERC20SymbolBytes.json" }],
        ["ERC20NameBytes", { file: "./abis/ERC20NameBytes.json" }],
        ["PoolManager", { file: "./abis/PoolManager.json" }],
      ]),
      mapping: {
        file: "./dist/index.js",
        handlers: [
          {
            kind: EthereumHandlerKind.Event,
            handler: "handleInitialize",
            filter: {
              topics: [
                "Initialize(bytes32,address,address,uint24,int24,address,uint160,int24)",
              ],
            },
          },
          {
            kind: EthereumHandlerKind.Event,
            handler: "handleModifyLiquidity",
            filter: {
              topics: [
                "ModifyLiquidity(bytes32,address,int24,int24,int256,bytes32)",
              ],
            },
          },
          {
            kind: EthereumHandlerKind.Event,
            handler: "handleSwap",
            filter: {
              topics: [
                "Swap(bytes32,address,int128,int128,uint160,uint128,int24,uint24)",
              ],
            },
          },
        ],
      },
    },
    {
      kind: EthereumDatasourceKind.Runtime,
      startBlock: 21689089,
      options: {
        abi: "PositionManager",
        address: "0xbD216513d74C8cf14cf4747E6AaA6420FF64ee9e",
      },
      assets: new Map([
        ["PositionManager", { file: "./abis/PositionManager.json" }],
      ]),
      mapping: {
        file: "./dist/index.js",
        handlers: [
          {
            kind: EthereumHandlerKind.Event,
            handler: "handleSubscription",
            filter: { topics: ["Subscription(uint256,address)"] },
          },
          {
            kind: EthereumHandlerKind.Event,
            handler: "handleUnsubscription",
            filter: { topics: ["Unsubscription(uint256,address)"] },
          },
          {
            kind: EthereumHandlerKind.Event,
            handler: "handleTransfer",
            filter: { topics: ["Transfer(address,address,uint256)"] },
          },
        ],
      },
    },
    {
      kind: EthereumDatasourceKind.Runtime,
      startBlock: 22676162,
      options: {
        abi: "EulerSwapFactory",
        address: "0xb013be1D0D380C13B58e889f412895970A2Cf228",
      },
      assets: new Map([
        ["EulerSwapFactory", { file: "./abis/EulerSwapFactory.json" }],
      ]),
      mapping: {
        file: "./dist/index.js",
        handlers: [
          {
            kind: EthereumHandlerKind.Event,
            handler: "handleHookDeployed",
            filter: {
              topics: ["PoolDeployed(address,address,address,address)"],
            },
          },
          {
            kind: EthereumHandlerKind.Event,
            handler: "handleHookUninstalled",
            filter: {
              topics: ["PoolUninstalled(address,address,address,address)"],
            },
          },
        ],
      },
    },
  ],
  repository: "https://github.com/Uniswap/v4-subgraph",
};

// Must set default to the project instance
export default project;
