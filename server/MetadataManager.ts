import DogeSoundClubBiasedMatesMetadatas from "./static-metadatas/dogesoundclub-biased-mates-metadatas.json";
import DogeSoundClubEMatesMetadatas from "./static-metadatas/dogesoundclub-e-mates-metadatas.json";
import DogeSoundClubMatesMetadatas from "./static-metadatas/dogesoundclub-mates-metadatas.json";
import KingCrownDAOPixelKongzMetadatas from "./static-metadatas/kingcrowndao-pixel-kongz-metadatas.json";

class MetadataManager {
  private dynamicNFTCollections: string[] = [
    "sigor-sparrows",
    "kingcrowndao-kongz",
    "babyping",
  ];

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

  public async getMetadata(
    db: D1Database,
    collection: string,
    tokenId: number,
  ) {
    if (this.dynamicNFTCollections.includes(collection)) {
      let nftAddress;
      if (collection === "sigor-sparrows") {
        nftAddress = "0x7340a44AbD05280591377345d21792Cdc916A388";
      } else if (collection === "kingcrowndao-kongz") {
        nftAddress = "0xF967431fb8F5B4767567854dE5448D2EdC21a482";
      } else if (collection === "babyping") {
        nftAddress = "0x595b299Db9d83279d20aC37A85D36489987d7660";
      }
      if (nftAddress) {
        const row = await db.prepare(
          "SELECT holder, style, parts, dialogue, image FROM nfts WHERE collection = ? AND token_id = ?",
        ).bind(
          nftAddress,
          tokenId,
        ).first<{
          holder: string;
          style: string;
          parts: string;
          dialogue: string;
          image: string;
        }>();
        if (row) {
          return {
            ...row,
            parts: JSON.parse(row.parts),
            dialogue: row.dialogue,
          };
        }
      }
    } else {
      return this.getStaticMetadata(collection, tokenId);
    }
  }
}

export default new MetadataManager();
