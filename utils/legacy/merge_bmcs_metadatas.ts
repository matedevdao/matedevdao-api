import fs from "fs";

let allMetadatas: string = "[";
let count = 0;

for (let id = 0; id < 20000; id += 1) {
  if (fs.existsSync(`bmcs-metadatas/${id}.json`) === false) {
    console.log(`#${id} not exists.`);
    continue;
  }

  const metadata = JSON.parse(
    fs.readFileSync(`bmcs-metadatas/${id}.json`).toString(),
  );
  metadata.id = id;
  allMetadatas += JSON.stringify(metadata) + ",";
  console.log(`#${id} generated.`);
  count += 1;
}

allMetadatas = allMetadatas.slice(0, -1) + "]";
fs.writeFileSync(`bmcs-metadatas.json`, allMetadatas);

console.log(`bmcs-metadatas.json generated.`);
console.log(`Total ${count} metadatas generated.`);
