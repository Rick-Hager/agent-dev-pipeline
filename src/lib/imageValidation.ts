export const MAX_IMAGES_PER_ITEM = 5;
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

type ValidationOk = { valid: true };
type ValidationErr = { valid: false; error: string };
export type ValidationResult = ValidationOk | ValidationErr;

export function validateImageUpload(file: {
  type: string;
  size: number;
}): ValidationResult {
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return {
      valid: false,
      error: "Unsupported image type. Allowed: jpg, png, webp",
    };
  }
  if (file.size <= 0) {
    return { valid: false, error: "File is empty" };
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return { valid: false, error: "File size exceeds 5MB limit" };
  }
  return { valid: true };
}

export function canAddImage(currentCount: number): ValidationResult {
  if (currentCount >= MAX_IMAGES_PER_ITEM) {
    return {
      valid: false,
      error: `Maximum of ${MAX_IMAGES_PER_ITEM} images per item reached`,
    };
  }
  return { valid: true };
}

export function validateReorderIds(
  ids: unknown,
  existing: string[]
): ValidationResult {
  if (!Array.isArray(ids)) {
    return { valid: false, error: "ids must be an array" };
  }
  if (ids.length !== existing.length) {
    return { valid: false, error: "ids length does not match existing images" };
  }
  const unique = new Set(ids);
  if (unique.size !== ids.length) {
    return { valid: false, error: "ids contain duplicates" };
  }
  const existingSet = new Set(existing);
  for (const id of ids) {
    if (typeof id !== "string" || !existingSet.has(id)) {
      return { valid: false, error: "ids contain unknown image id" };
    }
  }
  return { valid: true };
}
