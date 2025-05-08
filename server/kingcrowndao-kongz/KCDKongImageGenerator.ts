import { ImageCombiner } from "@commonmodule/image-combiner-cf";
import { NFTData } from "nft-data";
import parts from "./parts.json";

export default class KCDKongImageGenerator {
  public static async generate(env: Env, url: string, data: NFTData) {
    const skins: string[] = [];
    for (const [partName, part] of Object.entries(data.parts)) {
      skins.push(`${partName}/${part}`);
    }

    const images: { path: string; drawingOrder: number }[] = [];
    for (const [partName, partValue] of Object.entries(data.parts)) {
      const category = parts.find((cat) => cat.name === partName);
      if (category) {
        const part = category.parts.find((p) => p.name === partValue);
        if (part?.images) {
          for (const image of part.images) {
            images.push({
              path: `/kingcrowndao-kongz/parts-images/${image.path}`,
              drawingOrder: image.drawingOrder,
            });
          }
        }
      }
    }

    const buffers = await Promise.all(
      images.map((image) =>
        env.ASSETS.fetch(new URL(image.path, url)).then((response) =>
          response.arrayBuffer()
        )
      ),
    );

    return ImageCombiner.combine(1000, 1000, buffers);
  }
}
