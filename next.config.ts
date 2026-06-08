import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp", "onnxruntime-node"],
  transpilePackages: ["@huggingface/transformers"],
  turbopack: {
    resolveAlias: {
      "@huggingface/transformers":
        "./node_modules/@huggingface/transformers/dist/transformers.web.js",
      "@huggingface/transformers/dist/transformers.web.js":
        "./node_modules/@huggingface/transformers/dist/transformers.web.js",
    },
  },
};

export default nextConfig;
