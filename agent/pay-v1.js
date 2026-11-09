import { wrapFetchWithPayment, decodeXPaymentResponse } from "x402-fetch";
import { privateKeyToAccount } from "viem/accounts";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const envPath = path.join(os.homedir(), ".hermes/secrets/internet-court-demo.env");
for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}

const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY);
const url = process.env.REPORT_URL || "http://127.0.0.1:4022/api/report?symbol=ETH";
const fetchWithPayment = wrapFetchWithPayment(fetch, account);

console.log("付款钱包", account.address);
const res = await fetchWithPayment(url, { method: "GET" });
console.log("HTTP", res.status);
const header = res.headers.get("x-payment-response");
if (header) {
  try { console.log("结算回执", JSON.stringify(decodeXPaymentResponse(header))); }
  catch { console.log("回执原文", header); }
}
const text = await res.text();
console.log("交付内容", text.slice(0, 600));
