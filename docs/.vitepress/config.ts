import { defineConfig } from "vitepress";

export default defineConfig({
    base: "/flow-lang/",
    vite: {
        resolve: {
            preserveSymlinks: true,
        },
    },
    title: "Flow",
    description: "A programming language for people who aren't programmers",
    head: [
        ["link", { rel: "icon", type: "image/svg+xml", href: "/logo.svg" }],
        ["meta", { name: "theme-color", content: "#6366f1" }],
        ["meta", { property: "og:type", content: "website" }],
        ["meta", { property: "og:title", content: "Flow — Workflow Orchestration Language" }],
        ["meta", { property: "og:description", content: "Write automated workflows in structured English. No semicolons, no brackets, no classes." }],
    ],
    themeConfig: {
        logo: "/logo.svg",
        nav: [
            { text: "Guide", link: "/guide/getting-started" },
            { text: "Reference", link: "/reference/language" },
            { text: "Examples", link: "/examples/" },
            { text: "Playground", link: "/flow-lang/playground/", target: "_self" },
            {
                text: "v0.2.0",
                items: [
                    { text: "Changelog", link: "https://github.com/AbrahamOluwa/flow-lang/releases" },
                    { text: "npm", link: "https://www.npmjs.com/package/flow-lang" },
                ],
            },
        ],
        sidebar: {
            "/guide/": [
                {
                    text: "Introduction",
                    items: [
                        { text: "What is Flow?", link: "/guide/what-is-flow" },
                        { text: "Getting Started", link: "/guide/getting-started" },
                    ],
                },
                {
                    text: "Core Concepts",
                    items: [
                        { text: "Services", link: "/guide/services" },
                        { text: "AI Integration", link: "/guide/ai-integration" },
                        { text: "Webhook Server", link: "/guide/webhook-server" },
                    ],
                },
            ],
            "/reference/": [
                {
                    text: "Reference",
                    items: [
                        { text: "Language", link: "/reference/language" },
                        { text: "Data Types", link: "/reference/data-types" },
                        { text: "CLI Commands", link: "/reference/cli" },
                    ],
                },
            ],
            "/examples/": [
                {
                    text: "Examples",
                    items: [
                        { text: "Overview", link: "/examples/" },
                        { text: "Email Verification", link: "/examples/email-verification" },
                        { text: "Order Processing", link: "/examples/order-processing" },
                        { text: "GitHub Scout", link: "/examples/github-scout" },
                        { text: "Stripe Checkout", link: "/examples/stripe-checkout" },
                        { text: "Slack Notification", link: "/examples/slack-notification" },
                        { text: "SendGrid Email", link: "/examples/sendgrid-email" },
                    ],
                },
            ],
        },
        socialLinks: [
            { icon: "github", link: "https://github.com/AbrahamOluwa/flow-lang" },
        ],
        footer: {
            message: "Released under the MIT License.",
            copyright: "Copyright 2026 Abraham Oluwa",
        },
        search: {
            provider: "local",
        },
    },
});
