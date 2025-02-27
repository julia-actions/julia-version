import { parseVersionSpecifiers, parseIfMissing } from "../src/input.js"

describe("parseVersionSpecifiers", () => {
  it("Handle numeric scalars", () => {
    expect(parseVersionSpecifiers("1")).toEqual(["1"])
    expect(parseVersionSpecifiers("~1")).toEqual(["~1"])
    expect(parseVersionSpecifiers("^1")).toEqual(["^1"])
    expect(parseVersionSpecifiers("1.2")).toEqual(["1.2"])
    expect(parseVersionSpecifiers("~1.2")).toEqual(["~1.2"])
    expect(parseVersionSpecifiers("^1.2")).toEqual(["^1.2"])
    expect(parseVersionSpecifiers("1.2.3")).toEqual(["1.2.3"])
    expect(parseVersionSpecifiers("~1.2.3")).toEqual(["~1.2.3"])
    expect(parseVersionSpecifiers("^1.2.3")).toEqual(["^1.2.3"])

    expect(() => parseVersionSpecifiers("1.2.3.4")).toThrow(
      "Invalid version specifier"
    )

    expect(() => parseVersionSpecifiers("1.2.3-prerelease")).toThrow(
      "Invalid version specifier"
    )
    expect(() => parseVersionSpecifiers("~1.2.3-prerelease")).toThrow(
      "Invalid version specifier"
    )
    expect(() => parseVersionSpecifiers("^1.2.3-prerelease")).toThrow(
      "Invalid version specifier"
    )
  })

  it("Handle nightly scalar", () => {
    expect(parseVersionSpecifiers("nightly")).toEqual(["nightly"])
    expect(parseVersionSpecifiers("1.12-nightly")).toEqual(["1.12-nightly"])

    expect(() => parseVersionSpecifiers("1-nightly")).toThrow(
      "Invalid version specifier"
    )
    expect(() => parseVersionSpecifiers("1.12.0-nightly")).toThrow(
      "Invalid version specifier"
    )
  })

  it("Handle alias scalar", () => {
    expect(parseVersionSpecifiers("lts")).toEqual(["lts"])
    expect(parseVersionSpecifiers("min")).toEqual(["min"])
    expect(parseVersionSpecifiers("manifest")).toEqual(["manifest"])

    expect(() => parseVersionSpecifiers("pre")).toThrow(
      "Invalid version specifier"
    )
  })

  it("Handle JSON lists", () => {
    expect(parseVersionSpecifiers('["1","2","3"]')).toEqual(["1", "2", "3"])
  })

  it("Handle YAML lists", () => {
    expect(parseVersionSpecifiers('["1","2","3"]')).toEqual(["1", "2", "3"])
    expect(parseVersionSpecifiers("[1,2,3]")).toEqual(["1", "2", "3"])
    expect(parseVersionSpecifiers("- 1\n- 2\n- 3")).toEqual(["1", "2", "3"])
    expect(parseVersionSpecifiers('- "1"\n- "2"\n- "3"')).toEqual([
      "1",
      "2",
      "3",
    ])
  })

  it("Avoid YAML number parsing", async () => {
    expect(parseVersionSpecifiers("1.10")).toEqual(["1.10"])
    expect(parseVersionSpecifiers("1.0")).toEqual(["1.0"])
    expect(parseVersionSpecifiers("0.1")).toEqual(["0.1"])
  })

  it("Do not support arbitrary YAML", async () => {
    expect(() => parseVersionSpecifiers('- "1": {}')).toThrow("Unable to parse")
  })

  it("Ignores comments", () => {
    // String is also intended which is not required for the test
    const versions = `
      - min  # Oldest supported version
      - lts  # Long-Term Stable
      - 1    # Latest release`

    expect(parseVersionSpecifiers(versions)).toEqual(["min", "lts", "1"])
  })
})

describe("parseIfMissing", () => {
  it("Handle warn", () => {
    expect(parseIfMissing("warn")).toEqual("warn")
  })

  it("Handle error", () => {
    expect(parseIfMissing("error")).toEqual("error")
  })

  it("Handle empty", () => {
    expect(() => parseIfMissing("")).toThrow("Invalid if-missing")
  })
})
