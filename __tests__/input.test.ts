import { parseVersionSpecifiers } from "../src/input.js"

describe("parseVersionSpecifiers", () => {
  it("Handle scalars", () => {
    expect(parseVersionSpecifiers("1")).toEqual(["1"])
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
      "3"
    ])
  })

  it("Avoid YAML number parsing", async () => {
    expect(parseVersionSpecifiers("1.10")).toEqual(["1.10"])
    expect(parseVersionSpecifiers("01.1")).toEqual(["01.1"])
  })

  it("Do not support arbitrary YAML", async () => {
    expect(() => parseVersionSpecifiers('- "1": {}')).toThrow("Unable to parse")
  })
})
