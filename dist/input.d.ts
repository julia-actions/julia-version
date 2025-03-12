export type IfMissing = "warn" | "error";
export declare function parseVersionSpecifiers(raw: string): Array<string>;
export declare function parseIfMissing(raw: string): IfMissing;
