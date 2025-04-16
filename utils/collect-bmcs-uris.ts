import fs from "fs";
import { createPublicClient, http } from "viem";
import { kaia } from "viem/chains";
import BiasArtifact from "./artifacts/Bias.json" with { type: "json" };
import deepseaMetadatas from "./bmcs-metadatas/metadata-deepsea-legacy.json" with {
  type: "json",
};
import poisonMetadatas from "./bmcs-metadatas/metadata-poison-legacy.json" with {
  type: "json",
};
import rubyMetadatas from "./bmcs-metadatas/metadata-ruby-legacy.json" with {
  type: "json",
};
import sapphireMetadatas from "./bmcs-metadatas/metadata-sapphire-legacy.json" with {
  type: "json",
};

const kaiaPublicClient = createPublicClient({ chain: kaia, transport: http() });
const result: any[] = [];

for (let i = 0; i < 20000; i++) {
  console.log(`Token ID ${i} is being processed...`);

  const exists = await kaiaPublicClient.readContract({
    address: "0xDeDd727ab86bce5D416F9163B2448860BbDE86d4",
    abi: BiasArtifact.abi,
    functionName: "exists",
    args: [i],
  }) as boolean;

  if (!exists) {
    console.log(`Token ID ${i} does not exist.`);
    continue;
  }

  const uri = await kaiaPublicClient.readContract({
    address: "0xDeDd727ab86bce5D416F9163B2448860BbDE86d4",
    abi: BiasArtifact.abi,
    functionName: "tokenURI",
    args: [i],
  }) as string;

  const base64 = uri.split(",")[1];
  const jsonString = atob(base64);
  const json = JSON.parse(jsonString);

  delete json.image;

  if (i >= 10000) {
    const metadatas: any[] = [
      ["deepsea", deepseaMetadatas],
      ["poison", poisonMetadatas],
      ["ruby", rubyMetadatas],
      ["sapphire", sapphireMetadatas],
    ].map(
      ([metadataType, metadatas]) => {
        const metadata = (metadatas as any).find((metadata: any) =>
          metadata.name === json.name
        );
        if (metadata) return { ...metadata, type: metadataType };
        return null;
      },
    ).filter(Boolean);

    if (metadatas.length > 1) {
      throw new Error(`Token ID ${i} has multiple metadata.`);
    }

    json.type = metadatas[0].type;
  }

  result[i] = json;
  console.log(`Token ID ${i} has metadata.`);
}

fs.writeFileSync(
  "bmcs-metadatas.json",
  JSON.stringify(result, null, 2),
);

console.log(`bmcs-metadatas.json generated.`);
