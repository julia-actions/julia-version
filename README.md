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

## Version Specifier Syntax

### Numeric Specifiers `1.2.3` `1.2` `1`

A numeric version syntatic sugar for the [tilde specifier](#tilde-specifier)
(`1.2.3 == ~1.2.3`).

The default here differs from the Julia version specifier which
[use caret specifiers at the default](https://pkgdocs.julialang.org/v1/compatibility/#Version-specifier-format).
This difference was done on purpose as this allows the use of the list
`1.1, 1.2` being equivalent to `~1.1, ~1.2` instead of `^1 ^1`.

### Tilde Specifiers `~1.2.3` `~1.2` `~1`

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

### Caret Specifiers `^1.2.3` `^0.2.3` `~0.0.3`

Use the latest compatible non-breaking release. A non-breaking change follows
the backwards compatible rules as specified by [Semantic Versioning 2.0.0].
These rules can be stated as these heuristics:

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

Note: May cause slowdown due to using HTTP HEAD request.

### `lts` Alias

Resolves to the current long-term stable (LTS) version of Julia.

### `min` Alias

Resolves to the lowest Julia version compatible with the Julia project. Using
this alias requires that the `project` input refers to a directory containing a
`Project.toml` (or `JuliaProject.toml`) and a `julia` compat entry exist.

### Grammar

Here is the complete Backus-Naur grammar for a version specifier:

```bnf
specifier ::= tilde | caret | partial | nightly | alias
tilde     ::= '~' partial
caret     ::= '^' partial
partial   ::= nr ( '.' nr ( '.' nr ) ? ) ?
nightly   ::= ( nr '.' nr '-' ) ? 'nightly'
alias     ::= 'lts' | 'min'
nr        ::= '0' | ['1'-'9'] ( ['0'-'9'] ) *
```

Note we are purposefully not supporting the semver prerelease syntax at this
time as we want to have prerelease support per-version specifier and have need
to work through some details.

## Initial Setup

After you've cloned the repository to your local machine or codespace, you'll
need to perform some initial setup steps before you can develop your action.

> [!NOTE]
>
> You'll need to have a reasonably modern version of
> [Node.js](https://nodejs.org) installed. If you are using a version manager
> like [`nodenv`](https://github.com/nodenv/nodenv) or
> [`fnm`](https://github.com/Schniz/fnm), this package has a `.node-version`
> file at the root of the repository that can be used to automatically switch to
> the correct version when you `cd` into this repository.

1. Install the dependencies

   ```bash
   npm install
   ```

2. Package the TypeScript for distribution

   ```bash
   npm run bundle
   ```

3. Run the tests

   ```bash
   $ npm test

    PASS  __tests__/main.test.ts
     run
       ✓ Sets the version output (30 ms)
       ✓ Sets a failed status (8 ms)

   ...
   ```

## Update the Action Metadata

The [`action.yaml`](action.yaml) file defines metadata about your action, such
as input(s) and output(s). For details about this file, see
[Metadata syntax for GitHub Actions](https://docs.github.com/en/actions/creating-actions/metadata-syntax-for-github-actions).

When you copy this repository, update `action.yaml` with the name, description,
inputs, and outputs for your action.

## Update the Action Code

The [`src/`](./src/) directory is the heart of your action! This contains the
source code that will be run when your action is invoked. You can replace the
contents of this directory with your own code.

There are a few things to keep in mind when writing your action code:

- Most GitHub Actions toolkit and CI/CD operations are processed asynchronously.
  In `main.ts`, you will see that the action is run in an `async` function.

  ```javascript
  import * as core from "@actions/core"
  //...

  async function run() {
    try {
      //...
    } catch (error) {
      core.setFailed(error.message)
    }
  }
  ```

  For more information about the GitHub Actions toolkit, see the
  [documentation](https://github.com/actions/toolkit/blob/master/README.md).

So, what are you waiting for? Go ahead and start customizing your action!

1. Create a new branch

   ```bash
   git checkout -b releases/v1
   ```

1. Replace the contents of `src/` with your action code
1. Add tests to `__tests__/` for your source code
1. Format, test, and build the action

   ```bash
   npm run all
   ```

   > This step is important! It will run [`rollup`](https://rollupjs.org/) to
   > build the final JavaScript action code with all dependencies included. If
   > you do not run this step, your action will not work correctly when it is
   > used in a workflow.

1. (Optional) Test your action locally

   The [`@github/local-action`](https://github.com/github/local-action) utility
   can be used to test your action locally. It is a simple command-line tool
   that "stubs" (or simulates) the GitHub Actions Toolkit. This way, you can run
   your TypeScript action locally without having to commit and push your changes
   to a repository.

   The `local-action` utility can be run in the following ways:

   - Visual Studio Code Debugger

     Make sure to review and, if needed, update
     [`.vscode/launch.json`](./.vscode/launch.json)

   - Terminal/Command Prompt

     ```bash
     # npx local action <action-yaml-path> <entrypoint> <dotenv-file>
     npx local-action . src/main.ts .env
     ```

   You can provide a `.env` file to the `local-action` CLI to set environment
   variables used by the GitHub Actions Toolkit. For example, setting inputs and
   event payload data used by your action. For more information, see the example
   file, [`.env.example`](./.env.example), and the
   [GitHub Actions Documentation](https://docs.github.com/en/actions/learn-github-actions/variables#default-environment-variables).

1. Commit your changes

   ```bash
   git add .
   git commit -m "My first action is ready!"
   ```

1. Push them to your repository

   ```bash
   git push -u origin releases/v1
   ```

1. Create a pull request and get feedback on your action
1. Merge the pull request into the `main` branch

Your action is now published! :rocket:

For information about versioning your action, see
[Versioning](https://github.com/actions/toolkit/blob/master/docs/action-versioning.md)
in the GitHub Actions toolkit.

## Validate the Action

You can now validate the action by referencing it in a workflow file. For
example, [`ci.yaml`](./.github/workflows/ci.yaml) demonstrates how to reference
an action in the same repository.

```yaml
steps:
  - name: Checkout
    id: checkout
    uses: actions/checkout@v4

  - name: Test Local Action
    id: test-action
    uses: ./
    with:
      milliseconds: 1000

  - name: Print Output
    id: output
    run: echo "${{ steps.test-action.outputs.time }}"
```

For example workflow runs, check out the
[Actions tab](https://github.com/julia-action/julia-version/actions)! :rocket:

## Usage

After testing, you can create version tag(s) that developers can use to
reference different stable versions of your action. For more information, see
[Versioning](https://github.com/actions/toolkit/blob/master/docs/action-versioning.md)
in the GitHub Actions toolkit.

To include the action in a workflow in another repository, you can use the
`uses` syntax with the `@` symbol to reference a specific branch, tag, or commit
hash.

```yaml
steps:
  - name: Checkout
    id: checkout
    uses: actions/checkout@v4

  - name: Test Local Action
    id: test-action
    uses: julia-action/julia-version@v1 # Commit with the `v1` tag
    with:
      milliseconds: 1000

  - name: Print Output
    id: output
    run: echo "${{ steps.test-action.outputs.time }}"
```

## Publishing a New Release

This project includes a helper script, [`script/release`](./script/release)
designed to streamline the process of tagging and pushing new releases for
GitHub Actions.

GitHub Actions allows users to select a specific version of the action to use,
based on release tags. This script simplifies this process by performing the
following steps:

1. **Retrieving the latest release tag:** The script starts by fetching the most
   recent SemVer release tag of the current branch, by looking at the local data
   available in your repository.
1. **Prompting for a new release tag:** The user is then prompted to enter a new
   release tag. To assist with this, the script displays the tag retrieved in
   the previous step, and validates the format of the inputted tag (vX.X.X). The
   user is also reminded to update the version field in package.json.
1. **Tagging the new release:** The script then tags a new release and syncs the
   separate major tag (e.g. v1, v2) with the new release tag (e.g. v1.0.0,
   v2.1.2). When the user is creating a new major release, the script
   auto-detects this and creates a `releases/v#` branch for the previous major
   version.
1. **Pushing changes to remote:** Finally, the script pushes the necessary
   commits, tags and branches to the remote repository. From here, you will need
   to create a new release in GitHub so users can easily reference the new tags
   in their workflows.

## Dependency License Management

This template includes a GitHub Actions workflow,
[`licensed.yaml`](./.github/workflows/licensed.yaml), that uses
[Licensed](https://github.com/licensee/licensed) to check for dependencies with
missing or non-compliant licenses. This workflow is initially disabled. To
enable the workflow, follow the below steps.

1. Open [`licensed.yaml`](./.github/workflows/licensed.yaml)
1. Uncomment the following lines:

   ```yaml
   # pull_request:
   #   branches:
   #     - main
   # push:
   #   branches:
   #     - main
   ```

1. Save and commit the changes

Once complete, this workflow will run any time a pull request is created or
changes pushed directly to `main`. If the workflow detects any dependencies with
missing or non-compliant licenses, it will fail the workflow and provide details
on the issue(s) found.

### Updating Licenses

Whenever you install or update dependencies, you can use the Licensed CLI to
update the licenses database. To install Licensed, see the project's
[Readme](https://github.com/licensee/licensed?tab=readme-ov-file#installation).

To update the cached licenses, run the following command:

```bash
licensed cache
```

To check the status of cached licenses, run the following command:

```bash
licensed status
```
