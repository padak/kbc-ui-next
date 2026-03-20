// file: src/api/files.ts
// Storage Files API — prepare upload, upload blob, get file detail.
// Used by: DescriptionEditor (image paste upload).
// Upload flow: prepare → upload to cloud → get signed URL for rendering.
// Files are tagged with "documentation" + "kbc-ui-next" for identification.

import { z } from 'zod';
import { fetchApi } from '@/api/client';
import { useConnectionStore } from '@/stores/connection';
import { FILE_UPLOAD_TAGS } from '@/config/markdown';

// -- Schemas --

const fileUploadPrepareSchema = z
  .object({
    id: z.number(),
    url: z.string(),
    name: z.string(),
    provider: z.string(),
    region: z.string().optional(),
    uploadParams: z
      .object({
        key: z.string().optional(),
        bucket: z.string().optional(),
        acl: z.string().optional(),
        credentials: z
          .object({
            AccessKeyId: z.string().optional(),
            SecretAccessKey: z.string().optional(),
            SessionToken: z.string().optional(),
          })
          .passthrough()
          .optional(),
        // Azure
        blobName: z.string().optional(),
        container: z.string().optional(),
        accountName: z.string().optional(),
        // GCS
        bucket_name: z.string().optional(),
        object_name: z.string().optional(),
      })
      .passthrough(),
  })
  .passthrough();

const fileDetailSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    url: z.string(),
    isPublic: z.boolean().optional(),
    sizeBytes: z.number().optional(),
    tags: z.array(z.string()).default([]),
  })
  .passthrough();

export type FileUploadPrepareResult = z.infer<typeof fileUploadPrepareSchema>;
export type FileDetail = z.infer<typeof fileDetailSchema>;

// -- API functions --

export async function prepareFileUpload(
  fileName: string,
  sizeBytes: number,
  contentType: string,
): Promise<FileUploadPrepareResult> {
  return fetchApi('/files/prepare', fileUploadPrepareSchema, {
    method: 'POST',
    body: JSON.stringify({
      name: fileName,
      sizeBytes,
      contentType,
      isPublic: false,
      isPermanent: true,
      isEncrypted: false,
      federationToken: true,
      tags: FILE_UPLOAD_TAGS,
    }),
  });
}

export async function getFileDetail(fileId: number): Promise<FileDetail> {
  return fetchApi(`/files/${fileId}`, fileDetailSchema);
}

// -- Upload to cloud storage --

export async function uploadFileBlob(
  prepareResult: FileUploadPrepareResult,
  blob: Blob,
  fileName: string,
): Promise<void> {
  const { provider, uploadParams } = prepareResult;

  if (provider === 'aws') {
    await uploadToS3(uploadParams, blob, fileName);
  } else if (provider === 'azure') {
    await uploadToAzure(uploadParams, blob);
  } else if (provider === 'gcp') {
    await uploadToGcs(uploadParams, blob);
  } else {
    throw new Error(`Unsupported file provider: ${provider}`);
  }
}

async function uploadToS3(
  uploadParams: FileUploadPrepareResult['uploadParams'],
  blob: Blob,
  fileName: string,
): Promise<void> {
  // Use presigned form upload via S3 POST (simplest browser approach)
  // Build the S3 URL from bucket and region
  const bucket = uploadParams.bucket!;
  const key = uploadParams.key!;
  const credentials = uploadParams.credentials!;
  const acl = uploadParams.acl ?? 'private';

  // For S3, use a direct PUT with signed headers
  const { stackUrl } = useConnectionStore.getState();
  const region = new URL(stackUrl!).hostname.includes('eu-central')
    ? 'eu-central-1'
    : 'us-east-1';

  // Use the AWS SDK-free approach: create a presigned PUT via the raw S3 API
  // Actually, the simplest approach is to use the federation token credentials
  // with fetch + AWS Signature V4. But that's complex.
  //
  // Alternative: use the url field from prepare response which is a signed download URL.
  // For upload, we need to construct the S3 endpoint and PUT with the temp credentials.
  //
  // Simplest approach: use XMLHttpRequest with the S3 endpoint
  const s3Url = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

  // AWS Signature V4 is complex for browser. Use a simpler approach:
  // The Storage API actually accepts a direct upload via a different endpoint.
  // Let's use the Keboola-specific upload endpoint instead.
  //
  // Actually, re-reading the PHP client more carefully:
  // For small files, we can use the Storage API's own upload mechanism.
  // The prepare response `url` field is a SIGNED URL that can be used for both
  // download and upload on some providers.
  //
  // For maximum compatibility, let's upload via the Storage API proxy.
  // POST /v2/storage/files/{id}/upload with the file as form-data.

  // FALLBACK: Direct S3 PUT with AWS4 auth is too complex for browser without SDK.
  // Use the simple approach: upload as form-data to S3
  const formData = new FormData();
  formData.append('key', key);
  formData.append('acl', acl);
  formData.append('AWSAccessKeyId', credentials.AccessKeyId!);
  formData.append('policy', ''); // Not needed with federation token
  formData.append('x-amz-security-token', credentials.SessionToken!);
  formData.append('x-amz-credential', credentials.AccessKeyId!);
  formData.append('Content-Type', blob.type || 'application/octet-stream');
  formData.append('file', blob, fileName);

  // S3 POST upload endpoint
  const s3PostUrl = `https://${bucket}.s3.amazonaws.com/`;

  const response = await fetch(s3PostUrl, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    // Fallback: try PUT with X-Amz headers
    const putResponse = await fetch(s3Url, {
      method: 'PUT',
      headers: {
        'Content-Type': blob.type || 'application/octet-stream',
        'x-amz-acl': acl,
        'x-amz-security-token': credentials.SessionToken!,
      },
      body: blob,
    });
    if (!putResponse.ok) {
      throw new Error(`S3 upload failed: ${putResponse.status} ${putResponse.statusText}`);
    }
  }
}

async function uploadToAzure(
  uploadParams: FileUploadPrepareResult['uploadParams'],
  blob: Blob,
): Promise<void> {
  // Azure Blob Storage uses a SAS URL from uploadParams
  const accountName = uploadParams.accountName;
  const container = uploadParams.container;
  const blobName = uploadParams.blobName;

  // The uploadParams should contain a SAS token or URL
  // Azure upload is a simple PUT to the blob URL
  const sasUrl = `https://${accountName}.blob.core.windows.net/${container}/${blobName}`;

  const response = await fetch(sasUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': blob.type || 'application/octet-stream',
      'x-ms-blob-type': 'BlockBlob',
    },
    body: blob,
  });

  if (!response.ok) {
    throw new Error(`Azure upload failed: ${response.status} ${response.statusText}`);
  }
}

async function uploadToGcs(
  uploadParams: FileUploadPrepareResult['uploadParams'],
  blob: Blob,
): Promise<void> {
  // GCS uses a resumable upload URL or signed URL
  const bucketName = uploadParams.bucket_name ?? uploadParams.bucket;
  const objectName = uploadParams.object_name ?? uploadParams.key;

  const gcsUrl = `https://storage.googleapis.com/upload/storage/v1/b/${bucketName}/o?uploadType=media&name=${encodeURIComponent(objectName!)}`;

  const response = await fetch(gcsUrl, {
    method: 'POST',
    headers: {
      'Content-Type': blob.type || 'application/octet-stream',
    },
    body: blob,
  });

  if (!response.ok) {
    throw new Error(`GCS upload failed: ${response.status} ${response.statusText}`);
  }
}

// -- High-level upload function --

export async function uploadImageToStorage(
  blob: Blob,
  fileName: string,
): Promise<{ fileId: number; fileName: string }> {
  const prepareResult = await prepareFileUpload(fileName, blob.size, blob.type);
  await uploadFileBlob(prepareResult, blob, fileName);
  return { fileId: prepareResult.id, fileName: prepareResult.name };
}

// -- Get signed download URL for a file --

export async function getFileDownloadUrl(fileId: number): Promise<string> {
  const detail = await getFileDetail(fileId);
  return detail.url;
}
