# Contributing

Open a pull request from a fork. A maintainer reviews every change before it merges into `main`.

## Adding or changing a skill

- Name every skill `harmony-<topic>`, in lowercase words joined by hyphens, such as `harmony-p2p-multiplayer`. The prefix keeps it from clashing with skills of the same name from elsewhere, since many agents keep installed skills in one folder. A skill that works in any web game still gets the prefix; its description says it isn't limited to Harmony.
- Put each skill in its own folder under `skills/`, named the same as the skill's `name`.
- Write the `description` for the agent that decides whether to load the skill: what it does, then "Use when..." with the words a developer would type. Keep it to 1,024 characters, and don't put a colon followed by a space inside an unquoted value, which breaks the YAML.
- Keep `SKILL.md` short. Move long material, such as a full API reference, into `references/` and link to it from `SKILL.md`.
- Use only the frontmatter fields from the [Agent Skills specification](https://agentskills.io/specification): `name`, `description`, `license`, `compatibility` and `metadata`. Fields that only one agent understands make the skill behave differently in the others. Skills here don't use the spec's `allowed-tools` either: tool permissions stay with the developer, and `check:skills` fails a skill that sets it.
- Write instructions any agent can follow. Describe the action ("read the file", "run this script"), not one agent's tool names or slash commands.
- Call the person the agent works for "the developer", not "the user". Use Harmony's own names for its parts: My Creations, the upload form, the overlay.
- When a skill needs answers before it builds, it asks in one round, only questions that change what gets built, each with a recommended answer. It finds what the project already shows (engine, bundler, build folder) instead of asking, and says what to do when the developer answers "you decide".
- End with a step that checks the work and says what to report to the developer.
- Write scripts in Python or Node, and list what they need.
- Add a Claude Code skill to a plugin in `.claude-plugin/marketplace.json`, so Claude users can install it.
- Harmony skills describe only what the Harmony developer pages say publicly. The SDK's calls, options and package name come from [sdk.md](https://playharmony.ai/developers/sdk.md).

## Optional generators

Creative skills (store media, audio, UI) work fully with no extra tools installed. They may also
offer tools a developer already has, such as an image, sound, voice or music generator, as long
as the default path stays complete on its own. Each such skill:

- Asks once, in its first round of questions: "Do you have any of these set up? (default: none)",
  listing what each kind of tool does with a few well-known examples. It never names a personal
  tool or skill, and never scans the developer's machine for tools.
- Never calls a paid service without the developer's yes.
- Never handles API keys: the tool reads its own config or environment.
- Checks that the tool's terms allow commercial use, and records each generated asset's source,
  tool and terms next to the asset licenses it already tracks.
- Falls back to the default path when a tool fails or isn't there.
- Treats generated files as a starting point: the developer checks them, and the skill's size and
  format rules still apply.
- Keeps this short in `SKILL.md` and puts tool tips in `references/generators.md`, so developers
  without tools never load them. Each skill carries its own copy of these rules, since skills are
  installed one by one.

## Before you open a pull request

Run these checks from the repository root:

```
npm run check:skills
npm run check:docs
npm test
claude plugin validate . --strict
```

`npm run check:skills` checks every skill's frontmatter (only the spec's fields, a `name` that matches its folder, a description of at most 1,024 characters, since agents and claude.ai refuse longer ones), its length, its links, and that the README and `marketplace.json` list it.

`npm run check:docs` reads sdk.md and fails when a skill calls an SDK function, imports a name, passes an `attachGameServices` option or installs a package that sdk.md doesn't document. It names the file and line. It reads https://playharmony.ai/developers/sdk.md by default; to check against a saved copy (or while that page isn't reachable), pass its path: `npm run check:docs -- path/to/sdk.md`.

`npm test` runs the tests for the peer-to-peer room module (`skills/harmony-p2p-multiplayer/scripts/`).

`claude plugin validate` checks the plugin manifest, if you use Claude Code. The Agent Skills project also publishes a reference validator (see [agentskills.io](https://agentskills.io/specification)); `npm run check:skills` covers the same frontmatter rules.

## Evals

`evals/` holds cases that check agents use the skills:

- **Trigger cases** (`trigger-*`): a request that doesn't name the skill should load it; one
  unrelated request must load none.
- **Behavior cases** (`behavior-*`): the agent works on `examples/orb-dash/`, a small canvas game,
  and graders check it followed the skill's key rules.

Each case is a real agent session, so running them costs usage. Run the trigger cases after
changing a skill's description, and the behavior cases after changing a skill's rules and before
a release:

```
npm run eval:triggers
npm run eval:behavior
```

The runner (`scripts/run_evals.mjs`) uses the `claude` CLI, signed in. Skills from your own setup
don't load, so they don't compete. Pass a name to run some cases
(`npm run eval:behavior -- settings`) and `--runs 3` to repeat them.

Evals run real agents on your machine, and a pull request can change the prompts, graders and
skills that steer them. The runner, not the case, decides what an agent may do:

- Agents run with `--restricted` and `--strict-mcp-config`: no shell, no web, no MCP servers and
  no settings files. They can only read and write inside their own temporary folder
  (`harmony-eval-*` in your system's temp folder, kept for reading failures; delete them when
  you're done) and read the skills.
- The agent loads a fresh copy of `skills/` only, so a pull request can't add hooks, MCP servers,
  agents or commands. A skill that declares `allowed-tools` or runs a command when it loads
  (`` !`...` ``) stops the run.
- A case may ask only for Read, Glob, Grep, Skill, Write and Edit. A case that also asks for Bash
  (`behavior-publish`, which makes a zip) is skipped unless you pass `--allow-shell`. Read that
  case and the skills it uses before you do: with a shell, the agent can run any command.
- The runner never runs a case's `fixture.sh`. It checks the file is the one generated from the
  example game and copies the example's files itself.
- The LLM judge gets no tools and an empty folder.

The runner itself, `package.json` and the other scripts are code you run. Review changes to them
like any code before running anything from a pull request.

`fixture.sh` is generated from the example game, for `claude plugin eval`; run
`npm run eval:fixtures` after changing `examples/orb-dash/`. Add a trigger case for every new
skill, and a behavior case for its most important rule.

## Keys and secrets

Never put API keys, tokens or passwords in a skill or a pull request. Skills read keys from environment variables or the developer's own config.

If you push a key by mistake, revoke or rotate it first, then tell us. Closing the pull request doesn't remove the key: the commit stays readable.
