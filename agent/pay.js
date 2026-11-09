import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// 读取演示钱包
const envPath = path.join(os.homedir(), ".hermes/secrets/internet-court-demo.env");
for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}

const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY);
const url = process.env.REPORT_URL || "http://127.0.0.1:4021/api/report?symbol=ETH";

const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: "eip155:84532", client: new ExactEvmScheme(account) }],
});

console.log("付款钱包", account.address);
console.log("请求", url);

const res = await fetchWithPayment(url, { method: "GET" });

console.log("HTTP 状态", res.status);
const paymentResponse = res.headers.get("payment-response") || res.headers.get("x-payment-response");
if (paymentResponse) {
  const decoded = JSON.parse(Buffer.from(paymentResponse, "base64").toString("utf8"));
  console.log("结算回执", JSON.stringify(decoded));
}

const text = await res.text();
let data;
try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 400) }; }
console.log("交付内容", JSON.stringify(data, null, 2));
