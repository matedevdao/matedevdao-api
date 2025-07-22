import { getAddress, parseAbiItem } from 'viem';
import { kaiaClient } from '../kaia';
import { TOKEN_IDS_RANGES } from './nft-constants';

const SAFE_BLOCK_RANGE = 2500n;

const TransferEvent = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
);

class TransferEventSyncer {
  public async run(env: Env) {
    const lastSyncedRow = await env.DB.prepare(
      `SELECT last_synced_block_number FROM contract_event_sync_status WHERE contract_type = ?`,
    ).bind('ERC721').first<{ last_synced_block_number: number }>();

    let lastParsedBlock = lastSyncedRow
      ? BigInt(lastSyncedRow.last_synced_block_number)
      : undefined;

    if (!lastParsedBlock) throw new Error('Last parsed block not found');

    let toBlock = lastParsedBlock + SAFE_BLOCK_RANGE;

    const currentBlock = await kaiaClient.getBlockNumber();
    if (toBlock > currentBlock) toBlock = currentBlock;

    let fromBlock = toBlock - SAFE_BLOCK_RANGE * 2n;
    if (fromBlock < 0) fromBlock = 0n;

    const logs = await kaiaClient.getLogs({
      address: Object.keys(TOKEN_IDS_RANGES) as `0x${string}`[],
      event: TransferEvent,
      fromBlock,
      toBlock,
    });

    const transfers = logs.map((log) => ({
      address: getAddress(log.address),
      from: log.args.from,
      to: log.args.to,
      tokenId: log.args.tokenId,
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash,
      logIndex: log.logIndex,
    }));

    for (const transfer of transfers) {
      await env.DB.prepare(
        `INSERT OR REPLACE INTO nfts (nft_address, token_id, holder) VALUES (?, ?, ?)`,
      ).bind(transfer.address, Number(transfer.tokenId), transfer.to).run();
    }

    await env.DB.prepare(
      `UPDATE contract_event_sync_status
       SET last_synced_block_number = ?, last_synced_at = strftime('%s','now')
       WHERE contract_type = ?`,
    ).bind(Number(toBlock), 'ERC721').run();
  }
}

const transferEventSyncer = new TransferEventSyncer();

export { transferEventSyncer };
