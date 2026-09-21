# dogfood (Codex)

Explore a web application as a user and produce an incremental report with
reproduction steps, screenshots, and videos for interactive findings. Includes
an issue taxonomy and report template. No lifecycle hooks are installed.

## Installation

```bash
codex plugin marketplace add jacexh/skill-workshop
codex plugin add dogfood@skill-workshop-codex
```

Restart Codex after installation or upgrades.

## Browser dependency

Install [agent-browser](https://github.com/vercel-labs/agent-browser) separately
on the machine where the agent runs, including its browser runtime:

```bash
npm install -g agent-browser
agent-browser install
agent-browser --version
```

The plugin does not install the CLI or browser automatically. On Linux, consult
the upstream installation guide if browser system libraries are missing. Video
recording also requires `ffmpeg` on `PATH` in current agent-browser releases;
when unavailable, the report retains screenshots and states the limitation.

## Usage

Invoke explicitly, preserving the upstream invocation policy:

```text
$dogfood:dogfood http://localhost:3000 — focus on signup and settings
```

The target URL is required. Default output is `./dogfood-output/` with `report.md`,
`screenshots/`, and `videos/`; subsequent runs preserve existing evidence in a
fresh subdirectory. Optional inputs include scope, session name, output path,
and authentication access. Use disposable test data for mutating workflows.
Reusable login state is excluded from the report directory.

Findings have severity, expected/actual behavior, reproduction steps, and evidence.
Static issues need one screenshot; interactive issues use video and step screenshots
when recording works. Reports also state coverage, limitations, and unconfirmed
observations. There is no minimum issue quota.

## Provenance and license

Adapted from ZCode's dogfood skill at revision `872ad960de7ec172591f7e1952f7849229f94521`,
originally from Vercel's agent-browser. See [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)
for sources and local changes, and [LICENSE](LICENSE) for Apache-2.0 terms.
