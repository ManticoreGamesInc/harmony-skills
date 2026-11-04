import { readFileSync } from "node:fs";

export async function readSource(source, fetchSource = fetch) {
	let text;
	if (/^https?:\/\//.test(source)) {
		const response = await fetchSource(source);
		if (!response.ok) {
			throw new Error(source + " answered " + response.status);
		}
		text = await response.text();
	} else {
		text = readFileSync(source, "utf8");
	}
	if (/^\s*(?:<!doctype html|<html)\b/i.test(text)) {
		if (/<title>\s*Sign in[^<]*Cloudflare Access\s*<\/title>/i.test(text)) {
			throw new Error("Cloudflare Access returned its sign-in page instead of SDK Markdown. The documentation route must allow anonymous requests, or pass a local sdk.md copy.");
		}
		throw new Error("received HTML instead of SDK Markdown; check the documentation route or pass a local sdk.md copy");
	}
	return text;
}
