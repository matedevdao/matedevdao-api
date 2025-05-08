import { ImageCombiner } from "@commonmodule/image-combiner-cf";
import { OpenSeaMetadataConverter } from "nft-data";
import { verifyMessage } from "viem";
import { createSiweMessage } from "viem/siwe";
import BabyPingImageGenerator from "./babyping/BabyPingImageGenerator.js";
import font from "./fonts/neodgm.woff2";
import HolderListFetcher from "./HolderListFetcher.js";
import KCDKongImageGenerator from "./kingcrowndao-kongz/KCDKongImageGenerator.js";
import NFTDataManager from "./NFTDataManager.js";
import SigorSparrowImageGenerator from "./sigor-sparrows/SigorSparrowImageGenerator.js";
import TransferEventSyncer from "./TransferEventSyncer.js";

function base64url(input: ArrayBuffer | Uint8Array): string {
	const bytes = input instanceof ArrayBuffer ? new Uint8Array(input) : input;
	return btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

async function signJwt(
	payload: Record<string, unknown>,
	secret: string,
): Promise<string> {
	const enc = new TextEncoder();
	const header = { alg: "HS256", typ: "JWT" };
	const headerB64 = base64url(enc.encode(JSON.stringify(header)));
	const payloadB64 = base64url(enc.encode(JSON.stringify(payload)));

	const key = await crypto.subtle.importKey(
		"raw",
		enc.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);

	const sigBuf = await crypto.subtle.sign(
		"HMAC",
		key,
		enc.encode(`${headerB64}.${payloadB64}`),
	);

	const sigB64 = base64url(sigBuf);
	return `${headerB64}.${payloadB64}.${sigB64}`;
}

async function verify<
	T extends Record<string, unknown> = Record<string, unknown>,
>(token: string, secret: string): Promise<T | undefined> {
	const enc = new TextEncoder();

	const [headerB64, payloadB64, sigB64] = token.split(".");
	if (!headerB64 || !payloadB64 || !sigB64) return;

	const headerJson = new TextDecoder().decode(base64urlDecode(headerB64));
	let header: { alg?: string; typ?: string };
	try {
		header = JSON.parse(headerJson);
	} catch {
		return;
	}
	if (header.alg !== "HS256" || header.typ !== "JWT") return;

	const key = await crypto.subtle.importKey(
		"raw",
		enc.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);

	const signingInput = `${headerB64}.${payloadB64}`;
	const expectedSigBuf = await crypto.subtle.sign(
		"HMAC",
		key,
		enc.encode(signingInput),
	);
	const expectedSigB64 = base64url(expectedSigBuf);

	if (!timingSafeEqual(sigB64, expectedSigB64)) return;

	try {
		const payloadJson = new TextDecoder().decode(base64urlDecode(payloadB64));
		return JSON.parse(payloadJson) as T;
	} catch {
		return;
	}
}

function base64urlDecode(b64url: string): Uint8Array {
	const pad = (4 - (b64url.length % 4)) % 4;
	const b64 = (b64url + "=".repeat(pad)).replace(/-/g, "+").replace(/_/g, "/");
	const binary = atob(b64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

function timingSafeEqual(aB64: string, bB64: string): boolean {
	if (aB64.length !== bB64.length) return false;
	let diff = 0;
	for (let i = 0; i < aB64.length; i++) {
		diff |= aB64.charCodeAt(i) ^ bB64.charCodeAt(i);
	}
	return diff === 0;
}

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers":
		"authorization, x-client-info, apikey, content-type",
	"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

export default {
	async fetch(request, env, ctx): Promise<Response> {
		if (request.method === "OPTIONS") {
			return new Response(null, { status: 204, headers: corsHeaders });
		}

		const url = new URL(request.url);

		if (url.pathname === "/test") {
			const bgUrl = new URL(
				"/sigor-sparrows/parts-images/normal/1.BG/IJM beige.png",
				request.url,
			);

			const [respBg] = await Promise.all([
				env.ASSETS.fetch(bgUrl),
			]);
			if (!respBg.ok) {
				throw new Error("Failed to fetch images from ASSETS");
			}

			const [buffBg] = await Promise.all([
				respBg.arrayBuffer(),
			]);

			const fontBytes = new Uint8Array(font);

			const png = ImageCombiner.combine(1000, 1000, [buffBg], {
				fontBytes,
				x: 500,
				y: 500,
				text: "안녕하세요, Workers 👋",
				fontSize: 64,
				color: "#000000",
			});

			return new Response(png, {
				status: 200,
				headers: { "Content-Type": "image/png" },
			});
		}

		if (url.pathname.startsWith("/metadata/")) {
			const collection = url.pathname.split("/")[2];
			const tokenIdStr = url.pathname.split("/")[3];
			if (!collection || !tokenIdStr) {
				return new Response("Invalid request", { status: 400 });
			}

			const tokenId = parseInt(tokenIdStr);
			if (isNaN(tokenId) || tokenId < 0) {
				return new Response("Invalid token ID", { status: 400 });
			}

			const data = await NFTDataManager.fetchBulkData(
				env.DB,
				[{ collection, tokenId }],
			);
			const d = data[`${collection}:${tokenId}`];
			if (!d) return new Response("Data not found", { status: 404 });

			return new Response(
				JSON.stringify(OpenSeaMetadataConverter.convertToOpenSeaMetadata(d)),
				{ headers: { "Content-Type": "application/json" } },
			);
		}

		if (url.pathname.startsWith("/nft/")) {
			const collection = url.pathname.split("/")[2];
			const tokenIdStr = url.pathname.split("/")[3];
			if (!collection || !tokenIdStr) {
				return new Response("Invalid request", { status: 400 });
			}

			const tokenId = parseInt(tokenIdStr);
			if (isNaN(tokenId) || tokenId < 0) {
				return new Response("Invalid token ID", { status: 400 });
			}

			const data = await NFTDataManager.fetchBulkData(
				env.DB,
				[{ collection, tokenId }],
			);
			const d = data[`${collection}:${tokenId}`];
			if (!d) return new Response("Data not found", { status: 404 });

			return new Response(JSON.stringify(d), {
				headers: { "Content-Type": "application/json", ...corsHeaders },
			});
		}

		if (url.pathname.endsWith("/nfts")) {
			const walletAddress = url.pathname.split("/")[1];
			if (!walletAddress) {
				return new Response("Invalid request", { status: 400 });
			}

			const metadataMap = await NFTDataManager.fetchHoldingNFTData(
				env.DB,
				walletAddress,
			);

			const metadatas = Object.values(metadataMap);

			return new Response(JSON.stringify(metadatas), {
				headers: { "Content-Type": "application/json", ...corsHeaders },
			});
		}

		if (url.pathname === "/save-metadata") {
			try {
				const authorization = request.headers.get("Authorization");
				if (!authorization) {
					return new Response("Unauthorized", {
						status: 401,
						headers: corsHeaders,
					});
				}
				if (!authorization.startsWith("Bearer ")) {
					return new Response("Invalid authorization header", {
						status: 401,
						headers: corsHeaders,
					});
				}
				const token = authorization.split(" ")[1];

				const decoded = await verify(token, env.JWT_SECRET) as
					| { wallet_address?: `0x${string}` }
					| undefined;
				if (!decoded?.wallet_address) {
					return new Response("Invalid token", {
						status: 401,
						headers: corsHeaders,
					});
				}

				const { collection, id, traits, parts } = await request.json<{
					collection?: string;
					id?: number;
					traits?: { [traitName: string]: string | number };
					parts?: { [partName: string]: string | number };
				}>();

				console.log(collection, id, traits, parts);

				if (!collection || id === undefined || !parts) {
					return new Response("Invalid request", {
						status: 400,
						headers: corsHeaders,
					});
				}

				let imageGenerator;
				if (collection === "sigor-sparrows") {
					imageGenerator = SigorSparrowImageGenerator;
				} else if (collection === "kingcrowndao-kongz") {
					imageGenerator = KCDKongImageGenerator;
				} else if (collection === "babyping") {
					imageGenerator = BabyPingImageGenerator;
				} else {
					return new Response("Invalid collection", {
						status: 400,
						headers: corsHeaders,
					});
				}

				const image = await imageGenerator.generate(env, request.url, {
					traits,
					parts,
				});

				return new Response(image, {
					status: 200,
					headers: { "Content-Type": "image/png", ...corsHeaders },
				});
			} catch (error) {
				console.error(error);
				return new Response("Server error", { status: 500, ...corsHeaders });
			}
		}

		if (url.pathname === "/fetch-all-nft-holders") {
			try {
				const { address, fromTokenId } = await request.json<
					{ address?: string; fromTokenId?: number }
				>();
				if (!address) return new Response("Invalid request", { status: 400 });

				const total = await HolderListFetcher.fetchAll(
					env,
					address,
					fromTokenId,
				);

				return new Response(JSON.stringify({ success: true, total }), {
					headers: { "Content-Type": "application/json" },
				});
			} catch (error) {
				console.error(error);
				return new Response("Server error", { status: 500 });
			}
		}

		if (url.pathname === "/generate-wallet-login-nonce") {
			const { walletAddress, domain, uri } = await request.json<
				{ walletAddress?: string; domain?: string; uri?: string }
			>();
			if (!walletAddress || !domain || !uri) {
				return new Response("Missing required parameters", { status: 400 });
			}

			const stmt = env.DB.prepare(`
				INSERT INTO wallet_login_nonces (wallet_address, domain, uri, nonce)
				VALUES (?, ?, ?, hex(randomblob(16)))
				ON CONFLICT(wallet_address) DO UPDATE
					SET domain     = excluded.domain,
							uri        = excluded.uri,
							issued_at  = strftime('%s','now'),
							nonce      = hex(randomblob(16))
				RETURNING nonce, issued_at
			`);

			const row = await stmt
				.bind(walletAddress, domain, uri)
				.first<{ nonce: string; issued_at: number }>();

			if (!row) {
				return new Response("Failed to upsert nonce", {
					status: 500,
					headers: corsHeaders,
				});
			}

			return Response.json(
				{ nonce: row.nonce, issuedAt: row.issued_at * 1000 },
				{ headers: { "Content-Type": "application/json", ...corsHeaders } },
			);
		}

		if (url.pathname === "/wallet-login") {
			const { walletAddress, signedMessage } = await request.json<
				{ walletAddress?: `0x${string}`; signedMessage?: `0x${string}` }
			>();
			if (!walletAddress || !signedMessage) {
				return new Response("Missing parameters", {
					status: 400,
					headers: corsHeaders,
				});
			}

			const nonceRow = await env.DB.prepare(
				`SELECT nonce, domain, uri, issued_at
				 FROM   wallet_login_nonces
				 WHERE  wallet_address = ?`,
			).bind(walletAddress).first<
				{ nonce: string; domain: string; uri: string; issued_at: number }
			>();

			if (!nonceRow) {
				return new Response("Invalid wallet address", {
					status: 400,
					headers: corsHeaders,
				});
			}

			const siweMessage = createSiweMessage({
				domain: nonceRow.domain,
				address: walletAddress,
				statement: "Login with Crypto Wallet",
				uri: nonceRow.uri,
				version: "1",
				chainId: 1,
				nonce: nonceRow.nonce,
				issuedAt: new Date(nonceRow.issued_at * 1000),
			});

			const isValidSig = await verifyMessage({
				address: walletAddress,
				message: siweMessage,
				signature: signedMessage,
			});

			if (!isValidSig) {
				return new Response("Invalid signature", {
					status: 400,
					headers: corsHeaders,
				});
			}

			await env.DB.prepare(
				`DELETE FROM wallet_login_nonces WHERE wallet_address = ?`,
			).bind(walletAddress).run();

			const jwtToken = await signJwt(
				{ wallet_address: walletAddress },
				env.JWT_SECRET,
			);

			const hdr = request.headers;
			await env.DB.prepare(
				`INSERT INTO user_sessions
				 (wallet_address, token, ip, real_ip, forwarded_for,
					user_agent, origin, referer, accept_language)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			).bind(
				walletAddress,
				jwtToken,
				hdr.get("cf-connecting-ip"),
				hdr.get("x-real-ip"),
				hdr.get("x-forwarded-for"),
				hdr.get("user-agent"),
				hdr.get("origin"),
				hdr.get("referer"),
				hdr.get("accept-language"),
			).run();

			return Response.json(
				{ token: jwtToken },
				{ headers: { "Content-Type": "application/json", ...corsHeaders } },
			);
		}

		return new Response("Not found", { status: 404 });
	},

	async scheduled(controller, env, ctx) {
		await TransferEventSyncer.run(env);
	},
} satisfies ExportedHandler<Env>;
