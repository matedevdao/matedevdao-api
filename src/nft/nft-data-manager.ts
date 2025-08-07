import { OpenSeaMetadataConverter } from 'nft-data';
import { NFTData } from '../types/nft';
import { nftAddresses } from './nft-addresses';
/*import DogeSoundClubBiasedMatesMetadata from './static-metadata/dogesoundclub-biased-mates-metadata.json' assert { type: 'json' };
import DogeSoundClubEMatesMetadata from './static-metadata/dogesoundclub-e-mates-metadata.json' assert { type: 'json' };
import DogeSoundClubMatesMetadata from './static-metadata/dogesoundclub-mates-metadata.json' assert { type: 'json' };
import KingCrownDAOPixelKongzMetadata from './static-metadata/kingcrowndao-pixel-kongz-metadata.json' assert { type: 'json' };*/

interface NFTRow {
  nft_address: string;
  token_id: number;
  holder: string;
  style?: string;
  parts?: string;
  dialogue?: string;
  image?: string;
}

class NFTDataManager {
  private getStaticMetadata(collection: string, tokenId: number) {
    let metadatas: any;
    /*if (collection === 'dogesoundclub-biased-mates') {
      metadatas = DogeSoundClubBiasedMatesMetadata;
    } else if (collection === 'dogesoundclub-e-mates') {
      metadatas = DogeSoundClubEMatesMetadata;
    } else if (collection === 'dogesoundclub-mates') {
      metadatas = DogeSoundClubMatesMetadata;
    } else if (collection === 'kingcrowndao-pixel-kongz') {
      metadatas = KingCrownDAOPixelKongzMetadata;
    }*/
    return metadatas?.find((item: any) => item.id === tokenId);
  }

  private rowsToData(rows: NFTRow[]) {
    const data: { [key: string]: NFTData } = {};

    for (const row of rows) {
      const collection = Object.keys(nftAddresses).find((key) =>
        nftAddresses[key] === row.nft_address
      );
      if (!collection) {
        throw new Error(`Unknown collection address: ${row.nft_address}`);
      }

      const staticMetadata = this.getStaticMetadata(collection, row.token_id);
      if (staticMetadata) {
        data[`${collection}:${row.token_id}`] = {
          ...staticMetadata,
          ...OpenSeaMetadataConverter.convertToNFTData(staticMetadata),
          collection,
          id: row.token_id,
          holder: row.holder,
        };
      } else {
        let name;
        let image;
        let description;
        let external_url;
        let traits: { [traitName: string]: string } | undefined;

        let parts: { [partName: string]: string } = {};
        if (row.parts) parts = JSON.parse(row.parts);

        if (collection === 'sigor-sparrows') {
          name = 'Sigor Sparrow #' + row.token_id;
          image =
            `https://pub-b5f5f68564ba4ce693328fe84e1a6c57.r2.dev/sigor-sparrows/${row.image}`;
          traits = {};
          if (row.style) traits['Style'] = row.style;
          if (row.dialogue) traits['Dialogue'] = row.dialogue;
          external_url = 'https://sigor.com/';
        } else if (collection === 'sigor-housedeeds') {
          name = 'Sigor House Deed #' + row.token_id;
          image =
            'https://matedevdao.github.io/static-kaia-nft-assets/sigor-housedeed-legacy.avif';
          external_url = 'https://sigor.com/';
        } else if (collection === 'kingcrowndao-kongz') {
          name = 'KCD Kong #' + row.token_id;
          image =
            `https://pub-b5f5f68564ba4ce693328fe84e1a6c57.r2.dev/kingcrowndao-kongz/${row.image}`;
          external_url = 'https://kingcrowndao.github.io/';
        } else if (collection === 'babyping') {
          name = 'BabyPing #' + row.token_id;
          image =
            `https://pub-b5f5f68564ba4ce693328fe84e1a6c57.r2.dev/babyping/${row.image}`;
        }

        data[`${collection}:${row.token_id}`] = {
          collection,
          id: row.token_id,
          name: name ? name : `#${row.token_id}`,
          description: description ? description : `#${row.token_id}`,
          image: image ? image : '',
          external_url: external_url ? external_url : '',
          traits,
          parts,
          holder: row.holder,
        };
      }
    }

    return data;
  }

  public async fetchBulkData(
    db: D1Database,
    tokens: { collection: string; tokenId: number }[],
  ) {
    const pairs: { address: string; tokenId: number }[] = [];
    for (const { collection, tokenId } of tokens) {
      const address = nftAddresses[collection];
      if (!address) throw new Error(`Unknown collection: ${collection}`);
      pairs.push({ address, tokenId });
    }

    if (pairs.length > 0) {
      const placeholders = pairs.map(() => '(?, ?)').join(', ');
      const sql =
        `SELECT nft_address, token_id, holder, style, parts, dialogue, image \n` +
        `FROM nfts \n` +
        `WHERE (nft_address, token_id) IN (${placeholders})`;

      const bindValues: (string | number)[] = [];
      for (const { address, tokenId } of pairs) {
        bindValues.push(address, tokenId);
      }

      const stmt = db.prepare(sql).bind(...bindValues);
      const { results } = await stmt.all<NFTRow>();

      return this.rowsToData(results);
    }
    return {};
  }

  public async fetchHoldingNFTData(db: D1Database, address: string) {
    const sql =
      `SELECT nft_address, token_id, holder, style, parts, dialogue, image \n` +
      `FROM nfts \n` +
      `WHERE holder = ?`;

    const stmt = db.prepare(sql).bind(address);
    const { results } = await stmt.all<NFTRow>();

    return this.rowsToData(results);
  }
}

const nftDataManager = new NFTDataManager();

export { nftDataManager };
