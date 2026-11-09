import express from "express";
import { paymentMiddleware } from "x402-express";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const envPath = path.join(os.homedir(), ".hermes/secrets/internet-court-demo.env");
for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}

const PORT = Number(process.env.PORT || 4022);
const FACILITATOR = process.env.FACILITATOR_URL || "https://facilitator.payai.network";
const app = express();

const SPOT_SOURCE = "https://api.coinbase.com/v2/prices/ETH-USD/spot";
const FUNDING_SOURCE = "https://www.okx.com/api/v5/public/funding-rate?instId=ETH-USDT-SWAP";

async function fetchJson(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error(`${url} 返回 ${r.status}`);
  return r.json();
}

async function publish(text) {
  const form = new FormData();
  form.append("reqtype", "fileupload");
  form.append("fileToUpload", new Blob([text], { type: "application/json" }), "report.json");
  const r = await fetch("https://catbox.moe/user/api.php", { method: "POST", body: form });
  const url = (await r.text()).trim();
  if (!url.startsWith("http")) throw new Error("发布失败: " + url.slice(0, 120));
  return url;
}

app.use(
  paymentMiddleware(
    process.env.PAY_TO,
    {
      "GET /api/report": {
        price: "$0.05",
        network: "base-sepolia",
        config: { description: "ETH market report with sourced facts" },
      },
    },
    { url: FACILITATOR },
  ),
);

app.get("/api/report", async (req, res) => {
  const symbol = String(req.query.symbol || "ETH").toUpperCase();
  try {
    const [spot, funding] = await Promise.all([fetchJson(SPOT_SOURCE), fetchJson(FUNDING_SOURCE)]);
    const row = funding.data[0];
    const rate = Number(row.fundingRate);
    const report = {
      product: `${symbol} market report`,
      symbol,
      generated_at: new Date().toISOString(),
      price_paid: "0.05 USDC",
      facts: [
        { key: "spot_price", value: `${Number(spot.data.amount).toFixed(2)} USD`, source: SPOT_SOURCE },
        {
          key: "funding_rate",
          value: `${(rate * 100).toFixed(4)}% per 8h`,
          source: FUNDING_SOURCE,
          next_funding_time: new Date(Number(row.fundingTime)).toISOString(),
        },
      ],
      note: "figures fetched from the two source links at delivery time",
    };
    const reportUrl = await publish(JSON.stringify(report));
    console.log("交付", reportUrl, report.facts[0].value, report.facts[1].value);
    res.json({ ...report, report_url: reportUrl });
  } catch (e) {
    res.status(502).json({ error: "数据源不可用", detail: String(e.message || e) });
  }
});

app.get("/health", (req, res) => res.json({ ok: true, payTo: process.env.PAY_TO }));

app.listen(PORT, () => {
  console.log(`v1 报告服务 http://127.0.0.1:${PORT}/api/report 收款 ${process.env.PAY_TO}`);
});
