type RuntimeLoader = (specifier: string) => Promise<{ env: Cloudflare.Env }>;
const load = new Function("specifier", "return import(specifier)") as RuntimeLoader;
let cached: Cloudflare.Env | undefined;

export async function cloudflareEnv(): Promise<Cloudflare.Env> {
  return (cached ??= (await load("cloudflare:workers")).env);
}
