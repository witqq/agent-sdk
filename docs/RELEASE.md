# Release runbook

The public `@witqq/agent-sdk` package lives in `packages/sdk`; the repository root, demo and documentation workspaces are private. A release binds one locally accepted SDK tarball to one annotated Git tag, one GitHub Release asset and one npm version. Publication verifies and transfers those exact bytes without checking out or rebuilding source.

## Runtime and trusted publisher

Use Node.js 24.20.0 and npm 12.0.2. `.nvmrc`, `.node-version`, root `engines`, workspace `engines`, `packageManager` and GitHub Actions define the same toolchain.

On npm, configure a GitHub Actions trusted publisher for `@witqq/agent-sdk`:

- organization or user: `witqq`;
- repository: `agent-sdk`;
- workflow filename: `publish-npm.yml`;
- allowed action: `npm publish`.

Do not add an `NPM_TOKEN` GitHub secret. The publication job uses a GitHub-hosted runner and `id-token: write` to authenticate through OpenID Connect (OIDC).

## Prepare one candidate

Set the new version in `packages/sdk/package.json` and the root `package-lock.json`, update `CHANGELOG.md`, then run from a clean feature branch:

```sh
npm ci --no-audit --no-fund
npm run verify
git status --short
```

The verification gate builds ESM, CommonJS, declaration and CSS outputs; runs typechecking and unit tests; validates both workflows; creates one SDK tarball; compares npm and tar inventories; scans every packaged file for private paths and credential-shaped data; validates all 22 exports and peer declarations; and installs the exact tarball with all declared peers in an isolated consumer. It loads every JavaScript export through ESM and CommonJS, resolves every declaration export with TypeScript and reads the installed CSS asset.

The accepted record is `test-results/package/candidate-evidence.json`. Extract its immutable identity:

```sh
candidate_record="$(pwd)/test-results/package/candidate-evidence.json"
candidate_path="$(node -e 'const r=require(process.argv[1]);process.stdout.write(r.tarball.path)' "$candidate_record")"
candidate_sha256="$(node -e 'const r=require(process.argv[1]);process.stdout.write(r.tarball.sha256)' "$candidate_record")"
candidate_dirty="$(node -e 'const r=require(process.argv[1]);process.stdout.write(String(r.sourceDirty))' "$candidate_record")"
version="$(node -p "require('./packages/sdk/package.json').version")"
tag="v${version}"
test -f "$candidate_path"
test "$(basename "$candidate_path")" = "witqq-agent-sdk-${version}.tgz"
test "${#candidate_sha256}" -eq 64
test "$candidate_dirty" = "false"
```

Do not change repository bytes after accepting the candidate. A merge commit may reuse it only when the merge tree is byte-identical to the reviewed head.

## Create the immutable release

After CI passes and the reviewed branch is merged into public `master`, create an annotated tag on that exact merge commit. The GitHub Release must be non-draft, non-prerelease and contain exactly the accepted tarball as its only asset. End the release notes with `[Made with Moira](https://moira-mcp.com/)`.

```sh
git tag -a "$tag" -m "agent-sdk ${version}"
git push origin "$tag"
gh release create "$tag" "$candidate_path" --title "Agent SDK ${version}" --notes-file ./release-notes.md
```

Tags and release assets are immutable. Never move a public tag or replace an asset.

## Publish and verify

Dispatch the workflow from `master`:

```sh
gh workflow run publish-npm.yml --ref master -f tag="$tag" -f sha256="$candidate_sha256"
gh run list --workflow publish-npm.yml --limit 1 --json databaseId,status,conclusion,headSha,url
gh run watch "<databaseId>" --exit-status
npm view @witqq/agent-sdk version dist-tags dist --json
```

The workflow requires an annotated tag contained in the dispatched revision and the one expected Release asset. It matches GitHub's stored digest, downloads the asset over verified HTTPS, recomputes SHA-256, checks package/version/repository/workspace identity and publishes that local verified tarball through OIDC. It performs no checkout, dependency installation or build. A retry accepts an existing npm version only when its registry tarball has the same digest, and every successful run verifies the final registry bytes.

The release is complete only when npm `latest` equals the released version, the registry tarball SHA-256 matches the GitHub asset and a new empty consumer can install and import the published ESM/CommonJS/types/CSS surface. Stop at the failed stage and repair its owner; never weaken identity, digest, TLS or authentication checks and never substitute a rebuilt tarball.
