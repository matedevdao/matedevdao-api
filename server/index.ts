import { createPublicClient, http, parseAbiItem } from "viem";
import { kaia } from "viem/chains";
import ParsingNFTDataArtifact from "./artifacts/ParsingNFTData.json";

const SAFE_BLOCK_RANGE = 2500n;

const TransferEvent = parseAbiItem(
	"event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
);

const PARSING_NFT_DATA_CONTRACT_ADDRESS =
	"0x8A98A038dcA75091225EE0a1A11fC20Aa23832A0";

const kaiaPublicClient = createPublicClient({ chain: kaia, transport: http() });

const tokenIdsRanges: { [address: string]: { from: number; to: number } } = {
	"0xE47E90C58F8336A2f24Bcd9bCB530e2e02E1E8ae": { from: 0, to: 9999 }, // DogeSoundClub Mates
	"0x2B303fd0082E4B51e5A6C602F45545204bbbB4DC": { from: 0, to: 7999 }, // DogeSoundClub E-Mates
	"0xDeDd727ab86bce5D416F9163B2448860BbDE86d4": { from: 0, to: 19999 }, // DogeSoundClub Biased Mates
	"0x7340a44AbD05280591377345d21792Cdc916A388": { from: 0, to: 8000 }, // Sigor Sparrows
	"0x455Ee7dD1fc5722A7882aD6B7B8c075655B8005B": { from: 0, to: 8000 }, // Sigor House Deeds
	"0xF967431fb8F5B4767567854dE5448D2EdC21a482": { from: 0, to: 2999 }, // KCD Kongz
	"0x81b5C41Bac33ea696D9684D9aFdB6cd9f6Ee5CFF": { from: 1, to: 10000 }, // KCD Pixel Kongz
	"0x595b299Db9d83279d20aC37A85D36489987d7660": { from: 0, to: 2999 }, // BabyPing
};

function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getHolderListWithRetry({
	nftAddress,
	tokenIds,
	retries = 3,
	delayMs = 1000,
}: {
	nftAddress: string;
	tokenIds: bigint[];
	retries?: number;
	delayMs?: number;
}): Promise<string[]> {
	let attempt = 0;

	while (attempt <= retries) {
		try {
			const holderList = await kaiaPublicClient.readContract({
				address: PARSING_NFT_DATA_CONTRACT_ADDRESS,
				abi: ParsingNFTDataArtifact.abi,
				functionName: "getERC721HolderList",
				args: [nftAddress, tokenIds],
			}) as string[];

			return holderList;
		} catch (error) {
			console.warn(
				`Attempt ${attempt + 1} failed for tokens ${tokenIds[0]}~${
					tokenIds[tokenIds.length - 1]
				}:`,
				error,
			);
			if (attempt === retries) throw error;
			await wait(delayMs);
			attempt++;
		}
	}

	throw new Error("Max retries reached");
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === "/fetch-all-nft-holders") {
			try {
				const { address, fromTokenId } = await request.json<
					{ address?: string; fromTokenId?: number }
				>();
				if (!address) return new Response("Invalid request", { status: 400 });

				const range = tokenIdsRanges[address];
				if (!range) {
					return new Response("Token ID range not found", { status: 404 });
				}

				const { from, to } = fromTokenId === undefined
					? range
					: { from: fromTokenId, to: range.to };
				let holderList: string[] = [];

				for (let start = from; start <= to; start += 100) {
					const end = Math.min(start + 99, to);
					const tokenIds: bigint[] = [];
					for (let i = start; i <= end; i++) {
						tokenIds.push(BigInt(i));
					}

					const batchHolderList = await getHolderListWithRetry({
						nftAddress: address,
						tokenIds,
					});

					holderList = holderList.concat(batchHolderList);

					await env.DB.batch(
						batchHolderList.map((holder, index) =>
							env.DB.prepare(
								`INSERT OR REPLACE INTO nft_holders (nft_address, token_id, holder) VALUES (?, ?, ?)`,
							).bind(address, start + index, holder)
						),
					);
				}

				return new Response(
					JSON.stringify({ success: true, total: holderList.length }),
					{
						headers: { "Content-Type": "application/json" },
					},
				);
			} catch (error) {
				console.error(error);
				return new Response("Server error", { status: 500 });
			}
		}

		return new Response(JSON.stringify({ name: "Cloudflare" }), {
			headers: { "Content-Type": "application/json" },
		});
	},

	async scheduled(controller, env, ctx) {
		//TODO:
	},
} satisfies ExportedHandler<Env>;
