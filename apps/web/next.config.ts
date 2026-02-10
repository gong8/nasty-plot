import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname, "../.."),
  },
  transpilePackages: [
    "@nasty-plot/core",
    "@nasty-plot/db",
    "@nasty-plot/pokemon-data",
    "@nasty-plot/battle-engine",
    "@nasty-plot/analysis",
    "@nasty-plot/damage-calc",
    "@nasty-plot/smogon-data",
    "@nasty-plot/formats",
    "@nasty-plot/data-pipeline",
    "@nasty-plot/recommendations",
    "@nasty-plot/llm",
    "@nasty-plot/teams",
    "@nasty-plot/ui",
  ],
};

export default nextConfig;
