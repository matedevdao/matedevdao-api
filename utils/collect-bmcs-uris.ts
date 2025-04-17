import fs from "fs";
import { createPublicClient, http, webSocket } from "viem";
import { kaia } from "viem/chains";
import BiasArtifact from "./artifacts/Bias.json" with { type: "json" };
import deepseaMetadatas from "./bmcs-metadatas-legacy/metadata-deepsea-legacy.json" with {
  type: "json",
};
import poisonMetadatas from "./bmcs-metadatas-legacy/metadata-poison-legacy.json" with {
  type: "json",
};
import rubyMetadatas from "./bmcs-metadatas-legacy/metadata-ruby-legacy.json" with {
  type: "json",
};
import sapphireMetadatas from "./bmcs-metadatas-legacy/metadata-sapphire-legacy.json" with {
  type: "json",
};

const kaiaPublicClient = createPublicClient({ chain: kaia, transport: http() });

for (let i = 19175; i < 20000; i++) {
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

  let uri: string;

  try {
    uri = await kaiaPublicClient.readContract({
      address: "0xDeDd727ab86bce5D416F9163B2448860BbDE86d4",
      abi: BiasArtifact.abi,
      functionName: "tokenURI",
      args: [i],
    }) as string;
  } catch (error) {
    console.error(`Error fetching token URI for ID ${i}:`, error);

    try {
      uri = await kaiaPublicClient.readContract({
        address: "0xDeDd727ab86bce5D416F9163B2448860BbDE86d4",
        abi: BiasArtifact.abi,
        functionName: "tokenURI",
        args: [i],
      }) as string;
    } catch (error) {
      console.error(`Error fetching token URI for ID ${i}:`, error);

      uri = await kaiaPublicClient.readContract({
        address: "0xDeDd727ab86bce5D416F9163B2448860BbDE86d4",
        abi: BiasArtifact.abi,
        functionName: "tokenURI",
        args: [i],
      }) as string;
    }
  }

  const base64 = uri.split(",")[1];
  const jsonString = atob(base64);
  const json = JSON.parse(jsonString);

  delete json.image;

  if (i >= 10000) {
    let metadatas: any[] = [
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

    if (
      i === 11443 || i === 12425 || i === 13051 || i === 14324 || i === 14422 ||
      i === 17303
    ) {
      metadatas = [
        metadatas.find((metadata: any) => metadata.type === "sapphire"),
      ];
    }

    if (
      i === 12470 || i === 12661 || i === 15123 || i === 16007 || i === 16229 ||
      i === 16753 || i === 16759 || i === 18909 || i === 19061 || i === 19175
    ) {
      metadatas = [
        metadatas.find((metadata: any) => metadata.type === "ruby"),
      ];
    }

    if (metadatas.length > 1) {
      console.log(
        `Token ID ${i} has multiple metadata. ${
          JSON.stringify(json, null, 2)
        }, ${JSON.stringify(metadatas, null, 2)}`,
      );
      throw new Error(`Token ID ${i} has multiple metadata.`);
    }

    json.type = metadatas[0].type;
  }

  fs.writeFileSync(
    `bmcs-metadatas/${i}.json`,
    JSON.stringify(json, null, 2),
  );

  console.log(`Token ID ${i} processed successfully.`);
}

console.log("All token URIs have been processed.");
