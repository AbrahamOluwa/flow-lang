import fraudCode from "../transaction-fraud.flow?raw";
import reconciliationCode from "../payment-reconciliation.flow?raw";
import chargebackCode from "../chargeback-dispute.flow?raw";
import discountCode from "../discount.flow?raw";
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
        name: "Discount Calculator",
        description: "Tier-based pricing rules with conditional discounts",
        code: discountCode,
        input: '{ "total": 100, "tier": "gold" }',
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
