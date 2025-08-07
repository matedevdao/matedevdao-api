import { kaiaClient } from '../kaia';
import { TOKEN_IDS_RANGES } from './nft-constants';
import ParsingNFTDataArtifact from './ParsingNFTData.json' assert { type: 'json' };

const PARSING_NFT_DATA_CONTRACT_ADDRESS =
  '0x8A98A038dcA75091225EE0a1A11fC20Aa23832A0';

class NFTHolderFetcher {
  private async fetchWithRetry({
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
        const holderList = await kaiaClient.readContract({
          address: PARSING_NFT_DATA_CONTRACT_ADDRESS,
          abi: ParsingNFTDataArtifact.abi,
          functionName: 'getERC721HolderList',
          args: [nftAddress, tokenIds],
        }) as string[];

        return holderList;
      } catch (error) {
        console.warn(
          `Attempt ${attempt + 1} failed for tokens ${tokenIds[0]}~${tokenIds[tokenIds.length - 1]
          }:`,
          error,
        );
        if (attempt === retries) throw error;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        attempt++;
      }
    }

    throw new Error('Max retries reached');
  }

  public async fetchAll(env: Env, address: string, fromTokenId?: number) {
    const range = TOKEN_IDS_RANGES[address];
    if (!range) {
      return new Response('Token ID range not found', { status: 404 });
    }

    const { from, to } = fromTokenId === undefined
      ? range
      : { from: fromTokenId, to: range.to };
    let total = 0;

    for (let start = from; start <= to; start += 500) {
      const end = Math.min(start + 499, to);
      const tokenIds: bigint[] = [];
      for (let i = start; i <= end; i++) {
        tokenIds.push(BigInt(i));
      }

      const holders = await this.fetchWithRetry({
        nftAddress: address,
        tokenIds,
      });

      total += holders.length;

      await env.DB.batch(
        holders.map((holder, index) =>
          env.DB.prepare(
            `INSERT OR REPLACE INTO nft_holders (nft_address, token_id, holder) VALUES (?, ?, ?)`,
          ).bind(address, start + index, holder)
        ),
      );
    }

    return total;
  }
}

const nftHolderFetcher = new NFTHolderFetcher();

export { nftHolderFetcher };
