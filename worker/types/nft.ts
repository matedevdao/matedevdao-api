type NFTData = {
  collection: string;
  id: number;
  name: string;
  description: string;
  image: string;
  external_url: string;
  animation_url?: string;
  traits?: { [traitName: string]: string | number };
  parts: { [partName: string]: string | number };
  holder: string;
};

export type { NFTData };
