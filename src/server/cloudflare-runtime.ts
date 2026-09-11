import { env as workerEnv } from "cloudflare:workers";

export async function cloudflareEnv(): Promise<Cloudflare.Env> {
  return workerEnv;
}
