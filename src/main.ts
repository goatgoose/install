import * as io from "@actions/io";
import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as cache from "@actions/cache";
import { Cargo, resolveVersion } from "@actions-rs/core";
import * as path from "path";

import * as input from "./input";

interface Options {
    useCache: boolean;
    bins?: string[];
}

export async function run(
    crate: string,
    version: string,
    options: Options
): Promise<void> {
    core.info(`Installing ${crate} with cargo`);
    const cargo = await Cargo.get();
    const key = options.useCache ? await getRustKey() : "";
    const bins = options.bins;
    await installCached(cargo, crate, bins, version, key);
}

async function installCached(
    cargo: Cargo,
    crate: string,
    bins?: string[],
    version?: string,
    primaryKey?: string,
    restoreKeys?: string[]
): Promise<string> {
    if (version == "latest") {
        version = await resolveVersion(crate);
    }
    if (primaryKey) {
        restoreKeys = restoreKeys || [];
        const installDir = await io.which("cargo", true);
        const paths = (bins || [crate]).map((bin) =>
            path.join(path.dirname(installDir), bin)
        );
        const keyPrefix = `${crate}-${version}-${(bins || []).map((bin) => `${bin}-`)}`;
        const programKey = keyPrefix + primaryKey;
        const programRestoreKeys = restoreKeys.map(
            (key) => keyPrefix + key
        );
        const cacheKey = await cache.restoreCache(
            paths,
            programKey,
            programRestoreKeys
        );
        if (cacheKey) {
            core.info(`Using cached \`${crate}\` with version ${version}`);
            return crate;
        } else {
            const res = await install(cargo, crate, bins, version);
            try {
                core.info(`Caching \`${crate}\` with key ${programKey}`);
                await cache.saveCache(paths, programKey);
            } catch (error) {
                if (error.name === cache.ValidationError.name) {
                    throw error;
                } else if (error.name === cache.ReserveCacheError.name) {
                    core.info(error.message);
                } else {
                    core.info("[warning]" + error.message);
                }
            }
            return res;
        }
    } else {
        return await install(cargo, crate, bins, version);
    }
}

async function install(
    cargo: Cargo,
    crate: string,
    bins?: string[],
    version?: string
): Promise<string> {
    const args = ["install"];
    if (version && version != "latest") {
        args.push("--version");
        args.push(version);
    }
    if (bins) {
        bins.forEach((bin) => {
            args.push("--bin");
            args.push(bin);
        });
    }
    args.push(crate);

    try {
        core.startGroup(`Installing "${crate} = ${version || "latest"}"`);
        await cargo.call(args);
    } finally {
        core.endGroup();
    }

    return crate;
}

async function getRustKey(): Promise<string> {
    const rustc = await getRustVersion();
    return `${rustc.release}-${rustc.host}-${rustc["commit-hash"].slice(
        0,
        12
    )}`;
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
    args: Array<string> = []
): Promise<string> {
    let stdout = "";
    await exec.exec(cmd, args, {
        silent: true,
        listeners: {
            stdout(data) {
                stdout += data.toString();
            },
        },
    });
    return stdout;
}

async function main(): Promise<void> {
    try {
        const actionInput = input.get();

        await run(actionInput.crate, actionInput.version, {
            useCache: actionInput.useCache,
            bins: actionInput.bins,
        });
    } catch (error) {
        core.setFailed(error.message);
    }
}

main();
