import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import 'dotenv/config';

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
  },
});

async function count(bucketName: string, folderPrefix: string) {
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

    ContinuationToken = listResponse.IsTruncated
      ? listResponse.NextContinuationToken
      : undefined;
  } while (ContinuationToken);
}

await count(process.env.R2_BUCKET_NAME!, 'babyping/');
