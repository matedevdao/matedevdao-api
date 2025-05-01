import { OpenSeaMetadataConverter } from "nft-data";
import NFTData from "./NFTData.js";
import DogeSoundClubBiasedMatesMetadatas from "./static-metadatas/dogesoundclub-biased-mates-metadatas.json";
import DogeSoundClubEMatesMetadatas from "./static-metadatas/dogesoundclub-e-mates-metadatas.json";
import DogeSoundClubMatesMetadatas from "./static-metadatas/dogesoundclub-mates-metadatas.json";
import KingCrownDAOPixelKongzMetadatas from "./static-metadatas/kingcrowndao-pixel-kongz-metadatas.json";

const collectionAddresses: Record<string, string> = {
  "dogesoundclub-mates": "0xE47E90C58F8336A2f24Bcd9bCB530e2e02E1E8ae",
  "dogesoundclub-e-mates": "0x2B303fd0082E4B51e5A6C602F45545204bbbB4DC",
  "dogesoundclub-biased-mates": "0xDeDd727ab86bce5D416F9163B2448860BbDE86d4",
  "sigor-sparrows": "0x7340a44AbD05280591377345d21792Cdc916A388",
  "sigor-housedeeds": "0x455Ee7dD1fc5722A7882aD6B7B8c075655B8005B",
  "kingcrowndao-kongz": "0xF967431fb8F5B4767567854dE5448D2EdC21a482",
  "kingcrowndao-pixel-kongz": "0x81b5C41Bac33ea696D9684D9aFdB6cd9f6Ee5CFF",
  "babyping": "0x595b299Db9d83279d20aC37A85D36489987d7660",
};

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
    if (collection === "dogesoundclub-biased-mates") {
      metadatas = DogeSoundClubBiasedMatesMetadatas;
    } else if (collection === "dogesoundclub-e-mates") {
      metadatas = DogeSoundClubEMatesMetadatas;
    } else if (collection === "dogesoundclub-mates") {
      metadatas = DogeSoundClubMatesMetadatas;
    } else if (collection === "kingcrowndao-pixel-kongz") {
      metadatas = KingCrownDAOPixelKongzMetadatas;
    }
    return metadatas?.find((item: any) => item.id === tokenId);
  }

  private rowsToData(rows: NFTRow[]) {
    const data: { [key: string]: NFTData } = {};

    for (const row of rows) {
      const collection = Object.keys(collectionAddresses).find((key) =>
        collectionAddresses[key] === row.nft_address
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

        if (collection === "sigor-sparrows") {
          name = "Sigor Sparrow #" + row.token_id;
          image =
            `https://pub-b5f5f68564ba4ce693328fe84e1a6c57.r2.dev/sigor-sparrows/${row.image}`;
          traits = {};
          if (row.style) traits["Style"] = row.style;
          if (row.dialogue) traits["Dialogue"] = row.dialogue;
          external_url = "https://sigor.com/";
        } else if (collection === "sigor-housedeeds") {
          name = "Sigor House Deed #" + row.token_id;
          image =
            "https://matedevdao.github.io/static-kaia-nft-assets/sigor-housedeed-legacy.avif";
          external_url = "https://sigor.com/";
        } else if (collection === "kingcrowndao-kongz") {
          name = "KCD Kong #" + row.token_id;
          image =
            `https://pub-b5f5f68564ba4ce693328fe84e1a6c57.r2.dev/kingcrowndao-kongz/${row.image}`;
          external_url = "https://kingcrowndao.github.io/";
        } else if (collection === "babyping") {
          name = "BabyPing #" + row.token_id;
          image =
            `https://pub-b5f5f68564ba4ce693328fe84e1a6c57.r2.dev/babyping/${row.image}`;
        }

        data[`${collection}:${row.token_id}`] = {
          collection,
          id: row.token_id,
          name: name ? name : `#${row.token_id}`,
          description: description ? description : `#${row.token_id}`,
          image: image ? image : "",
          external_url: external_url ? external_url : "",
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
      const address = collectionAddresses[collection];
      if (!address) throw new Error(`Unknown collection: ${collection}`);
      pairs.push({ address, tokenId });
    }

    if (pairs.length > 0) {
      const placeholders = pairs.map(() => "(?, ?)").join(", ");
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

export default new NFTDataManager();
