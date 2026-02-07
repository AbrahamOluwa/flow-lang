import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";
import FlowHome from "./FlowHome.vue";
import "./custom.css";

export default {
    extends: DefaultTheme,
    enhanceApp({ app }) {
        app.component("FlowHome", FlowHome);
    },
} satisfies Theme;
