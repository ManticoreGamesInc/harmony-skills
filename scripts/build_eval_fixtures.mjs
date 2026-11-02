#!/usr/bin/env node
// build_eval_fixtures.mjs: rewrites each behavior case's fixture.sh from examples/orb-dash, so the
// cases always start from the current example game. Run after changing the example.
//
//   npm run eval:fixtures
//
// run_evals.mjs never runs fixture.sh: it checks the file matches fixtureScript() and copies the
// example's files itself. fixture.sh is there for `claude plugin eval`.

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));   // handles spaces and drive letters
export const EXAMPLE = join(ROOT, "examples", "orb-dash");
export const FILES = ["index.html", "src/game.js", "src/main.js"];
const MARKER = "Writes the Orb Dash example game";
const END = "ORB_DASH_EOF";

export function fixtureScript() {
	let script = "#!/usr/bin/env bash\n# " + MARKER + " (examples/orb-dash) into the empty eval folder.\n" +
		"# Regenerate with `npm run eval:fixtures` after changing the example.\nset -e\nmkdir -p src\n";
	for (const file of FILES) {
		const text = readFileSync(join(EXAMPLE, file), "utf8").replace(/\r\n/g, "\n");
		// A line equal to the end marker would end the heredoc early and run the rest as commands.
		if (text.split("\n").some((line) => line.trim() === END)) {
			throw new Error(file + " contains a line '" + END + "', which would break fixture.sh");
		}
		script += "cat > " + file + " <<'" + END + "'\n" + text + (text.endsWith("\n") ? "" : "\n") + END + "\n";
	}
	return script;
}

// Writes the files only when run directly, not when run_evals.mjs imports fixtureScript().
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
	const script = fixtureScript();
	let count = 0;
	for (const entry of readdirSync(join(ROOT, "evals"), { withFileTypes: true })) {
		const fixture = join(ROOT, "evals", entry.name, "fixture.sh");
		if (entry.isDirectory() && existsSync(fixture) && readFileSync(fixture, "utf8").includes(MARKER)) {
			writeFileSync(fixture, script);
			count++;
		}
	}
	console.log("Rewrote " + count + " fixtures from examples/orb-dash.");
}
