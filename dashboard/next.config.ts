import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  env: {
    SUPABASE_URL: process.env.SUPABASE_URL ?? "",
    SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY ?? "",
  },
};

export default config;
