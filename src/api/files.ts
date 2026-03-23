// file: src/api/files.ts
// Storage Files API — prepare upload, upload blob, get file detail.
// Used by: DescriptionEditor (image paste upload).
// Upload flow: prepare → upload to cloud (S3/Azure/GCS) → get signed URL for rendering.
// Provider-specific upload params: uploadParams (AWS), absUploadParams (Azure), gcsUploadParams (GCP).

import { z } from 'zod';
import { fetchApi } from '@/api/client';
import { FILE_UPLOAD_TAGS } from '@/config/markdown';

// -- Schemas (flexible — each provider returns different upload param keys) --

const fileUploadPrepareSchema = z
  .object({
    id: z.number(),
    url: z.string(),
    name: z.string(),
    provider: z.string(),
    region: z.string().optional(),
    // AWS: uploadParams
    uploadParams: z.record(z.string(), z.unknown()).optional(),
    // Azure: absUploadParams
    absUploadParams: z.record(z.string(), z.unknown()).optional(),
    // GCP: gcsUploadParams
    gcsUploadParams: z.record(z.string(), z.unknown()).optional(),
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
  // federationToken=1 ensures the response includes a signed download URL
  // that works in the browser without additional auth headers
  return fetchApi(`/files/${fileId}?federationToken=1`, fileDetailSchema);
}

// -- Upload to cloud storage (provider-specific) --

export async function uploadFileBlob(
  prepareResult: FileUploadPrepareResult,
  blob: Blob,
  fileName: string,
): Promise<void> {
  const { provider } = prepareResult;

  switch (provider) {
    case 'aws':
      await uploadToS3(prepareResult, blob, fileName);
      break;
    case 'azure':
      await uploadToAzure(prepareResult, blob, fileName);
      break;
    case 'gcp':
      await uploadToGcs(prepareResult, blob);
      break;
    default:
      throw new Error(`Unsupported file provider: ${provider}`);
  }
}

// -- AWS S3 upload using federation token credentials --

async function uploadToS3(
  prepareResult: FileUploadPrepareResult,
  blob: Blob,
  fileName: string,
): Promise<void> {
  const params = prepareResult.uploadParams as Record<string, unknown>;
  if (!params) throw new Error('Missing uploadParams for S3 upload');

  const bucket = params.bucket as string;
  const key = params.key as string;
  const acl = (params.acl as string) ?? 'private';
  const credentials = params.credentials as Record<string, string> | undefined;
  if (!credentials?.SessionToken || !credentials?.AccessKeyId) {
    throw new Error('Missing S3 credentials (SessionToken/AccessKeyId)');
  }

  // S3 form-based POST upload (works from browser without AWS SDK)
  const formData = new FormData();
  formData.append('key', key);
  formData.append('acl', acl);
  formData.append('Content-Type', blob.type || 'application/octet-stream');
  formData.append('x-amz-security-token', credentials.SessionToken);
  formData.append('x-amz-credential', credentials.AccessKeyId);
  formData.append('file', blob, fileName);

  const s3Url = `https://${bucket}.s3.amazonaws.com/`;

  const response = await fetch(s3Url, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok && response.status !== 204) {
    const text = await response.text().catch(() => '');
    throw new Error(`S3 upload failed (${response.status}): ${text}`);
  }
}

// -- Azure Blob Storage upload using SAS connection string --

async function uploadToAzure(
  prepareResult: FileUploadPrepareResult,
  blob: Blob,
  fileName: string,
): Promise<void> {
  const params = prepareResult.absUploadParams as Record<string, unknown>;
  if (!params) throw new Error('Missing absUploadParams for Azure upload');

  const container = params.container as string;
  const blobName = params.blobName as string;
  const absCredentials = params.absCredentials as Record<string, string>;
  const sasConnectionString = absCredentials?.SASConnectionString;

  if (!sasConnectionString) throw new Error('Missing SASConnectionString for Azure upload');

  // Parse the SAS connection string to get the blob endpoint and SAS token
  const blobEndpointMatch = sasConnectionString.match(/BlobEndpoint=([^;]+)/);
  const sasTokenMatch = sasConnectionString.match(/SharedAccessSignature=(.+)$/);

  if (!blobEndpointMatch || !sasTokenMatch) {
    throw new Error('Cannot parse Azure SAS connection string');
  }

  const blobEndpoint = blobEndpointMatch[1];
  const sasToken = sasTokenMatch[1];

  const uploadUrl = `${blobEndpoint}/${container}/${blobName}?${sasToken}`;

  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': blob.type || 'application/octet-stream',
      'x-ms-blob-type': 'BlockBlob',
      'Content-Disposition': `attachment; filename=${fileName}`,
    },
    body: blob,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Azure upload failed (${response.status}): ${text}`);
  }
}

// -- Google Cloud Storage upload using OAuth2 access token --

async function uploadToGcs(
  prepareResult: FileUploadPrepareResult,
  blob: Blob,
): Promise<void> {
  const params = prepareResult.gcsUploadParams as Record<string, unknown>;
  if (!params) throw new Error('Missing gcsUploadParams for GCS upload');

  const bucket = params.bucket as string;
  const key = params.key as string;
  const accessToken = params.access_token as string;

  if (!accessToken) throw new Error('Missing access_token for GCS upload');

  // GCS JSON API upload
  const gcsUrl = `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucket)}/o?uploadType=media&name=${encodeURIComponent(key)}`;

  const response = await fetch(gcsUrl, {
    method: 'POST',
    headers: {
      'Content-Type': blob.type || 'application/octet-stream',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: blob,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`GCS upload failed (${response.status}): ${text}`);
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
