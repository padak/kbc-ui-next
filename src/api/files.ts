// file: src/api/files.ts
// Storage Files API — upload file via import service, get file detail/download URL.
// Used by: DescriptionEditor (image paste upload), MarkdownViewer (signed URL resolution).
// Upload flow: single POST /upload-file to import service (server handles cloud storage).
// Download: GET /files/{id}?federationToken=1 returns signed URL.

import { z } from 'zod';
import { fetchApi, fetchImportApi } from '@/api/client';
import { FILE_UPLOAD_TAGS } from '@/config/markdown';

const uploadedFileSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    url: z.string(),
    isPublic: z.boolean().optional(),
    sizeBytes: z.number().optional(),
    tags: z.array(z.string()).default([]),
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

export type UploadedFile = z.infer<typeof uploadedFileSchema>;
export type FileDetail = z.infer<typeof fileDetailSchema>;

const uploadFile = async (
  file: File,
  options: { isPermanent?: boolean; tags?: string[] } = {},
  signal?: AbortSignal,
): Promise<UploadedFile> => {
  const formData = new FormData();
  formData.append('data', file);
  if (options.isPermanent) formData.append('isPermanent', '1');
  for (const tag of options.tags ?? []) formData.append('tags[]', tag);

  return fetchImportApi('/upload-file', uploadedFileSchema, formData, signal);
};

export const getFileDetail = async (fileId: number): Promise<FileDetail> =>
  fetchApi(`/files/${fileId}?federationToken=1`, fileDetailSchema);

export const getFileDownloadUrl = async (fileId: number): Promise<string> => {
  const detail = await getFileDetail(fileId);
  return detail.url;
};

export const uploadImageToStorage = async (
  file: File,
  signal?: AbortSignal,
): Promise<{ fileId: number; fileName: string }> => {
  const result = await uploadFile(file, { isPermanent: true, tags: FILE_UPLOAD_TAGS }, signal);
  return { fileId: result.id, fileName: result.name };
};
