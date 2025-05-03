import { ImageCombiner } from "@commonmodule/image-combiner-cf";
import { OpenSeaMetadataConverter } from "nft-data";
import font from "./fonts/neodgm.woff2";
import HolderListFetcher from "./HolderListFetcher.js";
import NFTDataManager from "./NFTDataManager.js";
import TransferEventSyncer from "./TransferEventSyncer.js";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers":
		"authorization, x-client-info, apikey, content-type",
	"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

export default {
	async fetch(request, env, ctx): Promise<Response> {
		if (request.method === "OPTIONS") {
			return new Response(null, {
				status: 204,
				headers: corsHeaders,
			});
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
			const { collection, tokenId, traits, parts } = await request
				.json<{
					collection?: string;
					tokenId?: number;
					traits?: { [traitName: string]: string | number };
					parts?: { [partName: string]: string | number };
				}>();
			//TODO:
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
				{ nonce: row.nonce, issuedAt: row.issued_at },
				{ headers: { "Content-Type": "application/json", ...corsHeaders } },
			);
		}

		if (url.pathname === "/wallet-login") {
			//TODO: Implement this
		}

		return new Response("Not found", { status: 404 });
	},

	async scheduled(controller, env, ctx) {
		await TransferEventSyncer.run(env);
	},
} satisfies ExportedHandler<Env>;
