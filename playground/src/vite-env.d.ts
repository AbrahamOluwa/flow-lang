/// <reference types="vite/client" />

declare module "*.flow?raw" {
    const content: string;
    export default content;
}
