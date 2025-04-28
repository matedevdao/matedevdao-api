import { ImageCombiner } from "@commonmodule/image-combiner-cf";
import font from "./fonts/neodgm.woff2";
import HolderListFetcher from "./HolderListFetcher.js";
import DogeSoundClubBiasedMatesMetadatas from "./static-metadatas/dogesoundclub-biased-mates-metadatas.json";
import DogeSoundClubEMatesMetadatas from "./static-metadatas/dogesoundclub-e-mates-metadatas.json";
import DogeSoundClubMatesMetadatas from "./static-metadatas/dogesoundclub-mates-metadatas.json";
import KingCrownDAOPixelKongzMetadatas from "./static-metadatas/kingcrowndao-pixel-kongz-metadatas.json";
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
			const tokenId = url.pathname.split("/")[3];
			if (!collection || !tokenId) {
				return new Response("Invalid request", { status: 400 });
			}
			let metadatas: any;
			if (collection === "dogesoundclub-biased-mates") {
				metadatas = DogeSoundClubBiasedMatesMetadatas;
			} else if (collection === "dogesoundclub-e-mates") {
				metadatas = DogeSoundClubEMatesMetadatas;
			} else if (collection === "dogesoundclub-mates") {
				metadatas = DogeSoundClubMatesMetadatas;
			} else if (collection === "kingcrowndao-pixel-kongz") {
				metadatas = KingCrownDAOPixelKongzMetadatas;
			} else {
				return new Response("Collection not found", { status: 404 });
			}

			const tokenIdNum = parseInt(tokenId);
			if (isNaN(tokenIdNum) || tokenIdNum < 0) {
				return new Response("Invalid token ID", { status: 400 });
			}

			const metadata = metadatas.find((item: any) => item.id === tokenIdNum);
			if (!metadata) return new Response("Metadata not found", { status: 404 });

			return new Response(JSON.stringify(metadata), {
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
