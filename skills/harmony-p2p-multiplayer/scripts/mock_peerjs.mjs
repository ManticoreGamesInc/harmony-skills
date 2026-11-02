// In-process PeerJS stand-in for tests: no network, async delivery, and
// negotiated data channels that pair up by id (like the real lossy channel).
// Works with the plain Node runner (test_p2p_room.mjs) and with vitest or jest:
//
//   import { MockPeer, resetMockPeers } from "./mock_peerjs.mjs";
//   const room = new P2PRoom({ Peer: MockPeer, namespace: "test-", version: "1" });
//   afterEach(resetMockPeers);

const registry = new Map();
let auto = 0;

/** Forget every registered peer (call between tests). */
export function resetMockPeers() {
	registry.clear();
	auto = 0;
}

class Emitter {
	constructor() {
		this.handlers = {};
	}

	on(type, fn) {
		(this.handlers[type] ??= []).push(fn);
	}

	emit(type, ...args) {
		for (const fn of this.handlers[type] ?? []) {
			fn(...args);
		}
	}
}

export class MockConnection extends Emitter {
	constructor(peer, label) {
		super();
		this.peer = peer;
		this.label = label;
		this.open = false;
		this.closed = false;
		this.other = null;
		this.shared = null;
		this.peerConnection = null;
	}

	send(data) {
		if (!this.open) {
			return;
		}

		const other = this.other;

		setTimeout(() => other.open && other.emit("data", data), 1);
	}

	close() {
		if (!this.open && this.closed) {
			return;
		}

		this.closed = true;

		for (const side of this.shared?.channels ?? []) {
			for (const channel of Object.values(side)) {
				channel.close();
			}
		}

		const was = this.open;

		this.open = false;

		if (was) {
			this.emit("close");
		}

		if (this.other && !this.other.closed) {
			this.other.close();
		}
	}
}

// One RTCPeerConnection per connection pair; negotiated channels pair up by id.
class MockPeerConnection {
	constructor(shared, side) {
		this.shared = shared;
		this.side = side;
	}

	createDataChannel(label, options) {
		const shared = this.shared;
		const side = this.side;
		const channel = {
			label,
			ordered: options.ordered,
			maxRetransmits: options.maxRetransmits,
			readyState: "connecting",
			bufferedAmount: 0,
			send(data) {
				const other = shared.channels[1 - side][options.id];

				if (this.readyState === "open" && other) {
					setTimeout(() => other.readyState === "open" && other.onmessage?.({ data }), 1);
				}
			},
			close() {
				if (this.readyState === "closed") {
					return;
				}

				this.readyState = "closed";
				this.onclose?.();
			},
		};

		shared.channels[side][options.id] = channel;
		setTimeout(() => {
			if (channel.readyState === "connecting") {
				channel.readyState = "open";
				channel.onopen?.();
			}
		}, 1);
		return channel;
	}
}

export class MockPeer extends Emitter {
	constructor(id, options) {
		super();

		if (typeof id === "object" || id === undefined) {
			options = id;
			id = null;
		}

		this.id = id ?? "auto" + (++auto);
		this.options = options;
		this.destroyed = false;
		this.disconnected = false;
		this.connections = [];
		setTimeout(() => {
			if (registry.has(this.id)) {
				this.emit("error", { type: "unavailable-id" });
				return;
			}

			registry.set(this.id, this);
			this.emit("open", this.id);
		}, 2);
	}

	connect(target, options = {}) {
		const local = new MockConnection(target, options.label);

		setTimeout(() => {
			const host = registry.get(target);

			if (!host) {
				this.emit("error", { type: "peer-unavailable" });
				return;
			}

			// Like the real signaling server: an ID whose peer called disconnect() (and not
			// destroy()) never answers, so the join hangs until the joiner's own timeout.
			if (host.disconnected) {
				return;
			}

			const remote = new MockConnection(this.id, options.label);
			const shared = { channels: [{}, {}] };

			local.other = remote;
			remote.other = local;
			local.peerConnection = new MockPeerConnection(shared, 0);
			remote.peerConnection = new MockPeerConnection(shared, 1);
			local.shared = remote.shared = shared;
			this.connections.push(local);
			host.connections.push(remote);
			host.emit("connection", remote);
			setTimeout(() => {
				local.open = remote.open = true;
				remote.emit("open");
				local.emit("open");
			}, 2);
		}, 2);
		return local;
	}

	disconnect() {
		this.disconnected = true;
	}

	destroy() {
		this.destroyed = true;
		this.disconnected = true;

		if (registry.get(this.id) === this) {
			registry.delete(this.id);
		}

		for (const connection of this.connections) {
			connection.close();
		}
	}

	reconnect() {
	}
}
