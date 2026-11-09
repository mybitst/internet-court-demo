import { wrapFetchWithPayment, decodeXPaymentResponse } from "x402-fetch";
import { privateKeyToAccount } from "viem/accounts";
import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const envPath = path.join(os.homedir(), ".hermes/secrets/internet-court-demo.env");
for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}

const deployed = JSON.parse(fs.readFileSync(new URL("../.deployed.json", import.meta.url)));
const JUDGE = process.env.JUDGE_ADDRESS || deployed.address;
const REPORT_URL = process.env.REPORT_URL || "http://127.0.0.1:4022/api/report?symbol=ETH";
const PUBLIC_REPORT_URL = process.env.PUBLIC_REPORT_URL;

const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY);
const fetchWithPayment = wrapFetchWithPayment(fetch, account);

console.log("1 请求付费报告", REPORT_URL);
const res = await fetchWithPayment(REPORT_URL, { method: "GET" });
console.log("2 HTTP", res.status);
if (res.status !== 200) {
  console.log("付款失败", await res.text());
  process.exit(1);
}

const header = res.headers.get("x-payment-response");
if (header) {
  const receipt = decodeXPaymentResponse(header);
  console.log("3 结算回执", JSON.stringify(receipt));
  fs.writeFileSync(new URL("../.last-payment.json", import.meta.url), JSON.stringify(receipt, null, 2));
}

const report = await res.json();
console.log("4 收到交付", report.product, "事实", report.facts.length, "条");

if (!PUBLIC_REPORT_URL && !report.report_url) {
  console.log("没有公开报告地址，跳过链上判定");
  process.exit(0);
}

const judgeUrl = report.report_url || PUBLIC_REPORT_URL;

const studio = createClient({
  chain: studionet,
  account: createAccount(fs.readFileSync("/tmp/gldeploy/key.txt", "utf8").trim()),
});

console.log("5 提交链上判定", judgeUrl);
const hash = await studio.writeContract({ address: JUDGE, functionName: "judge", args: [judgeUrl] });
const receipt = await studio.waitForTransactionReceipt({ hash, retries: 40, interval: 3000 });
console.log("6 判定交易", hash, "状态", receipt?.status);

const raw = await studio.readContract({ address: JUDGE, functionName: "get_result", args: [] });
const result = typeof raw === "string" ? JSON.parse(raw) : raw;
console.log("7 判定结果", JSON.stringify(result, null, 2));

console.log(result.verdict === "PASS" ? "8 PASS，放款给卖家" : "8 未通过，触发退款给买家");
