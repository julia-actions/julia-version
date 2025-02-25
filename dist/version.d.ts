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
export declare function versionSort(versions: Array<string>): Array<string>;
export declare function resolveVersionSpecifiers(versionSpecifiers: Array<string>, project: string, options?: {
    ifMissing: string;
}): Promise<Array<string>>;
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
 * @param juliaCompatRange: The Node semver range to further restrict the results
 * @returns The full semver version number
 * @throws Error if the version specifier doesn't overlap with any available
 * Julia releases.
 */
export declare function resolveVersionSpecifier(versionRange: string, availableVersions: string[], juliaCompatRange?: string | null): string | null;
export declare function getNightlyUrl(nightly: NightlyPlatform, majorMinorVersion?: string | null): string;
/**
 * Generates a list of nightly downloads. Verifies the generated URLs exist
 * and avoids returning any entries which do not exist.
 *
 * @param majorMinorVersion: The partial nightly version number
 * @returns A list of downloads which exist.
 */
export declare function genNightlies(majorMinorVersion?: string | null): Promise<Array<Download>>;
export {};
