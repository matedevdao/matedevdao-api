import { createPublicClient, getAddress, http, parseAbiItem } from "viem";
import { kaia } from "viem/chains";

const SAFE_BLOCK_RANGE = 2500n;

const TransferEvent = parseAbiItem(
	"event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
);

const kaiaPublicClient = createPublicClient({ chain: kaia, transport: http() });

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === "/fetch-all-nft-holders") {
		}

		return new Response(JSON.stringify({ name: "Cloudflare" }), {
			headers: { "Content-Type": "application/json" },
		});
	},

	async scheduled(controller, env, ctx) {
		//TODO:
	},
} satisfies ExportedHandler<Env>;
