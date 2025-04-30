import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { ImageCombiner } from "@commonmodule/image-combiner";
import { initWasm } from "@resvg/resvg-wasm";
import "dotenv/config";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import partsInfo from "../assets/sigor-sparrows/parts.json" with {
  type: "json",
};
import legacyMetadatas from "./legacy-metadatas/sigor-sparrows-metadatas-legacy.json" with {
  type: "json",
};

const NFT_ADDRESS = "0x7340a44AbD05280591377345d21792Cdc916A388";

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
  metadata: {
    id: number;
    style: string;
    parts: Record<string, string>;
    dialogue: string;
  },
  image: string,
) {
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
        metadata.id,
        metadata.style,
        JSON.stringify(metadata.parts),
        metadata.dialogue,
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

const _legacyMetadatas = (legacyMetadatas as any).sort(
  (a: any, b: any) => a.id - b.id,
);

for (const legacyMetadata of _legacyMetadatas) {
  const metadata = {
    id: legacyMetadata.id,
    style: !legacyMetadata.style ? "Illustration" : legacyMetadata.style,
    parts: legacyMetadata.parts,
    dialogue: legacyMetadata.ment,
  };

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

  //fs.writeFileSync(`./sigor-sparrows-images/${metadata.id}.png`, combined);

  const fileName = `${uuidv4()}.png`;
  const publicUrl = await uploadToR2(`sigor-sparrows/${fileName}`, combined);
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
