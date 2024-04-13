import { Progress, SilentProgress } from "./progress.ts";
import { importUrls } from "./search.ts";
import { getLatestVersion, parse } from "./semver.ts";
import {
  lookup,
  type RegistryCtor,
  type RegistryUrl,
} from "./registry/utils.ts";
import { DenoLand } from "./registry/denoland.ts";
import { JsDelivr } from "./registry/jsdelivr.ts";
import { Npm } from "./registry/npm.ts";
import { GithubRaw } from "./registry/github.ts";
import { GitlabRaw } from "./registry/gitlab.ts";
import { Unpkg, UnpkgScope } from "./registry/unpkg.ts";
import { Skypack, SkypackScope } from "./registry/skypack.ts";
import { EsmSh, EsmShScope } from "./registry/esm.ts";
import { Pika, PikaScope } from "./registry/pika.ts";
import { NestLand } from "./registry/nestland.ts";
import { Jspm } from "./registry/jspm.ts";
import { Denopkg } from "./registry/denopkg.ts";
import { PaxDeno } from "./registry/paxdeno.ts";

const REGISTRIES = [
  DenoLand,
  UnpkgScope,
  Unpkg,
  Denopkg,
  PaxDeno,
  Jspm,
  PikaScope,
  Pika,
  SkypackScope,
  Skypack,
  EsmShScope,
  EsmSh,
  GithubRaw,
  GitlabRaw,
  JsDelivr,
  NestLand,
  Npm,
];

// FIXME we should catch ctrl-c etc. and write back the original deps.ts

export async function udd(
  filename: string,
  options: UddOptions,
): Promise<UddResult[]> {
  const u = new Udd(filename, options);
  return await u.run();
}

export interface UddOptions {
  // don't permanently edit files
  dryRun?: boolean;
  // don't print progress messages
  quiet?: boolean;
  // if this function errors then the update is reverted
  test?: () => Promise<void>;

  _registries?: RegistryCtor[];
}

export interface UddResult {
  initUrl: string;
  initVersion: string;
  message?: string;
  success?: boolean;
}

export class Udd {
  private filename: string;
  private test: () => Promise<void>;
  private options: UddOptions;
  private progress: Progress;
  private registries: RegistryCtor[];

  constructor(
    filename: string,
    options: UddOptions,
  ) {
    this.filename = filename;
    this.options = options;
    this.registries = options._registries || REGISTRIES;
    // deno-lint-ignore require-await
    this.test = options.test || (async () => undefined);
    this.progress = options.quiet ? new SilentProgress(1) : new Progress(1);
  }

  async content(): Promise<string> {
    const decoder = new TextDecoder();
    return decoder.decode(await Deno.readFile(this.filename));
  }

  async run(): Promise<UddResult[]> {
    const content: string = await this.content();

    const urls: string[] = importUrls(content, this.registries);
    this.progress.n = urls.length;

    // from a url we need to extract the current version
    const results: UddResult[] = [];
    for (const [i, u] of urls.entries()) {
      this.progress.step = i;
      const v = lookup(u, this.registries);
      if (v !== undefined) {
        results.push(await this.update(v!));
      }
    }

    return results;
  }

  async update(
    url: RegistryUrl,
  ): Promise<UddResult> {
    const initUrl: string = url.url;
    const initVersion: string = url.version;

    await this.progress.log(`Looking for releases: ${url.url}`);

    try {
      parse(url.version);
    } catch (_) {
      // The version string is a non-semver string like a branch name.
      await this.progress.log(`Skip updating: ${url.url}`);
      return { initUrl, initVersion };
    }

    const newVersion = getLatestVersion(await url.all());
    if (url.version === newVersion) {
      await this.progress.log(`Using latest: ${url.url}`);
      return { initUrl, initVersion };
    }

    let failed = false;
    if (!this.options.dryRun) {
      await this.progress.log(`Attempting update: ${url.url} -> ${newVersion}`);
      failed = await this.maybeReplace(url, newVersion, initUrl);
      const msg = failed ? "failed" : "successful";
      await this.progress.log(`Update ${msg}: ${url.url} -> ${newVersion}`);
    }

    return {
      initUrl,
      initVersion,
      message: newVersion,
      success: !failed,
    };
  }

  // Note: we pass initUrl because it may have been modified with fragments :(
  async maybeReplace(
    url: RegistryUrl,
    newVersion: string,
    initUrl: string,
  ): Promise<boolean> {
    const newUrl = url.at(newVersion).url;
    await this.replace(initUrl, newUrl);

    const failed = await this.test().then((_) => false).catch((_) => true);
    if (failed) {
      await this.replace(newUrl, initUrl);
    }
    return failed;
  }

  async replace(left: string, right: string) {
    const content = await this.content();
    const newContent = content.split(left).join(right);
    const encoder = new TextEncoder();
    await Deno.writeFile(this.filename, encoder.encode(newContent));
  }
}
