import helloCode from "../hello.flow?raw";
import discountCode from "../discount.flow?raw";
import typoCode from "../typo.flow?raw";
import emailCode from "../../examples/email-verification.flow?raw";
import orderCode from "../../examples/order-processing.flow?raw";

export interface Example {
    name: string;
    description: string;
    code: string;
    input: string;
}

export const EXAMPLES: Example[] = [
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
        name: "Email Verification",
        description: "Service calls and conditionals",
        code: emailCode,
        input: '{ "signup": { "email": "ada@example.com" } }',
    },
    {
        name: "Order Processing",
        description: "Loops, AI agents, retry logic",
        code: orderCode,
        input: '{ "order": { "id": "ORD-001", "items": ["widget", "gadget"], "subtotal": 150 } }',
    },
    {
        name: "Error Demo",
        description: "See how Flow reports errors with suggestions",
        code: typoCode,
        input: "{}",
    },
];
