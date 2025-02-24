import YAML from "yaml"

export function parseVersionSpecifiers(raw: string): Array<string> {
  let specifiers: Array<string>

  // Use schema failsafe to avoid YAML parsing of numbers
  const yaml = YAML.parse(raw , { schema: "failsafe" })
  if (Array.isArray(yaml) && yaml.every((el) => typeof(el) === "string")) {
    specifiers = yaml
  } else if (typeof(yaml) === "string") {
    specifiers = [yaml]
  } else {
    throw new Error(`Unable to parse "version" input:\n${raw}`)
  }

  return specifiers
}
