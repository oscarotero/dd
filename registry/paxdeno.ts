import { RegistryUrl } from "./utils.ts";
import { githubVersions } from "./github.ts";

export class PaxDeno extends RegistryUrl {
  static regexp = [/https?:\/\/pax.deno.dev\/[^/"']*?\/[^/"']*?\@[^'"]*/];

  parse() {
    return super.parse(false);
  }

  async versions(): Promise<string[]> {
    return await githubVersions(this.name);
  }

  at(version: string): string {
    return `https://pax.deno.dev/${this.name}@${version}${this.file}`;
  }
}