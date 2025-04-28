import { ImageCombiner } from "@commonmodule/image-combiner";
import { initWasm } from "@resvg/resvg-wasm";
import fs from "fs";
import partsInfo from "../assets/sigor-sparrows/parts.json" with {
  type: "json",
};
import legacyMetadatas from "./legacy-metadatas/sigor-sparrows-metadatas-legacy.json" with {
  type: "json",
};
import "dotenv/config";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";

const NFT_ADDRESS = "0x7340a44AbD05280591377345d21792Cdc916A388";

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

async function uploadToR2(key: string, body: Uint8Array) {
  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
    },
  });

  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: body,
      ContentType: "image/png",
      ACL: "public-read", // 필요 시
    }),
  );
  return `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET_NAME}/${key}`;
}

async function insertMetadataToD1(meta: typeof metadata, imageKey: string) {
  const endpoint =
    `https://api.cloudflare.com/client/v4/accounts/${process.env.D1_ACCOUNT_ID}/d1/database/${process.env.D1_DATABASE_ID}/query`;

  const sql =
    "UPDATE nfts SET (nft_address, token_id, style, parts, dialogue, image) = (?, ?, ?, ?, ?, ?) WHERE nft_address = ? AND token_id = ?";

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.CF_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sql,
      params: [
        NFT_ADDRESS,
        meta.id,
        meta.style,
        JSON.stringify(meta.parts),
        meta.dialogue,
        imageKey,

        NFT_ADDRESS,
        meta.id,
      ],
    }),
  });

  const out = (await res.json()) as { success: boolean; errors?: any };
  if (!out.success) throw new Error("D1 insert failed: " + JSON.stringify(out));
}

const objectKey = `sigor-sparrows/${uuidv4()}.png`;
const publicUrl = await uploadToR2(objectKey, combined);
console.log("✅  R2 저장 완료 →", publicUrl);

await insertMetadataToD1(metadata, publicUrl);
console.log("✅  D1 메타데이터 저장 완료");
