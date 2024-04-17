import { RegistryUrl } from "./utils.ts";
import { npmVersions } from "./npm.ts";

export class EsmSh extends RegistryUrl {
  static regexp = [
    /https?:\/\/esm.sh\/[^/"']*?\@[^'"]*/,
    /https?:\/\/esm\.sh\/@[^/"']*?\/[^/"']*?\@[^'"]*/,
  ];

  async versions(): Promise<string[]> {
    return await npmVersions(this.name);
  }

  at(version = this.version, file = this.file): string {
    return `https://esm.sh/${this.name}@${version}${file}`;
  }
}
