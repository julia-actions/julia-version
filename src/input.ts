import YAML from "yaml"

const _NR = /(?:0|[1-9])[0-9]*/
const _NIGHTLY = new RegExp(`(?:${_NR.source}\\.${_NR.source}-)?nightly`)
const _NUMERIC_VERSION = new RegExp(
  `[\\^~]?${_NR.source}(?:\\.${_NR.source}(?:\\.${_NR.source})?)?`
)
const _ALIAS = /lts|min/
const VERSION_SPECIFIER_REGEX = new RegExp(
  `^(?:${_NUMERIC_VERSION.source}|${_NIGHTLY.source}|${_ALIAS.source})$`
)

export function parseVersionSpecifiers(raw: string): Array<string> {
  let specifiers: Array<string>

  // Use schema failsafe to avoid YAML parsing of numbers. For example YAML
  // will return `1.10` as `1.1`.
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
