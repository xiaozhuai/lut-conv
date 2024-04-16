import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/lut-conv.ts"],
    format: ["cjs", "esm", "iife"],
    minify: true,
    dts: true,
    sourcemap: true,
    splitting: false,
    clean: true,
    globalName: "LutConv"
});
