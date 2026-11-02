# Self-hosting signaling and TURN

The free PeerJS server and public STUN are fine to start with. Host your own signaling server
when you need uptime and your own rate limits, and add TURN (`coturn`) when players on strict
networks must connect or when you offer "hide my IP". **Test a TURN relay between two
real networks before relying on it**, and treat the TURN part as a checklist, not a proven
recipe.

## Contents
- Where to run it
- Signaling server
- The ICE endpoint
- coturn
- Dev overrides

## Where to run it

| Host | Verdict |
|---|---|
| Free Render or Railway tiers | Sleep when idle and drop WebSockets. A host waiting for a friend loses its room. |
| Cloudflare Workers | Can't run `peerjs-server` as is; needs a rewrite on Durable Objects. |
| Fly.io | Fine for signaling, awkward for coturn's UDP relay range (49152 to 65535). |
| A small VPS (Docker + Caddy + coturn) | Simplest. Caddy handles TLS for the signaling server; coturn runs beside it. |

## Signaling server

- Run `peerjs-server` behind the proxy with `allow_discovery` off.
- An HTTPS game page can't open `ws://`. Serve signaling over `wss://` (Caddy gives you the
  certificate).
- Behind a proxy, rate limits must read the client IP from the forwarded header (and trust
  only your proxy to set it). Otherwise every client looks like the proxy and the first busy
  minute rate-limits everyone.
- An `Origin` allowlist stops other web pages from using your server. It doesn't stop scripts
  and other non-browser clients, which can send any `Origin`. Rate limits are what protect it.

## The ICE endpoint

Serve TURN credentials from your own small endpoint (`/ice`): short-lived username and
password (coturn's `use-auth-secret` with a TTL of an hour or so), never a long-lived secret in
the client. Rate-limit it.

On the client, `loadIce(url)` in the room module does the rest:

- 4 s timeout, and any failure (timeout, 429, bad JSON, empty list) falls back to public STUN.
- The response is untrusted: at most 8 servers, 8 URLs each, only `stun:`, `turn:` and
  `turns:` schemes, every string under 256 characters, only `urls`, `username` and
  `credential` kept.
- Cached for 10 minutes; keep that under the credentials' lifetime.

**Fail closed for "hide my IP".** The STUN fallback has no relay. A player who asked to hide
their IP must not quietly connect directly because `/ice` was down. With
`iceTransportPolicy: "relay"` and no TURN server in the config, the room module refuses to open
and raises `no-relay` ("Can't reach the relay server, so your IP can't be hidden right now.").
Without the hide option, falling back to STUN is right: most players connect fine without a
relay.

## coturn

- Deny relaying to every address that isn't the public internet, or the relay is a door into
  your server's network (SSRF). coturn takes ranges as `denied-peer-ip=FIRST-LAST`, one line
  each: `0.0.0.0-0.255.255.255`, `10.0.0.0-10.255.255.255`, `100.64.0.0-100.127.255.255`
  (carrier-grade NAT), `127.0.0.0-127.255.255.255`, `169.254.0.0-169.254.255.255`,
  `172.16.0.0-172.31.255.255`, `192.168.0.0-192.168.255.255`, `224.0.0.0-255.255.255.255`
  (multicast and reserved), `::1`, `fc00::-fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff`,
  `fe80::-febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff`, and the IPv4-mapped range
  `::ffff:0.0.0.0-::ffff:255.255.255.255`. Also deny the TURN server's own public address, and
  add `no-multicast-peers`. Check the coturn documentation for your version's exact syntax.
- Set quotas: `user-quota`, `total-quota`, `max-bps`. A relay is bandwidth you pay for.
- TLS 1.2 and up only (`no-tlsv1`, `no-tlsv1_1`).
- Open the UDP relay range in the firewall and keep it the same as `min-port` / `max-port`.
- Test the relay for real before promising it: two devices on different networks (a phone on
  mobile data and a PC on home Wi-Fi), both with `iceTransportPolicy: "relay"`, and check
  `chrome://webrtc-internals` shows a `relay` candidate pair.

## Dev overrides

A `?signal=host:port` URL parameter that points the game at another signaling server is handy
for local testing. Accept it only in dev builds. In a release build it lets anyone send a
link that routes a player's signaling (and so their IP and room code) through a server the
link's author controls.
