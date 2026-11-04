import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { readSource } from "./sdk_docs_source.mjs";

const source = "https://example.com/developers/sdk.md";
const answer = (body, status = 200) => async () => new Response(body, { status });

test("accepts Markdown returned as plain text", async () => {
	const markdown = "# SDK\n\n### `harmony.open(): void`\n";
	assert.equal(await readSource(source, answer(markdown)), markdown);
});

test("identifies the Access login page even when its final response is successful", async () => {
	await assert.rejects(readSource(source, answer('<!DOCTYPE html><html><head><title>Sign in ・ Cloudflare Access</title></head></html>')), /Cloudflare Access returned its sign-in page/);
});

test("identifies a successful SPA fallback", async () => {
	await assert.rejects(readSource(source, answer('<html><head><title>Harmony</title></head></html>')), /received HTML instead of SDK Markdown/);
});

test("preserves HTTP failure diagnostics", async () => {
	await assert.rejects(readSource(source, answer("missing", 404)), /answered 404/);
});

test("reads a local Markdown file", async () => {
	const text = await readSource(fileURLToPath(new URL("../README.md", import.meta.url)));
	assert.match(text, /^# Harmony skills/);
});
