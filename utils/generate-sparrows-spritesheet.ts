import fs from "fs";
import path from "path";
import sharp, { Metadata } from "sharp";
import parts from "../assets/sigor-sparrows/parts.json" with {
  type: "json",
};

interface SpritesheetData {
  frames: {
    [frame: string]: {
      frame: {
        x: number;
        y: number;
        w: number;
        h: number;
      };
    };
  };
  meta: {
    scale: number | string;
  };
}

const availableFiles: { [path: string]: boolean } = {};
for (const p of parts) {
  for (const part of p.parts) {
    if (part.images) {
      for (const frame of part.images) {
        availableFiles["normal/" + frame.path] = true;
        availableFiles["pixel/" + frame.path] = true;
      }
    }
  }
}

const directoryPath = "../assets/sigor-sparrows/parts-images-resized";
const outputPath = "../assets/sigor-sparrows/spritesheet";
const spritesheets: string[] = [];

const keyToPart: { [filename: string]: { row: number; col: number } } = {};
const keyToFrame: { [type: string]: { [filename: string]: string } } = {};

const partSize = 128;

async function createSpritesheetImage(
  files: string[],
  outputFileName: string,
  format = "png",
) {
  const tilesPerRow = Math.ceil(Math.sqrt(files.length));
  const outputWidth = partSize * tilesPerRow;
  const outputHeight = partSize * Math.ceil(files.length / tilesPerRow);

  const background = sharp({
    create: {
      width: outputWidth,
      height: outputHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  });

  const compositeOperations = files.map((file, index) => {
    const row = Math.floor(index / tilesPerRow);
    const col = index % tilesPerRow;
    const fileId = file.split("/").slice(1).join("/");

    keyToPart[fileId] = { row, col };
    return {
      input: file,
      top: row * partSize,
      left: col * partSize,
    };
  });

  if (format === "jpeg") {
    await background.composite(compositeOperations).jpeg({ quality: 60 })
      .toFile(path.join(outputPath, outputFileName));
  } else {
    await background
      .composite(compositeOperations)
      .toFile(path.join(outputPath, outputFileName));
  }

  console.log(`Created ${outputFileName}`);
}

async function processImages() {
  const metadataMap = new Map<string, Metadata>();

  try {
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }

    const files = fs.readdirSync(directoryPath, { recursive: true });
    for (const file of files) {
      if (typeof file === "string") {
        if (availableFiles[file]) {
          const sharpImage = sharp(path.join(directoryPath, file));
          const metadata = await sharpImage.metadata();
          metadataMap.set(file, metadata);
          spritesheets.push(path.join(directoryPath, file));
        } else {
          console.log(`Skipping ${file}`);
        }
      }
    }

    console.log("Spritesheet images:", spritesheets.length);

    await createSpritesheetImage(
      spritesheets,
      "spritesheet.png",
    );

    const spritesheetAtlas: SpritesheetData = {
      frames: {},
      meta: {
        scale: 1,
      },
    };

    let partIndex = 0;

    for (const [key, part] of Object.entries(keyToPart)) {
      const frameId = `part-${partIndex++}`;

      spritesheetAtlas.frames[frameId] = {
        frame: {
          x: part.col * partSize,
          y: part.row * partSize,
          w: partSize,
          h: partSize,
        },
      };

      let style = key.split("/").slice(3)[0];
      if (style === "normal") {
        style = "Illustration";
      } else if (style === "pixel") {
        style = "Pixel Art";
      }

      if (!keyToFrame[style]) {
        keyToFrame[style] = {};
      }

      keyToFrame[style][key.split("/").slice(4).join("/")] = frameId;
    }

    fs.writeFileSync(
      path.join(outputPath, "spritesheet.json"),
      JSON.stringify(spritesheetAtlas, null, 2),
    );

    fs.writeFileSync(
      path.join(outputPath, "key-to-frame.json"),
      JSON.stringify(keyToFrame, null, 2),
    );

    console.log("All files have been processed and saved.");
  } catch (err) {
    console.error("An error occurred:", err);
  }
}

await processImages();
