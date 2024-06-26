import { Package, parse, readJson } from "./utils.ts";

export class Npm extends Package {
  static type = "npm";
  static regexp = [
    /npm:(\@[^/]+\/[^@/]+|[^@/]+)(?:\@[^/"'\s]+)?[^'"\s]*/,
  ];

  static parse(url: string): Npm {
    return parse(Npm, url);
  }

  async versions(): Promise<string[]> {
    return await npmVersions(this.name);
  }

  at(version = this.version, file = this.file): string {
    return `npm:${this.name}@${version}${file}`;
  }
}

export function npmVersions(name: string): Promise<string[]> {
  return readJson(`https://registry.npmjs.org/${name}`, (json) => {
    if (!json.versions) {
      throw new Error(`versions.json for ${name} has incorrect format`);
    }
    return Object.keys(json.versions);
  });
}
