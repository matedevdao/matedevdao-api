import { ImageCombiner } from "@commonmodule/image-combiner-cf";
import { NFTData } from "nft-data";
import font from "./fonts/neodgm.woff2";
import parts from "./parts.json";

export default class SigorSparrowImageGenerator {
  public static async generate(env: Env, url: string, data: NFTData) {
    const skins: string[] = [];
    for (const [partName, part] of Object.entries(data.parts)) {
      skins.push(`${partName}/${part}`);
    }

    const style = data.traits!["Style"] as string;
    const stylePath = style === "Illustration" ? "normal" : "pixel";

    const images: { path: string; drawingOrder: number }[] = [];

    for (const [partName, partValue] of Object.entries(data.parts)) {
      if (stylePath === "pixel" && partName === "Text Balloon") continue;
      const category = parts.find((cat) => cat.name === partName);
      if (category) {
        const part = category.parts.find((p) => p.name === partValue);
        if (part?.images) {
          for (const image of part.images) {
            images.push({
              path: `/sigor-sparrows/parts-images/${stylePath}/${image.path}`,
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

    const fontBytes = new Uint8Array(font);

    return ImageCombiner.combine(1000, 1000, buffers, {
      fontBytes,
      x: 500,
      y: 190,
      text: data.traits!["Dialogue"] as string,
      fontSize: 64,
      color: "#000",
    });
  }
}
