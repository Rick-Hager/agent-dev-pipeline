import { put, del } from "@vercel/blob";

export interface UploadedBlob {
  url: string;
  pathname: string;
}

export async function uploadMenuItemImage(
  filename: string,
  body: Blob | ArrayBuffer | Buffer,
  options?: { contentType?: string }
): Promise<UploadedBlob> {
  const result = await put(filename, body as Blob, {
    access: "public",
    contentType: options?.contentType,
    addRandomSuffix: true,
  });
  return { url: result.url, pathname: result.pathname };
}

export async function deleteMenuItemImage(url: string): Promise<void> {
  await del(url);
}
