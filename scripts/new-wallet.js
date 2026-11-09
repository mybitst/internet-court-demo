import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// 演示专用：收款钱包与付款钱包各生成一个，私钥只写到 ~/.hermes/secrets，不进仓库
const sellerKey = generatePrivateKey();
const agentKey = generatePrivateKey();
const seller = privateKeyToAccount(sellerKey);
const agent = privateKeyToAccount(agentKey);

const file = path.join(os.homedir(), ".hermes/secrets/internet-court-demo.env");
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(
  file,
  [
    `# 演示钱包，仅用于 Base Sepolia，不要放真钱`,
    `PAY_TO=${seller.address}`,
    `SELLER_PRIVATE_KEY=${sellerKey}`,
    `AGENT_ADDRESS=${agent.address}`,
    `AGENT_PRIVATE_KEY=${agentKey}`,
    ``,
  ].join("\n"),
  { mode: 0o600 },
);

console.log("收款地址", seller.address);
console.log("付款地址", agent.address);
console.log("私钥已写入", file, "权限 600");
console.log("下一步给付款地址领 Base Sepolia 测试 USDC");
