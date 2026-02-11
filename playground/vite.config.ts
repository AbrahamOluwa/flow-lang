import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
    base: "/flow-lang/playground/",
    resolve: {
        alias: {
            "@flow": path.resolve(__dirname, "../src"),
        },
    },
    build: {
        outDir: "../docs/.vitepress/dist/playground",
        emptyOutDir: true,
    },
    define: {
        "process.env": "{}",
    },
    worker: {
        format: "es",
    },
});
