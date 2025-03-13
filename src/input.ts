import YAML from "yaml"

export type IfMissing = "warn" | "error"

// Changes here should be reflected in the Backus-Naur grammar in the README
const _N = /(?:0|[1-9][0-9]*)/
const _NIGHTLY = new RegExp(`(?:${_N.source}\\.${_N.source}-)?nightly`)
const _VERSION_RANGE = new RegExp(
  `[\\^~]?${_N.source}(?:\\.${_N.source}(?:\\.${_N.source})?)?`
)
const _ALIAS = /(?:lts|min|manifest)/
const VERSION_SPECIFIER_REGEX = new RegExp(
  `^(?:${_VERSION_RANGE.source}|${_NIGHTLY.source}|${_ALIAS.source})$`
)

export function parseVersionSpecifiers(raw: string): Array<string> {
  let specifiers: Array<string>

  // Use schema failsafe to avoid YAML parsing of numbers. For example YAML
  // will return `1.10` as `1.1`. Users still need to pass in strings in the
  // workflow YAML.
  const yaml = YAML.parse(raw, { schema: "failsafe" })
  if (Array.isArray(yaml) && yaml.every((el) => typeof el === "string")) {
    specifiers = yaml
  } else if (typeof yaml === "string") {
    specifiers = [yaml]
  } else {
    throw new Error(`Unable to parse "version" input:\n${raw}`)
  }

  for (const specifier of specifiers) {
    if (!VERSION_SPECIFIER_REGEX.exec(specifier)) {
      throw new Error(`Invalid version specifier provided: "${specifier}"`)
    }
  }

  return specifiers
}

export function parseIfMissing(raw: string): IfMissing {
  if (raw === "warn" || raw === "error") {
    return raw
  } else {
    throw new Error(`Invalid if-missing value: ${raw}`)
  }
}
