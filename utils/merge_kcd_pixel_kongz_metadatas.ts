import fs from "fs";

const count = 10000;
let allMetadatas: string = "[";
for (let id = 1; id <= count; id += 1) {
  const metadata = JSON.parse(
    fs.readFileSync(`kcd_pixel_kongz_metadatas/${id}.json`).toString(),
  );
  metadata.id = id;
  allMetadatas += JSON.stringify(metadata) + ",";
  console.log(`#${id} generated.`);
}

allMetadatas = allMetadatas.slice(0, -1) + "]";
fs.writeFileSync(`kcd_pixel_kongz_metadatas.json`, allMetadatas);

console.log(`kcd_pixel_kongz_metadatas.json generated.`);
