import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { ImageCombiner } from "@commonmodule/image-combiner";
import { initWasm } from "@resvg/resvg-wasm";
import "dotenv/config";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import partsInfo from "../assets/kingcrowndao-kongz/parts.json" with {
  type: "json",
};
import legacyMetadatas from "./legacy-metadatas/kingcrowndao-kongz-metadatas-legacy.json" with {
  type: "json",
};

const NFT_ADDRESS = "0xF967431fb8F5B4767567854dE5448D2EdC21a482";

await initWasm(
  fs.readFileSync("./node_modules/@resvg/resvg-wasm/index_bg.wasm"),
);

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
    }),
  );
  return `https://pub-b5f5f68564ba4ce693328fe84e1a6c57.r2.dev/${key}`;
}

async function insertMetadataToD1(
  metadata: { id: number; parts: Record<string, string> },
  image: string,
) {
  const endpoint =
    `https://api.cloudflare.com/client/v4/accounts/${process.env.D1_ACCOUNT_ID}/d1/database/${process.env.D1_DATABASE_ID}/query`;

  const sql =
    "UPDATE nfts SET (nft_address, token_id, parts, image) = (?, ?, ?, ?) WHERE nft_address = ? AND token_id = ?";

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
        metadata.id,
        JSON.stringify(metadata.parts),
        image,

        NFT_ADDRESS,
        metadata.id,
      ],
    }),
  });

  const out = (await res.json()) as { success: boolean; errors?: any };
  if (!out.success) {
    throw new Error("D1 insert failed: " + JSON.stringify(out));
  }
}

for (let id = 0; id <= 2999; id++) {
  const legacyMetadata = (legacyMetadatas as any)[id];

  const parts: Record<string, string> = {};
  for (const { trait_type, value } of legacyMetadata.attributes) {
    parts[trait_type] = value;
  }
  const metadata = { id, parts };

  if (metadata.id < 2542) continue;

  console.log(`${metadata.id} 시작`);

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
    const part = partsInfo[imagePart.traitId].parts[imagePart.partId];
    if (part.name === "empty") continue;
    images = images.concat(part.images);
  }
  images.sort((a, b) => a.order - b.order);

  const imageBuffers: Buffer[] = [];

  for (const image of images) {
    imageBuffers.push(
      fs.readFileSync(
        `../assets/kingcrowndao-kongz/parts-images/${image.path}`,
      ),
    );
  }

  const combined = ImageCombiner.combine(1000, 1000, imageBuffers);

  //fs.writeFileSync(`./kingcrowndao-kongz-images/${metadata.id}.png`, combined);

  const fileName = `${uuidv4()}.png`;
  const publicUrl = await uploadToR2(
    `kingcrowndao-kongz/${fileName}`,
    combined,
  );
  console.log("✅  R2 저장 완료 →", publicUrl);

  try {
    await insertMetadataToD1(metadata, fileName);
  } catch (e) {
    console.error("❌  D1 메타데이터 저장 실패 1회차", e);
    await insertMetadataToD1(metadata, fileName);
  }
  console.log("✅  D1 메타데이터 저장 완료");

  console.log("✅  완료", metadata.id);
}
