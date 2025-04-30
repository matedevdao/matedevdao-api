import { ImageCombiner } from "@commonmodule/image-combiner-cf";
import font from "./fonts/neodgm.woff2";
import HolderListFetcher from "./HolderListFetcher.js";
import MetadataManager from "./MetadataManager.js";
import TransferEventSyncer from "./TransferEventSyncer.js";

export default {
	async fetch(request, env, ctx): Promise<Response> {
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

			const metadataMap = await MetadataManager.fetchBulkMetadata(
				env.DB,
				[{ collection, tokenId }],
			);
			const metadata = metadataMap[`${collection}:${tokenId}`];
			if (!metadata) return new Response("Metadata not found", { status: 404 });

			return new Response(JSON.stringify(metadata), {
				headers: { "Content-Type": "application/json" },
			});
		}

		if (url.pathname.endsWith("/nfts")) {
			const walletAddress = url.pathname.split("/")[1];
			if (!walletAddress) {
				return new Response("Invalid request", { status: 400 });
			}

			const metadataMap = await MetadataManager.fetchHoldingNFTMetadatas(
				env.DB,
				walletAddress,
			);

			const metadatas = Object.entries(metadataMap).map(([key, metadata]) => {
				const [collection, tokenId] = key.split(":");
				return {
					collection,
					tokenId: parseInt(tokenId),
					...metadata,
				};
			});

			return new Response(JSON.stringify(metadatas), {
				headers: { "Content-Type": "application/json" },
			});
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

		return new Response("Not found", { status: 404 });
	},

	async scheduled(controller, env, ctx) {
		await TransferEventSyncer.run(env);
	},
} satisfies ExportedHandler<Env>;
