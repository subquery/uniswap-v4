import * as fs from "fs";
import * as path from "path";

// API 密钥（从环境变量读取）
const ONFINALITY_API_KEY = process.env.ONFINALITY_API_KEY || "";

if (!ONFINALITY_API_KEY) {
  console.warn(
    "警告: ONFINALITY_API_KEY 未设置。请设置环境变量 ONFINALITY_API_KEY",
  );
}

// 网络配置
interface NetworkConfig {
  endpoint: string;
  deploymentPath: string;
  batchSize: number;
}

const NETWORK_CONFIGS: Record<string, NetworkConfig> = {
  mainnet: {
    endpoint: `https://eth.api.onfinality.io/rpc?apikey=${ONFINALITY_API_KEY}`,
    deploymentPath: "uniswap-v3-ethereum",
    batchSize: 50,
  },
  sepolia: {
    endpoint: `https://eth-sepolia.api.onfinality.io/rpc?apikey=${ONFINALITY_API_KEY}`,
    deploymentPath: "uniswap-v4-sepolia",
    batchSize: 50,
  },
  "arbitrum-one": {
    endpoint: `https://arbitrum.api.onfinality.io/rpc?apikey=${ONFINALITY_API_KEY}`,
    deploymentPath: "uniswap-v4-arbitrum-one",
    batchSize: 50,
  },
  "arbitrum-sepolia": {
    endpoint: `https://arbitrum-sepolia.api.onfinality.io/rpc?apikey=${ONFINALITY_API_KEY}`,
    deploymentPath: "uniswap-v4-arbitrum-sepolia",
    batchSize: 50,
  },
  base: {
    endpoint: `https://base.api.onfinality.io/rpc?apikey=${ONFINALITY_API_KEY}`,
    deploymentPath: "uniswap-v4-base",
    batchSize: 50,
  },
  "base-sepolia": {
    endpoint: `https://base-sepolia.api.onfinality.io/rpc?apikey=${ONFINALITY_API_KEY}`,
    deploymentPath: "uniswap-v4-base-sepolia",
    batchSize: 50,
  },
  matic: {
    endpoint: `https://polygon.api.onfinality.io/rpc?apikey=${ONFINALITY_API_KEY}`,
    deploymentPath: "uniswap-v4-matic",
    batchSize: 50,
  },
  bsc: {
    endpoint: `https://bnb.api.onfinality.io/rpc?apikey=${ONFINALITY_API_KEY}`,
    deploymentPath: "uniswap-v4-bsc",
    batchSize: 50,
  },
  optimism: {
    endpoint: `https://optimism.api.onfinality.io/rpc?apikey=${ONFINALITY_API_KEY}`,
    deploymentPath: "uniswap-v4-optimism",
    batchSize: 50,
  },
  avalanche: {
    endpoint: `https://avalanche.api.onfinality.io/rpc/ext/bc/C/rpc?apikey=${ONFINALITY_API_KEY}`,
    deploymentPath: "uniswap-v4-avalanche",
    batchSize: 50,
  },
  "worldchain-mainnet": {
    endpoint: `https://worldchain-mainnet.g.alchemy.com/public`,
    deploymentPath: "uniswap-v4-worldchain-mainnet",
    batchSize: 30,
  },
  "zora-mainnet": {
    endpoint: `https://rpc.zora.energy`,
    deploymentPath: "uniswap-v4-zora-mainnet",
    batchSize: 30,
  },
  "blast-mainnet": {
    endpoint: `https://rpc.blast.io`,
    deploymentPath: "uniswap-v4-blast-mainnet",
    batchSize: 30,
  },
  unichain: {
    endpoint: `https://unichain.api.onfinality.io/rpc?apikey=${ONFINALITY_API_KEY}`,
    deploymentPath: "uniswap-v4-unichain",
    batchSize: 50,
  },
  "unichain-sepolia": {
    endpoint: `https://unichain-sepolia.api.onfinality.io/rpc?apikey=${ONFINALITY_API_KEY}`,
    deploymentPath: "uniswap-v4-unichain-sepolia",
    batchSize: 50,
  },
  "soneium-mainnet": {
    endpoint: `https://rpc.soneium.org`,
    deploymentPath: "uniswap-v4-soneium-mainnet",
    batchSize: 30,
  },
  celo: {
    endpoint: `https://celo.api.onfinality.io/rpc?apikey=${ONFINALITY_API_KEY}`,
    deploymentPath: "uniswap-v4-celo",
    batchSize: 50,
  },
  monad: {
    endpoint: `https://monad-mainnet.api.onfinality.io/rpc?apikey=${ONFINALITY_API_KEY}`,
    deploymentPath: "uniswap-v4-monad",
    batchSize: 50,
  },
  "xlayer-mainnet": {
    endpoint: `https://rpc.xlayer.tech`,
    deploymentPath: "uniswap-v4-xlayer",
    batchSize: 30,
  },
  "megaeth-mainnet": {
    endpoint: `https://mainnet.megaeth.com/rpc`,
    deploymentPath: "uniswap-v4-megaeth",
    batchSize: 30,
  },
};

// 静态配置
const DEFAULT_CONFIG = {
  indexerImageVersion: "v6.3.1",
  queryImageVersion: "v2.25.0",
};

interface DeployStatus {
  network: string;
  status: string;
  cid: string;
  deployedAt: string;
}

interface DeployStatusFile {
  lastUpdated: string;
  networks: DeployStatus[];
}

// 读取 deploy-status.json
function readDeployStatus(): DeployStatusFile {
  const filePath = path.join(__dirname, "../deploy-status.json");
  const content = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(content);
}

// 读取模板文件
function readTemplate(): string {
  const filePath = path.join(
    __dirname,
    "./generate-browser-scripts-template.js",
  );
  return fs.readFileSync(filePath, "utf-8");
}

// 生成单个网络的浏览器脚本
// 模板文件: scripts/generate-browser-scripts-template.js
function generateBrowserScript(
  network: string,
  deploymentPath: string,
  cid: string,
  endpoint: string,
  batchSize: number,
): string {
  const template = readTemplate();

  const script = template
    .replace(/__DEPLOYMENT_PATH__/g, deploymentPath)
    .replace(/__NETWORK__/g, network)
    .replace(/__CID__/g, cid)
    .replace(/__ENDPOINT__/g, endpoint)
    .replace(/__INDEXER_IMAGE_VERSION__/g, DEFAULT_CONFIG.indexerImageVersion)
    .replace(/__BATCH_SIZE__/g, batchSize.toString())
    .replace(/__QUERY_IMAGE_VERSION__/g, DEFAULT_CONFIG.queryImageVersion);

  return script;
}

// 主函数
function main() {
  // 检查是否所有网络都配置了端点
  const deployStatus = readDeployStatus();
  const networks = deployStatus.networks;

  for (const network of networks) {
    const config = NETWORK_CONFIGS[network.network];

    if (!config) {
      console.warn(`警告: ${network.network} 未配置，跳过生成`);
      continue;
    }

    // 创建 browser-scripts 目录
    const browserScriptsDir = path.join(__dirname, "./browser-scripts");
    if (!fs.existsSync(browserScriptsDir)) {
      fs.mkdirSync(browserScriptsDir, { recursive: true });
    }

    // 生成脚本文件
    const scriptContent = generateBrowserScript(
      network.network,
      config.deploymentPath,
      network.cid,
      config.endpoint,
      config.batchSize,
    );
    const scriptPath = path.join(browserScriptsDir, `${network.network}.js`);

    fs.writeFileSync(scriptPath, scriptContent, "utf-8");
    console.log(`✓ 生成: ${scriptPath}`);
  }

  console.log("\n✓ 所有脚本生成完毕");
}

main();
