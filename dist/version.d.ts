export type Download = {
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
type JuliaVersionInfo = {
    [key: string]: {
        files: Array<Download>;
        stable: boolean;
    };
};
/**
 * Fetch and parse the Julia versions.json file.
 *
 * @returns The content of the downloaded versions.json file as object.
 */
export declare function getJuliaVersionInfo(): Promise<JuliaVersionInfo>;
/**
 * Determine the latest Julia release associated with the version specifier
 * (e.g. "1", "^1.2.3", "~1.2.3"). Additionally, supports the version aliases:
 *
 * - `lts`: The latest released long-term stable (LTS) version of Julia.
 * - `pre`: The latest prerelease (or release) of Julia.
 * - `min`: The earliest version of Julia within the `juliaCompatRange`.
 *
 * @param versionSpecifier: The version number specifier or alias.
 * @param availableVersions: An array of available Julia versions.
 * @param includePrereleases: Allow prereleases to be used when determining
 * the version number.
 * @param juliaCompatRange: The semver range to further restrict the results
 * @returns The full semver version number
 * @throws Error if the version specifier doesn't overlap with any available
 * Julia releases.
 */
export declare function resolveJuliaVersion(versionSpecifier: string, availableVersions: string[], includePrerelease?: boolean, juliaCompatRange?: string): string | null;
/**
 * Generates a list of nightly downloads. Verifies the generated URLs exist
 * and avoids returning any entries which do not exist.
 *
 * @param majorMinorVersion: The partial nightly version number
 * @returns A list of downloads which exist.
 */
export declare function genNightlies(majorMinorVersion?: string): Promise<Array<Download>>;
export {};
