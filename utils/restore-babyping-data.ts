import { ImageCombiner } from "@commonmodule/image-combiner";
import { initWasm } from "@resvg/resvg-wasm";
import fs from "fs";
import partsInfo from "../assets/babyping/parts.json" with {
  type: "json",
};
import legacyMetadatas from "./legacy-metadatas/babyping-metadatas-legacy.json" with {
  type: "json",
};

await initWasm(
  fs.readFileSync("./node_modules/@resvg/resvg-wasm/index_bg.wasm"),
);

const id = 0;
const legacyMetadata = (legacyMetadatas as any)[id];

const parts: any = {};
for (const { trait_type, value } of legacyMetadata.attributes) {
  parts[trait_type] = value;
}
const metadata = { id, parts };

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
  imageBuffers.push(
    fs.readFileSync(`../assets/babyping/parts-images/${image.path}`),
  );
}

const combined = ImageCombiner.combine(1000, 1000, imageBuffers);

fs.writeFileSync(`./babyping-images/${metadata.id}.png`, combined);
