import { createPublicClient, http } from "viem";
import { kaia } from "viem/chains";

class KaiaClientManager {
  private client = createPublicClient({ chain: kaia, transport: http() });

  public getClient() {
    return this.client;
  }
}

export default new KaiaClientManager();
