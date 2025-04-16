import { createPublicClient, http } from "viem";
import { kaia } from "viem/chains";
import BiasArtifact from "./artifacts/Bias.json" with { type: "json" };

const kaiaPublicClient = createPublicClient({ chain: kaia, transport: http() });

const uri = await kaiaPublicClient.readContract({
  address: "0xDeDd727ab86bce5D416F9163B2448860BbDE86d4",
  abi: BiasArtifact.abi,
  functionName: "tokenURI",
  args: [0],
}) as string;

console.log(uri);
