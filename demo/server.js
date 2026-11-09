import express from "express";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { wrapFetchWithPayment, decodeXPaymentResponse } from "x402-fetch";
import { privateKeyToAccount } from "viem/accounts";
import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

const envPath = path.join(os.homedir(), ".hermes/secrets/internet-court-demo.env");
for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}

const app = express();
const deployed = JSON.parse(fs.readFileSync(new URL("../.deployed.json", import.meta.url)));
const judgeAddress = process.env.JUDGE_ADDRESS || deployed.address;
const publicReportUrl = process.env.PUBLIC_REPORT_URL || "https://files.catbox.moe/677q7t.json";

const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY);
const fetchWithPayment = wrapFetchWithPayment(fetch, account);
const studio = createClient({
  chain: studionet,
  account: createAccount(fs.readFileSync("/tmp/gldeploy/key.txt", "utf8").trim()),
});

app.use(express.static(new URL(".", import.meta.url).pathname));

app.post("/run", async (req, res) => {
  const steps = [];
  const cheat = req.query.mode === "cheat";
  try {
    if (cheat) {
      const tampered = "https://files.catbox.moe/3t4lmd.json";
      const hash = await studio.writeContract({
        address: judgeAddress,
        functionName: "judge",
        args: [tampered],
      });
      const tx = await studio.waitForTransactionReceipt({ hash, retries: 40, interval: 3000 });
      const raw = await studio.readContract({ address: judgeAddress, functionName: "get_result", args: [] });
      const result = typeof raw === "string" ? JSON.parse(raw) : raw;
      steps.push({ key: "judge", hash, status: tx?.status, result, url: tampered });
      return res.json({ ok: true, steps, judgeAddress, mode: "cheat" });
    }

    const paidUrl = "http://127.0.0.1:4022/api/report?symbol=ETH";
    const r = await fetchWithPayment(paidUrl, { method: "GET" });
    const header = r.headers.get("x-payment-response");
    const receipt = header ? decodeXPaymentResponse(header) : null;
    const report = r.status === 200 ? await r.json() : null;
    steps.push({ key: "request", status: r.status, url: paidUrl });
    steps.push({ key: "payment", receipt });

    if (!report) throw new Error("付款未完成");

    const hash = await studio.writeContract({
      address: judgeAddress,
      functionName: "judge",
      args: [report.report_url || publicReportUrl],
    });
    const tx = await studio.waitForTransactionReceipt({ hash, retries: 40, interval: 3000 });
    const raw = await studio.readContract({ address: judgeAddress, functionName: "get_result", args: [] });
    const result = typeof raw === "string" ? JSON.parse(raw) : raw;
    steps.push({ key: "judge", hash, status: tx?.status, result });

    res.json({ ok: true, steps, judgeAddress });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e), steps });
  }
});

app.get("/health", (req, res) => res.json({ ok: true, judgeAddress }));

app.listen(4030, () => console.log("demo ui http://127.0.0.1:4030/"));
