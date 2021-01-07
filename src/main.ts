import * as core from "@actions/core";
import * as exec from "@actions/exec";
import { Cargo } from "@actions-rs/core";

import * as input from "./input";

interface Options {
    useCache: boolean;
}

export async function run(
    crate: string,
    version: string,
    options: Options
): Promise<void> {
    core.info(`Installing ${crate} with cargo`);
    const cargo = await Cargo.get();
    const key = options.useCache ? await getRustKey() : '';
    await cargo.installCached(crate, version, key);
}

async function getRustKey(): Promise<string> {
  const rustc = await getRustVersion();
  return `${rustc.release}-${rustc.host}-${rustc["commit-hash"].slice(0, 12)}`;
}

interface RustVersion {
  host: string;
  release: string;
  "commit-hash": string;
}

async function getRustVersion(): Promise<RustVersion> {
  const stdout = await getCmdOutput("rustc", ["-vV"]);
  let splits = stdout
    .split(/[\n\r]+/)
    .filter(Boolean)
    .map((s) => s.split(":").map((s) => s.trim()))
    .filter((s) => s.length === 2);
  return Object.fromEntries(splits);
}

export async function getCmdOutput(
  cmd: string,
  args: Array<string> = [],
  options: exec.ExecOptions = {},
): Promise<string> {
  let stdout = "";
  await exec.exec(cmd, args, {
    silent: true,
    listeners: {
      stdout(data) {
        stdout += data.toString();
      },
    },
    ...options,
  });
  return stdout;
}

async function main(): Promise<void> {
    try {
        const actionInput = input.get();

        await run(actionInput.crate, actionInput.version, {
            useCache: actionInput.useCache,
        });
    } catch (error) {
        core.setFailed(error.message);
    }
}

main();
