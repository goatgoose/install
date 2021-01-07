/**
 * Parse action input into a some proper thing.
 */

import { input } from "@actions-rs/core";

// Parsed action input
export interface Input {
    crate: string;
    version: string;
    useCache: boolean;
}

export function get(): Input {
    const crate = input.getInput("crate", { required: true });
    const version = input.getInput("version", { required: true });
    const useCache = input.getInputBool("use-cache") != false;

    return {
        crate: crate,
        version: version,
        useCache: useCache,
    };
}
