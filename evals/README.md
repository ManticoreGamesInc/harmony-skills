# Evals

Cases that check agents use these skills, in the `claude plugin eval` format.

- `trigger-*`: a request that doesn't name a skill should load it (one case must load none).
- `behavior-*`: the agent works on the Orb Dash example game, and graders check the skill's key
  rules were followed.

Run them with the runner in this repo (needs the `claude` CLI, signed in):

```
npm run eval:triggers
npm run eval:behavior
```

The runner locks each agent down: no shell, no web, no MCP servers, and files only in its own
temporary folder. `behavior-publish` needs a shell to make its zip, so it's skipped unless you
pass `--allow-shell` after reading it. CONTRIBUTING.md has the details.

`claude plugin eval` can run the cases too, where it's available, but without the runner's
checks: it runs `fixture.sh` and gives agents the tools you name. Use it only on cases and skills
you have reviewed:

```
claude plugin eval . --tag trigger --ablation none --runs 1 --no-publish
claude plugin eval . --tag behavior --scaffold --allow-tools Write Edit --runs 1 --no-publish
```

Results from `claude plugin eval` go to `evals/results/`, which git ignores. Each case is a real
agent session, so running them costs usage. After changing `examples/orb-dash/`, run
`npm run eval:fixtures` to update the behavior cases' starting files.
