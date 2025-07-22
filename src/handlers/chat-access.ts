import { z } from 'zod';
import { nftAddresses } from '../nft/nft-addresses';
import { jsonWithCors } from '../services/cors';
import { getBalances } from '../services/nft';

const WHITELIST = [
  '0xbB22b6F3CE72A5Beb3CC400d9b6AF808A18E0D4c'
];

const querySchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, '유효하지 않은 이더리움 주소'),
});

async function handleChatAccess(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const parsedQuery = querySchema.safeParse(Object.fromEntries(url.searchParams));

    if (!parsedQuery.success) {
      return jsonWithCors({ error: parsedQuery.error.format() }, 400);
    }

    const { address } = parsedQuery.data;

    const nfts = Object.entries(nftAddresses).map(([collection, address]) => ({
      collection,
      address,
    }));

    const contracts = nfts.map(c => c.address);
    const balances = await getBalances(address as `0x${string}`, contracts);

    const result: Record<string, boolean> = {};

    for (let i = 0; i < nfts.length; i++) {
      result[nfts[i].collection] = (balances[i] ?? 0n) > 0n;
    }

    if (WHITELIST.includes(address)) {
      for (const key of Object.keys(result)) {
        result[key] = true;
      }
    }

    return jsonWithCors(result);
  } catch (err) {
    console.error(err);
    return jsonWithCors({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
}

export { handleChatAccess };
