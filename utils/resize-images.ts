import fs from "fs";
import path from "path";
import sharp from "sharp";
import parts from "../assets/sigor-sparrows/parts.json" with {
  type: "json"
};

const availableFiles: { [path: string]: boolean } = {};
for (const p of parts) {
  for (const part of p.parts) {
    if (part.images) {
      for (const frame of part.images) {
        availableFiles[frame.path] = true;
      }
    }
  }
}

const directoryPath = "../assets/shigor-sparrows/parts-images/pixel";
const outputPath = "../assets/shigor-sparrows/parts-images-resized/pixel";

const partSize = 128;

async function processImages() {
  try {
    const files = fs.readdirSync(directoryPath, { recursive: true });
    for (const file of files) {
      if (typeof file === "string") {
        if (availableFiles[file]) {
          const sharpImage = sharp(path.join(directoryPath, file));

          if (!fs.existsSync(path.join(outputPath, path.dirname(file)))) {
            fs.mkdirSync(path.join(outputPath, path.dirname(file)), {
              recursive: true,
            });
          }

          await sharpImage.resize(partSize, partSize, {
            fit: "contain",
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          }).toFile(path.join(outputPath, file));

          console.log(`Processed ${file}`);
        } else {
          console.log(`Skipping ${file}`);
        }
      }
    }

    console.log("All files have been processed and saved.");
  } catch (err) {
    console.error("An error occurred:", err);
  }
}

await processImages();
