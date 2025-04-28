import { ImageCombiner } from "@commonmodule/image-combiner";
import { initWasm } from "@resvg/resvg-wasm";
import fs from "fs";
import partsInfo from "../assets/sigor-sparrows/parts.json" with {
  type: "json",
};
import legacyMetadatas from "./legacy-metadatas/sigor-sparrows-metadatas-legacy.json" with {
  type: "json",
};

await initWasm(
  fs.readFileSync("./node_modules/@resvg/resvg-wasm/index_bg.wasm"),
);

const legacyMetadata = (legacyMetadatas as any)[0];
const metadata = {
  id: legacyMetadata.id,
  style: legacyMetadata.style ? "Illustration" : legacyMetadata.style,
  parts: legacyMetadata.parts,
  dialogue: legacyMetadata.ment,
};

const imageParts: any[] = [];
for (const [traitId, trait] of (partsInfo as any).entries()) {
  if (
    trait.condition === undefined ||
    Object.entries(metadata.parts).find((p) =>
        p[0] === trait.condition.trait &&
        trait.condition.values.includes(p[1]) === true
      ) !== undefined
  ) {
    for (const [partId, part] of trait.parts.entries()) {
      if (
        (part as any).condition === undefined ||
        Object.entries(metadata.parts).find((p) =>
            p[0] === (part as any).condition.trait &&
            (part as any).condition.values.includes(p[1]) === true
          ) !== undefined
      ) {
        if (metadata.parts[trait.name] === part.name) {
          imageParts.push({ traitId, partId });
          break;
        }
      }
    }
  }
}

let images: any[] = [];
for (const imagePart of imageParts) {
  images = images.concat(
    partsInfo[imagePart.traitId].parts[imagePart.partId].images,
  );
}
images.sort((a, b) => a.order - b.order);

const imageBuffers: Buffer[] = [];

for (const image of images) {
  if (metadata.style === "Pixel Art") {
    if (image.path.indexOf("8.TEXT BALLOON") === -1) {
      imageBuffers.push(
        fs.readFileSync(
          `../assets/sigor-sparrows/parts-images/pixel/${image.path}}`,
        ),
      );
    }
  } else {
    imageBuffers.push(
      fs.readFileSync(
        `../assets/sigor-sparrows/parts-images/normal/${image.path}`,
      ),
    );
  }
}

const fontBytes = fs.readFileSync("./fonts/neodgm.woff2");
const combined = ImageCombiner.combine(1000, 1000, imageBuffers, {
  fontBytes,
  x: 500,
  y: 500 - 310,
  text: legacyMetadata.ment,
  fontSize: 64,
  color: "#000",
});

fs.writeFileSync(`./sigor-sparrows-images/${metadata.id}.png`, combined);
