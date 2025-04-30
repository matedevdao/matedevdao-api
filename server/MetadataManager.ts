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

interface NFTData {
  nft_address: string;
  token_id: number;
  holder: string;
  style?: string;
  parts?: string;
  dialogue?: string;
  image?: string;
}

class MetadataManager {
  public getStaticMetadata(
    collection: string,
    tokenId: number,
  ) {
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

  public async fetchBulkMetadata(
    db: D1Database,
    tokens: { collection: string; tokenId: number }[],
  ) {
    const metadataMap = new Map<string, any>();

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
      const { results } = await stmt.all<NFTData>();

      for (const row of results) {
        const collection = Object.keys(collectionAddresses).find((key) =>
          collectionAddresses[key] === row.nft_address
        );
        if (!collection) {
          throw new Error(`Unknown collection address: ${row.nft_address}`);
        }

        const staticMetadata = this.getStaticMetadata(collection, row.token_id);
        if (staticMetadata) {
          metadataMap.set(`${collection}:${row.token_id}`, {
            ...staticMetadata,
            holder: row.holder,
          });
        } else {
          let name;
          let image;
          let description;
          let external_url;

          const attributes: {
            "display_type"?: string;
            "trait_type": string;
            "value": string | number;
          }[] = [];

          if (row.parts) {
            const parts = JSON.parse(row.parts);
            for (const partName of Object.keys(parts)) {
              const value = parts[partName];
              if (typeof value === "number") {
                attributes.push({
                  display_type: "number",
                  trait_type: partName,
                  value,
                });
              } else {
                attributes.push({ trait_type: partName, value });
              }
            }
          }

          if (collection === "sigor-sparrows") {
            name = "Sigor Sparrow #" + row.token_id;
            image =
              `https://pub-b5f5f68564ba4ce693328fe84e1a6c57.r2.dev/sigor-sparrows/${row.image}.png`;
          } else if (collection === "sigor-housedeeds") {
            name = "Sigor House Deed #" + row.token_id;
          } else if (collection === "kingcrowndao-kongz") {
            name = "KCD Kong #" + row.token_id;
            image =
              `https://pub-b5f5f68564ba4ce693328fe84e1a6c57.r2.dev/kingcrowndao-kongz/${row.image}.png`;
          } else if (collection === "babyping") {
            name = "BabyPing #" + row.token_id;
            image =
              `https://pub-b5f5f68564ba4ce693328fe84e1a6c57.r2.dev/babyping/${row.image}.png`;
          }

          metadataMap.set(`${collection}:${row.token_id}`, {
            name,
            description,
            image,
            external_url,
            attributes,
            holder: row.holder,
          });
        }
      }
    }

    return metadataMap;
  }
}

export default new MetadataManager();
