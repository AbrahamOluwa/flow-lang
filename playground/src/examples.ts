import fraudCode from "../transaction-fraud.flow?raw";
import reconciliationCode from "../payment-reconciliation.flow?raw";
import chargebackCode from "../chargeback-dispute.flow?raw";
import helloCode from "../hello.flow?raw";
import discountCode from "../discount.flow?raw";
import healthCode from "../health-check.flow?raw";
import githubCode from "../github-lookup.flow?raw";
import weatherCode from "../weather-alert.flow?raw";
import cryptoCode from "../crypto-portfolio.flow?raw";
import typoCode from "../typo.flow?raw";
import inventoryCode from "../inventory-lookup.flow?raw";
import customerDbCode from "../customer-db.flow?raw";
import dailySalesCode from "../daily-sales-report.flow?raw";
import slaMonitorCode from "../sla-monitor.flow?raw";

export interface Example {
    name: string;
    description: string;
    code: string;
    input: string;
}

export const EXAMPLES: Example[] = [
    {
        name: "Transaction Fraud Detection",
        description: "AI risk scoring, rule-based screening, human escalation",
        code: fraudCode,
        input: '{ "transaction": { "id": "txn-8291", "amount": 8500, "merchant": "ElectroMart", "card_present": false, "customer_id": "cust-4420" } }',
    },
    {
        name: "Payment Reconciliation",
        description: "Batch reconciliation with loop totals and AI discrepancy analysis",
        code: reconciliationCode,
        input: '{ "reconciliation": { "batch_id": "BATCH-001", "date": "2024-03-01", "ledger_total": 5700, "ledger_count": 2, "settlements": [{ "id": "SET-001", "amount": 2500, "status": "cleared" }, { "id": "SET-002", "amount": 3200, "status": "cleared" }] } }',
    },
    {
        name: "Chargeback Dispute Handler",
        description: "Evidence gathering, AI recommendation, and dispute submission",
        code: chargebackCode,
        input: '{ "chargeback": { "dispute_id": "DSP-4892", "transaction_id": "TXN-7210", "amount": 249.99, "reason_code": "product_not_received", "customer_id": "CUST-1138", "filed_date": "2024-02-28" } }',
    },
    {
        name: "GitHub User Lookup",
        description: "GitHub API, conditionals on response data",
        code: githubCode,
        input: '{ "username": "octocat", "repos": 42, "followers": 12500 }',
    },
    {
        name: "Hello World",
        description: "Simple greeting with string interpolation",
        code: helloCode,
        input: '{ "name": "World" }',
    },
    {
        name: "Discount Calculator",
        description: "Conditionals, math, and named steps",
        code: discountCode,
        input: '{ "total": 100, "tier": "gold" }',
    },
    {
        name: "Health Check",
        description: "No input needed — fetches from APIs and processes responses",
        code: healthCode,
        input: "{}",
    },
    {
        name: "Weather Alert",
        description: "Multi-service workflow with Slack notifications",
        code: weatherCode,
        input: '{ "city": "Lagos", "temp": 38, "condition": "clear", "threshold": 35 }',
    },
    {
        name: "Crypto Portfolio",
        description: "Loops, running totals, CoinGecko API",
        code: cryptoCode,
        input: '{ "coins": [{ "name": "bitcoin", "amount": 0.5, "price": 97000 }, { "name": "ethereum", "amount": 10, "price": 3200 }, { "name": "solana", "amount": 100, "price": 145 }] }',
    },
    {
        name: "Inventory Lookup",
        description: "Database queries, stock checks, empty handling",
        code: inventoryCode,
        input: '{ "request": { "product-id": 1 } }',
    },
    {
        name: "Customer Database (PostgreSQL)",
        description: "Database lookup, order history, loyalty tier classification",
        code: customerDbCode,
        input: '{ "customer_email": "ada@example.com", "total_spent": 7500 }',
    },
    {
        name: "Daily Sales Report",
        description: "Scheduled report with revenue metrics and Slack notification",
        code: dailySalesCode,
        input: '{ "total_revenue": 34500, "order_count": 47, "highest_sale": 2800 }',
    },
    {
        name: "SLA Monitor",
        description: "Scheduled health checks with PagerDuty alerting",
        code: slaMonitorCode,
        input: "{}",
    },
    {
        name: "Error Demo",
        description: "See how Flow reports errors with suggestions",
        code: typoCode,
        input: "{}",
    },
];
