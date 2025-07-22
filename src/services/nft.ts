import { kaiaClient } from '../kaia';
import ParsingNFTDataArtifact from '../nft/ParsingNFTData.json';

const PARSING_NFT_DATA_CONTRACT_ADDRESS =
  '0x8A98A038dcA75091225EE0a1A11fC20Aa23832A0';

async function getBalances(address: `0x${string}`, contracts: `0x${string}`[]): Promise<bigint[]> {
  return await kaiaClient.readContract({
    address: PARSING_NFT_DATA_CONTRACT_ADDRESS,
    abi: ParsingNFTDataArtifact.abi,
    functionName: 'getERC721BalanceList_OneHolder',
    args: [address as `0x${string}`, contracts],
  }) as bigint[];
}

export { getBalances };
