# Paid Report, Refund Switch

An x402 paid endpoint where the buyer does not have to trust the seller: a GenLayer
Intelligent Contract reads the delivered report and decides whether the seller gets paid
or the buyer gets refunded.

Built for the Internet Court Partner Demo Lab, using x402 as the payment rail and GenLayer
as the adjudication layer. The two are not decorative: the payment gate is real HTTP 402,
and the verdict is computed by validators on Studio, not by the client.

## The flow

```
buyer agent ──GET /api/report──────────────────────────────► seller
             ◄──402 Payment Required (0.05 USDC, Base Sepolia)──
             ──signed payment + retry────────────────────────►
             ◄──200 report (facts + sources)──────────────────
                          │
                          ▼
             GenLayer DeliveryJudge.judge(report_url)
                          │
        PASS ──► release payment      FAIL ──► refund buyer
```

The seller only gets the money if the contract finds the promised facts, with working
sources, and the numbers match what those sources actually say. A tampered number flips
the verdict to FAIL.

## What is real here

- x402 payment gate: `x402-express` middleware, `exact` scheme, `base-sepolia`, 0.05 USDC,
  facilitator `https://facilitator.payai.network` (the `x402.org` facilitator rejected the
  same valid authorization, see pitfalls).
- Delivery: the seller fetches spot price from Coinbase and the funding rate from OKX at
  delivery time, then publishes the JSON to a public URL. Nothing is pre-written.
- Adjudication: deployed GenLayer contract. The contract opens every source link the seller
  declares, pulls the raw response, and compares the numbers itself.
  - PASS: spot `2122.13 USD` against source `2122.125`, funding `0.0038%` against source
    `0.0000376`, both inside one percent.
  - FAIL on a cheat test: report claimed `9999.00 USD` while the source said `2119.87`.
- No mocked verdicts. The contract calls the model inside the non-deterministic block and
  validators check the structure of the answer.

## Deployed contract

| item | value |
|---|---|
| network | GenLayer Studio (chain id 61999) |
| contract | `0x037982AD8E4614278d38fc17165D7950283d3016` |
| deploy tx | `0x0fca6fc4f76bbdcb6678ba5c9d517b1fa0e81c5a9d64806b143c0b1a3653f568` |
| passing judgment | `0x0dabf0ffa51906b1533a3116132f042e793d862f13521422b5233c0592576a8d` (PASS) |
| cheat test | `0xfd23e21814181621d233e4e56c3b265c0e2c09a4ad7f66a8ee5681ae373b5882` (FAIL, claimed 9999 vs source 2119.87) |

Read them back with `get_result()` on the Studio client.

## Run it

```bash
npm install

# 1. create demo wallets (keys go to ~/.hermes/secrets, never to git)
node scripts/new-wallet.js

# 2. fund the agent address with Base Sepolia USDC
#    https://faucet.circle.com  (select Base Sepolia)

# 3. start the paid endpoint (fetches live data, publishes the report, charges 0.05 USDC)
set -a && . ~/.hermes/secrets/internet-court-demo.env && set +a
node server/v1.js

# 4. pay, receive, judge (the live report URL is used automatically)
node agent/flow.js
```

`PUBLIC_REPORT_URL` must be reachable from GenLayer validators, so `localhost` will not work.
Host the delivered JSON anywhere public, or run the server behind a tunnel.

## Judging rules

The requirement is written by the buyer at deploy time. The contract prompt enforces:

1. every promised field must appear with a value;
2. every value must carry a source link;
3. the contract opens each source itself and compares the number, a gap over one percent is FAIL;
4. unrelated content is FAIL;
5. unreadable or insufficient material is INSUFFICIENT;
6. the reason must quote the report or the source.

Validators accept only `PASS`, `FAIL`, `INSUFFICIENT` and a reason under 400 characters,
because two model runs never produce identical prose.

## Live run

| step | proof |
|---|---|
| payment settled | `0x1f2c2ddf011d430e613724842c90ec955bb0725be0f69ba752115f3dddb725fa` (Base Sepolia) |
| judgment | `0x0dabf0ffa51906b1533a3116132f042e793d862f13521422b5233c0592576a8d` (Studio, status 5, PASS) |
| cheat test | `0xfd23e21814181621d233e4e56c3b265c0e2c09a4ad7f66a8ee5681ae373b5882` (Studio, status 5, FAIL) |
| decision | release payment to the seller |

## Known limits

- The payment settles before the verdict exists, so the verdict does not move money back.
  A real refund needs an escrow: the buyer pays the escrow, delivery is judged, then the
  escrow releases or refunds. This repository shows the decision layer only.
- The contract checks the sources the seller declares. A seller who hosts their own page can
  make the numbers agree. Closing that needs a domain allowlist per requirement.
- The judge is a language model inside the non-deterministic block. The prompt tells it to
  ignore instructions inside the report, but prompt injection is reduced, not eliminated.

## Pitfalls found while building this

1. The `x402.org` facilitator returns `invalid_exact_evm_transaction_failed` for a valid
   authorization: the same `transferWithAuthorization` call simulates successfully on chain
   and the signature recovers to the payer. `facilitator.payai.network` settles the identical
   payload. Keep the facilitator URL configurable.
2. `genlayer-js@2.0.0-rc.2` returns status 7 on Studio for contracts that deploy fine with
   `1.2.0`. Pin the SDK version when deploying to Studio.
3. GenLayer testnet Bradbury currently does not process consensus transactions, so the
   judge lives on Studio.
4. Studio contract URLs render client side, so evidence is the address plus the transaction
   hash, not a screenshot.
5. Localhost delivery URLs cannot be fetched by validators. Publish the artifact first.
6. The payment receipt header is base64 JSON; decode it before showing a settlement receipt
   in a demo.
