import fs from "node:fs";
import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

const keyPath = process.env.STUDIO_KEY || "/tmp/gldeploy/key.txt";
const account = createAccount(fs.readFileSync(keyPath, "utf8").trim());
const client = createClient({ chain: studionet, account });

const requirement =
  process.env.REQUIREMENT ||
  "必须包含 ETH 现价和资金费率两项数值，每项都要带一个可打开的来源链接";

const code = fs.readFileSync(new URL("../contracts/delivery_judge.py", import.meta.url), "utf8");

const hash = await client.deployContract({ code, args: [requirement] });
console.log("部署交易", hash);

const receipt = await client.waitForTransactionReceipt({ hash, retries: 60, interval: 3000 });
const address = receipt?.data?.contract_address || receipt?.to_address;
console.log("合约地址", address);
console.log("状态", receipt?.status, "执行", receipt?.consensus_data?.leader_receipt?.[0]?.execution_result);

fs.writeFileSync(new URL("../.deployed.json", import.meta.url), JSON.stringify({ address, hash, requirement }, null, 2));
