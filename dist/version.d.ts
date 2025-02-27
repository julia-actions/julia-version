import { IfMissing } from "./input.js";
export declare const VERSIONS_JSON_URL = "https://julialang-s3.julialang.org/bin/versions.json";
export declare const NIGHTLY_BASE_URL = "https://julialangnightlies-s3.julialang.org/bin";
type Download = {
    url: string;
    triplet?: string;
    kind: string;
    arch: string;
    asc?: string;
    sha256?: string;
    size: number;
    version: string;
    os: string;
    extension: string;
};
type JuliaVersionsJson = {
    [key: string]: {
        files: Array<Download>;
        stable: boolean;
    };
};
type NightlyPlatform = {
    platform: string;
    arch: string;
    suffix?: string;
    ext: string;
};
/**
 * Determine a specific Julia version for each version specifier.
 *
 * @param versionSpecifiers: A list of version specifiers. See the README for
 * details on the syntax.
 * @param project: The Julia project directory or file to use when determining
 * Julia compatibility with a project.
 * @param options: The `ifMissing` option controls the behavior of this
 * function when a version specifier cannot be resolved.
 * @returns A list of resolved versions
 * @throws Error if a version specifier doesn't resolve to any available
 * Julia release
 */
export declare function resolveVersions(versionSpecifiers: Array<string>, project?: string, options?: {
    ifMissing: IfMissing;
}): Promise<Array<string | null>>;
/**
 * Fetch and parse the Julia versions.json file.
 *
 * @returns The content of the downloaded versions.json file as object.
 */
export declare function fetchJuliaVersionsJson(): Promise<JuliaVersionsJson>;
/**
 * Determine the latest Julia release associated with the version range
 * (e.g. "1", "^1.2.3", "~1.2.3"). Additionally, supports the version aliases:
 *
 * - `lts`: The latest released long-term stable (LTS) version of Julia.
 * - `min`: The earliest version of Julia within the `juliaCompatRange`.
 *
 * @param versionRange: The node version range or alias.
 * @param availableVersions: An array of available Julia versions.
 * @param includePrereleases: Allow prereleases to be used when determining
 * the version number.
 * @param juliaCompatRange: The Node semver range to further restrict the results.
 * @param manifestJuliaVersion: The Julia version specified in the Julia manifest.
 * @returns The full semver version number
 * @throws Error if the version specifier doesn't overlap with any available
 * Julia releases.
 */
export declare function resolveVersion(versionRange: string, availableVersions: string[], juliaCompatRange?: string | null, manifestJuliaVersion?: string | null): string | null;
export declare function getNightlyUrl(nightly: NightlyPlatform, majorMinorVersion?: string | null): string;
/**
 * Generates a list of nightly downloads. Verifies the generated URLs exist
 * and avoids returning any entries which do not exist.
 *
 * @param majorMinorVersion: The partial nightly version number
 * @returns A list of downloads which exist.
 */
export declare function genNightlies(majorMinorVersion?: string | null): Promise<Array<Download>>;
/**
 * Sort a list of SemVer compatible version strings.
 *
 * @param versions: A list of version strings.
 * @returns The sorted list of versions.
 */
export declare function versionSort(versions: Array<string>): Array<string>;
/**
 * Create a unique list
 *
 * @param array: An array
 * @returns An array with unique elements in no particular order
 */
export declare function uniqueArray<T>(array: Array<T>): Array<T>;
export {};
