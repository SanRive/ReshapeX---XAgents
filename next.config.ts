import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El corpus y las tools de Python no entran al bundle.
  outputFileTracingExcludes: {
    "*": ["./corpus_txt/**", "./tools/**", "./PSS Tutorial/**"],
  },
};

export default nextConfig;
