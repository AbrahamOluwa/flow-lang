import helloCode from "../hello.flow?raw";
import discountCode from "../discount.flow?raw";
import githubCode from "../github-lookup.flow?raw";
import weatherCode from "../weather-alert.flow?raw";
import cryptoCode from "../crypto-portfolio.flow?raw";
import typoCode from "../typo.flow?raw";

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
        name: "GitHub User Lookup",
        description: "GitHub API, conditionals on response data",
        code: githubCode,
        input: '{ "username": "octocat" }',
    },
    {
        name: "Weather Alert",
        description: "Multi-service workflow with Slack notifications",
        code: weatherCode,
        input: '{ "city": "Lagos", "threshold": 35 }',
    },
    {
        name: "Crypto Portfolio",
        description: "Loops, running totals, CoinGecko API",
        code: cryptoCode,
        input: '{ "coins": [{ "name": "bitcoin", "amount": 0.5 }, { "name": "ethereum", "amount": 10 }, { "name": "solana", "amount": 100 }] }',
    },
    {
        name: "Error Demo",
        description: "See how Flow reports errors with suggestions",
        code: typoCode,
        input: "{}",
    },
];
