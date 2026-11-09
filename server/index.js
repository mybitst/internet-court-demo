import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";

const PAY_TO = process.env.PAY_TO;
const PORT = process.env.PORT || 4021;

if (!PAY_TO) {
  console.error("缺少 PAY_TO，先运行 node scripts/new-wallet.js 生成收款地址");
  process.exit(1);
}

const app = express();

const facilitatorClient = new HTTPFacilitatorClient({ url: "https://x402.org/facilitator" });
const resourceServer = new x402ResourceServer(facilitatorClient).register(
  "eip155:84532",
  new ExactEvmScheme(),
);

app.use(
  paymentMiddleware(
    {
      "GET /api/report": {
        accepts: [
          {
            scheme: "exact",
            price: "$0.05",
            network: "eip155:84532",
            payTo: PAY_TO,
          },
        ],
        description: "ETH market report with sourced facts",
      },
    },
    resourceServer,
  ),
);

// 被打赏的那份报告。演示里故意只给两条来源，让 GenLayer 判定有没有达标。
app.get("/api/report", (req, res) => {
  const symbol = String(req.query.symbol || "ETH").toUpperCase();
  res.json({
    product: "ETH market report",
    symbol,
    generated_at: new Date().toISOString(),
    price_paid: "0.05 USDC",
    facts: [
      {
        key: "spot_price",
        value: "3120.44",
        source: "https://api.coinbase.com/v2/prices/ETH-USD/spot",
      },
      {
        key: "funding_rate",
        value: "0.0041%",
        source: "https://www.coinglass.com/FundingRate",
      },
    ],
    note: "delivery is judged by the GenLayer contract, not by the seller",
  });
});

app.get("/health", (req, res) => res.json({ ok: true, payTo: PAY_TO }));

app.listen(PORT, () => {
  console.log(`报告服务已启动 http://127.0.0.1:${PORT}/api/report`);
  console.log(`收款地址 ${PAY_TO}，网络 Base Sepolia，单价 0.05 USDC`);
});
