// p2p_room.d.ts: TypeScript declarations for p2p_room.js. Keep this file next to the module
// (same folder, same base name) and TypeScript picks it up for `import ... from "./p2p_room.js"`.
//
// Everything a peer sends is typed `unknown` (looks) or `string` (messages): clean it with the
// helpers below before using it. Methods starting with an underscore are internal, apart from
// the two test helpers declared at the end of P2PRoom.

/** The room code alphabet: 32 symbols, no look-alikes (0 O 1 I). */
export const ALPHABET: "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export const State: Readonly<{
	IDLE: "idle";
	OPENING: "opening";
	HOSTING: "hosting";
	JOINING: "joining";
	WAITING: "waitingApproval";
	CONNECTED: "connected";
}>;

/** One of the values of State. */
export type RoomState = (typeof State)[keyof typeof State];

/** Why a host turned a guest away. */
export type DenyReason = "full" | "version" | "kicked" | "denied";

/** Why a friend is gone. */
export type LeftReason = "left" | "closed" | "timeout" | "kicked";

/** The error types the module raises itself. PeerJS error types (such as "network") pass through too. */
export type RoomErrorType =
	| "peer-unavailable"
	| "bad-code"
	| "network"
	| "server-error"
	| "socket-error"
	| "browser-incompatible"
	| "no-library"
	| "connect-timeout"
	| "approval-timeout"
	| "no-relay"
	| "unknown";

/** An ICE server as RTCConfiguration takes it. */
export interface IceServer {
	urls: string | string[];
	username?: string;
	credential?: string;
}

/** An ICE server after cleanIce() or loadIce(): urls is always a list. */
export interface CleanIceServer extends IceServer {
	urls: string[];
}

/** The RTCConfiguration handed to PeerJS. Set iceTransportPolicy "relay" for "hide my IP". */
export interface IceConfig {
	iceServers?: IceServer[];
	iceTransportPolicy?: "all" | "relay";
	[option: string]: unknown;
}

/** Bad-network simulation for incoming fast-channel messages. loss is 0 to 1, times in seconds. */
export interface SimulateOptions {
	loss?: number;
	latency?: number;
	jitter?: number;
}

/** The PeerJS Peer class, or anything built like it (the tests pass MockPeer). */
export type PeerConstructor = new (...args: any[]) => any;

/** The game's own look: name, level, cosmetics. Sent to every peer as JSON, so no private data. */
export type RoomLook = Record<string, unknown>;

export interface RoomOptions {
	/** The PeerJS Peer class. Default: globalThis.Peer, then globalThis.peerjs.Peer. */
	Peer?: PeerConstructor | null;
	/** Prefix for peer IDs on the signaling server. Default "mygame-". */
	namespace?: string;
	/** Must match exactly between host and guest. Turned into a string. Default "1". */
	version?: string | number;
	/** Sent in hello and welcome. Default {}. */
	look?: RoomLook;
	/** Guests the host lets in. Default 1. */
	maxGuests?: number;
	/** Room code length. Default 12. */
	codeLength?: number;
	/** Default: public STUN only. */
	ice?: IceConfig;
	/** Extra PeerJS options (host, port, path, key, secure). config and debug are set by the room. */
	peerOptions?: Record<string, unknown>;
	/** Seconds between pings. Default 1. */
	heartbeat?: number;
	/** Seconds of silence before a friend is dropped. Default 10. */
	timeout?: number;
	/** Seconds a join may take to connect, and a stranger may take to say hello. Default 15. */
	connectTimeout?: number;
	/** Seconds a guest waits for the host's answer. Default 60. */
	approvalTimeout?: number;
	/** Connections allowed to wait for their hello at once. Default 4. */
	maxStrangers?: number;
	/** Longest message in characters; longer ones are dropped unread. Default 2048. */
	maxMessage?: number;
	/** Reliable messages per second per peer. Default 120. */
	maxRate?: number;
	/** Fast-channel messages per second per peer. Default 120. */
	maxFastRate?: number;
	/** Bytes queued on the fast channel before sendFast drops a message. Default 65536. */
	maxBuffered?: number;
	/** Testing only. Default null. */
	simulate?: SimulateOptions | null;
	/** Tries at a fresh code when the ID is taken. Default 4. */
	openTries?: number;
}

/** A friend in the room. look is UNTRUSTED: clean every field before using it. */
export interface RoomFriend {
	look: unknown;
	/** When the last message arrived, in seconds (performance.now() / 1000). */
	heard: number;
}

/** What each event hands its listener. Every look and text from a peer is UNTRUSTED. */
export interface RoomEvents {
	state: { state: RoomState; status: string };
	hosting: { code: string };
	request: { id: string; look: unknown };
	joined: { id: string; look: unknown };
	data: { id: string; text: string };
	left: { id: string; reason: LeftReason };
	denied: { reason: DenyReason; message: string };
	rekeyed: { code: string };
	dropped: { id: string };
	error: { type: RoomErrorType | (string & {}); message: string };
}

export type RoomEventName = keyof RoomEvents;

/** A room code from the cryptographic random source. Default length 12. */
export function newCode(length?: number): string;

/** What the player typed or pasted, as a bare code: upper case, A-Z and 0-9 only. */
export function cleanCode(typed: unknown): string;

/** XXXX-XXXX-XXXX for display. Default group size 4. */
export function groupCode(code: string, size?: number): string;

/** Letters and digits in any script, combining marks, space, dot, dash, underscore; at most max (default 16) code points, else fallback (default "Friend"). */
export function cleanName(name: unknown, max?: number, fallback?: string): string;

/** [A-Za-z0-9_], 1 to max (default 32) long, else "". */
export function cleanId(value: unknown, max?: number): string;

/** A finite number clamped to [min, max]; anything else is fallback (default min). */
export function clampNumber(value: unknown, min: number, max: number, fallback?: number): number;

/** One of the allowed values, else fallback (undefined when left out). */
export function cleanEnum<T>(value: unknown, allowed: readonly T[]): T | undefined;
export function cleanEnum<T, F>(value: unknown, allowed: readonly T[], fallback: F): T | F;

/** Split a tagged line like "S|a|b|c" when it has exactly `fields` fields, else null. */
export function splitLine(text: unknown, tag: string, fields: number): string[] | null;

/** FNV-1a hash of shared content tables, 8 hex digits, for the version string. Not for security. */
export function fingerprint(text: string): string;

/** ICE servers from an untrusted source: at most 8 servers of 8 stun:/turn:/turns: URLs. */
export function cleanIce(data: unknown): CleanIceServer[];

/** True when the config has at least one TURN server. */
export function hasRelay(ice: { iceServers?: IceServer[] } | null | undefined): boolean;

/** iceServers from your own endpoint, cleaned and cached; public STUN on any failure. Seconds for both times (defaults 4 and 600). */
export function loadIce(url: string, timeout?: number, cacheSeconds?: number): Promise<CleanIceServer[]>;

/** Split text into "K|key|part|of|chunk" lines; null when the key isn't [A-Za-z0-9_]{1,16} or it needs more than maxParts lines. Defaults 1500 and 64. */
export function chunkText(key: string, text: string, size?: number, maxParts?: number): string[] | null;

/** Puts chunkText lines back together, in any order. Keep one per peer. */
export class ChunkJoiner {
	constructor(size?: number, maxParts?: number);
	size: number;
	maxParts: number;
	/** The key being joined, "" when none. */
	key: string;
	parts: (string | null)[];
	left: number;
	/** { key, text } once every part of a key is in, else null. The text is UNTRUSTED. */
	add(line: unknown): { key: string; text: string } | null;
}

export class P2PRoom {
	constructor(options?: RoomOptions);

	/** True when a PeerJS class is available (passed or global) and the browser has WebRTC. */
	static supported(PeerClass?: PeerConstructor | null): boolean;

	// The options, settable after construction (for example room.ice before host() or join()).
	PeerClass: PeerConstructor | null;
	namespace: string;
	version: string;
	look: RoomLook;
	maxGuests: number;
	codeLength: number;
	ice: IceConfig;
	peerOptions: Record<string, unknown>;
	heartbeat: number;
	timeout: number;
	connectTimeout: number;
	approvalTimeout: number;
	maxStrangers: number;
	maxMessage: number;
	maxRate: number;
	maxFastRate: number;
	maxBuffered: number;
	simulate: SimulateOptions | null;
	openTries: number;

	// Read these; the room sets them.
	state: RoomState;
	/** The current room code, "" when there is none. */
	code: string;
	isHost: boolean;
	/** Host: the guest waiting for accept() or deny(). look is UNTRUSTED. */
	pending: { id: string; look: unknown } | null;
	friends: Map<string, RoomFriend>;
	/** IDs of everyone let in. */
	readonly friendIds: string[];
	/** Connected with at least one friend. */
	readonly together: boolean;

	on<K extends RoomEventName>(type: K, fn: (detail: RoomEvents[K]) => void): this;

	/** Open a room under a fresh code. Show the consent notice before the first call. */
	host(): void;
	/** Join the room behind a typed or pasted code. Show the consent notice before the first call. */
	join(typed: unknown): void;
	/** Host: let the pending guest in. */
	accept(): void;
	/** Host: turn the pending guest away. */
	deny(): void;
	/** Host: remove a guest (default: the first friend) and reopen under a new code. */
	kick(id?: string): void;
	/** Host: retire the current code now. Connected guests stay. */
	newCode(): void;
	/** Leave the room. quiet skips the change to the idle state. */
	leave(quiet?: boolean): void;
	/** Reliable, ordered. id null or left out: every friend. */
	send(text: string, id?: string | null): void;
	/** Lossy, unordered; falls back to reliable until the fast channel opens. */
	sendFast(text: string, id?: string | null): void;
	/** Host: send to every friend except one (relaying in rooms of 3 or more). */
	sendOthers(text: string, exceptId: string, fast?: boolean): void;
	/** JSON.stringify(message), then send(). */
	sendJson(message: unknown, id?: string | null): void;

	/** Test helper: pretend a friend is connected. */
	_debugSetFriend(id: string, look?: unknown): void;
	/** Test helper: feed a message in as if the friend sent it. */
	_debugReceive(id: string, text: unknown): void;
}
