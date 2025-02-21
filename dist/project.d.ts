export type JuliaProjectTOML = {
    compat: {
        julia: string | undefined;
    };
};
/**
 * Determine the path to a Julia project file from a directory or filename.
 *
 * @returns The path to the Julia project file.
 * @throws Error if the Julia project file doesn't exist.
 */
export declare function getJuliaProjectFile(juliaProject: string): string;
/**
 * Determine the NPM semver range string from a parsed Julia project TOML.
 *
 * @returns A NPM semver range string.
 * @throws Error if the Julia compat range cannot be converted into a NPM semver range.
 */
export declare function getJuliaCompatRange(juliaProject: JuliaProjectTOML): string;
/**
 * Convert a Julia compat range into a NPM semver range.
 *
 * @returns An NPM semver range string or null if the input is invalid.
 */
export declare function validJuliaCompatRange(compatRange: string): string | null;
