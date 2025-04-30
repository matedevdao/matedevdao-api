import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import "dotenv/config";

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
  },
});

async function deleteFolder(bucketName: string, folderPrefix: string) {
  let ContinuationToken;

  do {
    const listResponse = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: folderPrefix,
        ContinuationToken,
      }),
    ) as any;

    console.log(listResponse.Contents.length);

    if (listResponse.Contents.length > 0) {
      const deleteCommand = new DeleteObjectsCommand({
        Bucket: bucketName,
        Delete: {
          Objects: listResponse.Contents.map((object: any) => ({
            Key: object.Key,
          })),
        },
      });
      await s3.send(deleteCommand);
    }

    ContinuationToken = listResponse.IsTruncated
      ? listResponse.NextContinuationToken
      : undefined;
  } while (ContinuationToken);
}

await deleteFolder(process.env.R2_BUCKET_NAME!, "sigor-sparrows/");
