import type { D1Database, R2Bucket } from "@cloudflare/workers-types";

declare global {
  namespace Cloudflare {
    interface Env {
      FILES: R2Bucket;
      CLOUDFLARE_ACCESS_ISSUER: string;
      CLOUDFLARE_ACCESS_AUD: string;
    }
  }
  interface CloudflareEnv {
    DB: D1Database;
    FILES: R2Bucket;
    CLOUDFLARE_ACCESS_ISSUER: string;
    CLOUDFLARE_ACCESS_AUD: string;
    BOOTSTRAP_ADMIN_EMAIL?: string;
    BOOTSTRAP_ORGANIZATION_NAME?: string;
  }
}

declare module "cloudflare:workers" {
  export const env: Cloudflare.Env;
}

export {};
