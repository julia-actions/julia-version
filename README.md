# Julia Version

[![GitHub Super-Linter](https://github.com/julia-action/julia-version/actions/workflows/linter.yaml/badge.svg)](https://github.com/super-linter/super-linter)
![CI](https://github.com/julia-action/julia-version/actions/workflows/ci.yaml/badge.svg)
[![Check Transpiled](https://github.com/julia-action/julia-version/actions/workflows/check-dist.yaml/badge.svg)](https://github.com/julia-action/julia-version/actions/workflows/check-dist.yaml)
[![CodeQL](https://github.com/julia-action/julia-version/actions/workflows/codeql-analysis.yaml/badge.svg)](https://github.com/julia-action/julia-version/actions/workflows/codeql-analysis.yaml)
[![Coverage](./badges/coverage.svg)](./badges/coverage.svg)

Resolves a list of version specifiers into concrete Julia versions. The output
from this action can be used as the input to a dependent GitHub Action job
matrix to test Julia projects against a unique set of version numbers to avoid
redundant matrix jobs. Additionally, by determining the concrete Julia versions
before running the matrix jobs we can include a more descriptive version in the
GitHub Action job name.

## Examples

```yaml
jobs:
  version:
    name: Resolve Julia Versions
    # These permissions are needed to:
    # - Checkout the Git repository (`contents: read`)
    permissions:
      contents: read
    runs-on: ubuntu-latest
    outputs:
      json: ${{ steps.julia-version.outputs.resolved-json }}
    steps:
      - uses: actions/checkout@v4 # Needed for "min" to access the Project.toml
      - uses: julia-actions/julia-version@v1
        id: julia-version
        with:
          versions: |
            - min  # Oldest supported version
            - lts  # Long-Term Stable
            - 1    # Latest release

  test:
    # e.g. `Julia 1.10.8 - ubuntu-latest`
    name: Julia ${{ matrix.version }} - ${{ matrix.os }}
    needs: version
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        version: ${{ fromJSON(needs.version.outputs.json) }}
        os:
          - ubuntu-latest
          - windows-latest
          - macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: julia-actions/setup-julia@v2
        with:
          version: ${{ matrix.version }}
      - name: Julia version info
        shell: julia --color=yes {0}
        run: |
          using InteractiveUtils
          versioninfo()
```

## Inputs

<!-- prettier-ignore-start -->
<!-- markdownlint-disable MD033 -->

| Name                 | Description | Required | Example |
|:---------------------|:------------|:---------|:--------|
| `versions`   | The Julia [version specifier](#version-specifier-syntax) or list of specifiers to resolve. Inputs formats supported include scalars, JSON lists, and YAML lists. When passing in a scalar prefer using a string instead of a numeric value to avoid unwanted YAML decimal conversions (e.g. `1.10` will be interpreted as `1.1`). | Yes | <pre><code class="language-yaml">"1.10"</code></pre> <pre><code class="language-json">["min", "lts", "1"]</code></pre> <pre><code class="language-yaml">- min&#10;- lts&#10;- 1&#10;</code></pre> |
| `project`            | The path to the Julia project directory or file to use when resolving some specifiers (e.g. `min`). Defaults to using the environmental variable `JULIA_PROJECT` if set or otherwise `.`. | No | `./PkgA.jl` |
| `if-missing`         | Determine the behavior if a version specifier cannot be resolved. | No | `warn`, `error` |

## Outputs

| Name               | Description | Example |
|:-------------------|:------------|:--------|
| `resolved-json`    | The unique JSON list of resolved Julia versions. Any versions which could not be resolved will be excluded from this list. | <pre><code class="language-json">["1.0.0", "1.10.8", "1.11.3"]</code></pre> |
| `resolved`         | A single resolved Julia version when the input `versions` contains is a single version specifier. Will be an empty string if version cannot be resolved. | `1.11.3` |

<!-- markdownlint-enable MD033 -->
<!-- prettier-ignore-end -->

## Permissions

No [job permissions] are required to run this action. However, since
`actions/checkout` is commonly used with this action to support the `min`
version alias the `contents: read` permission is commonly granted.

## Version Specifier Syntax

### Numeric Specifier

A numeric version syntatic sugar for the [tilde specifier](#tilde-specifiers)
(`1.2.3 == ~1.2.3`).

The default here differs from the Julia version specifier which
[use caret specifiers at the default](https://pkgdocs.julialang.org/v1/compatibility/#Version-specifier-format).
This difference was done on purpose as this allows the use of the list
`1.1, 1.2` being equivalent to `~1.1, ~1.2` instead of `^1 ^1`.

### Tilde Specifiers

Use the latest patch version when a minor version is specified. Allows minor
version updates if not. These rules can be stated as these heuristics:

- Minor and patch updates when the minor and patch versions are excluded (e.g.
  `~0`, `~1`).
- Patch updates when the minor is included (e.g. `~1.2.3`, `~1.2`)

| Specifier | Range             | Updates Allowed |
| :-------- | :---------------- | :-------------- |
| `~1.2.3`  | `[1.2.3, 1.3.0-)` | Patch           |
| `~1.2`    | `[1.2.0, 1.3.0-)` | Patch           |
| `~1`      | `[1.0.0, 2.0.0-)` | Minor / Patch   |
| `~0.2.3`  | `[0.2.3, 0.3.0-)` | Patch           |
| `~0.2`    | `[0.2.0, 0.3.0-)` | Patch           |
| `~0.0.3`  | `[0.0.3, 0.1.0-)` | Patch           |
| `~0.0`    | `[0.0.0, 0.1.0-)` | Patch           |
| `~0`      | `[0.0.0, 1.0.0-)` | Minor / Patch   |

### Caret Specifiers

Use the latest compatible non-breaking release. A non-breaking change follows
the backward compatible rules as specified by [Semantic Versioning 2.0.0]. These
rules can be stated as these heuristics:

- Minor and patch updates when the minor and patch versions is excluded (e.g.
  `^0`, `^1`) or the major version is non-zero (e.g. `^1`, `^1.2`, `^1.2.3`).
- Patch updates when the patch version is excluded (e.g. `^0.2`, `^1.2`) or the
  major version is zero and the minor version is non-zero (e.g. `^0.2`,
  `^0.2.3`).
- _No_ updates when the major and minor version is zero and the patch is
  included (e.g. `^0.0.0`, `^0.0.3`)

| Specifier | Range             | Updates Allowed |
| :-------- | :---------------- | :-------------- |
| `^1.2.3`  | `[1.2.3, 2.0.0-)` | Minor / Patch   |
| `^1.2`    | `[1.2.0, 2.0.0-)` | Minor / Patch   |
| `^1`      | `[1.0.0, 2.0.0-)` | Minor / Patch   |
| `^0.2.3`  | `[0.2.3, 0.3.0-)` | Patch           |
| `^0.2`    | `[0.2.0, 0.3.0-)` | Patch           |
| `^0.0.3`  | `[0.0.3, 0.0.4-)` | None            |
| `^0.0`    | `[0.0.0, 0.1.0-)` | Patch           |
| `^0`      | `[0.0.0, 1.0.0-)` | Minor / Patch   |

### Nightly Specifiers `nightly` `1.12-nightly`

The `nightly` alias refers to the latest Julia build created from the `master`
branch. A major and minor version maybe specified to refer to the latest build
based upon the `release-<major>.<minor>` branch.

When specifying a major and minor version typically only the latest three
revisions are available (e.g. if `^1 == 1.11` then `1.10`, `1.11`, and `1.12`).
The action will validate that a nightly with this specified version is available
and if not the version will resolve to `null`.

Note verifying the existence of a nightly revision which uses a major/minor
version requires the use of an HTTP HEAD request which takes a couple of
seconds. The `nightly` alias skips this check as that revision should always
exist.

### `lts` Alias

Resolves to the current long-term stable (LTS) version of Julia.

### `min` Alias

Resolves to the lowest Julia version compatible with the Julia project. Using
this alias requires that the `project` input refers to a directory containing a
`Project.toml` (or `JuliaProject.toml`) and a `julia` compat entry exist.

### `manifest` Alias

Resolves to the Julia version as specified in the Julia manifest file. Using
this alias requires that the `project` input refers to a directory containing a
`Manifest.toml` (or `JuliaManifest.toml`).

### Grammar

Here is the complete Backus-Naur grammar for a version specifier:

```bnf
<specifier> ::= <tilde> | <caret> | <partial> | <nightly> | <alias>
<tilde>     ::= "~" <partial>
<caret>     ::= "^" <partial>
<partial>   ::= <n> | <n> "." <n> | <n> "." <n> "." <n>
<nightly>   ::= <n> "." <n> "-nightly" | "nightly"
<alias>     ::= "lts" | "min" | "manifest"
<n>         ::= "0" | <positive> <digits>
<digits>    ::= <digit> | <digit> <digits>
<digit>     ::= "0" | <positive>
<positive>  ::= "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"
```

Note we are purposefully not supporting the SemVer prerelease syntax at this
time as we want to have prerelease support per-version specifier and have need
to work through some details.

[job permissions]:
  https://docs.github.com/en/actions/using-jobs/assigning-permissions-to-jobs
