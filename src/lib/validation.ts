type PriceValidationSuccess = { valid: true };
type PriceValidationFailure = { valid: false; error: string };

export function validatePriceInCents(
  value: unknown
): PriceValidationSuccess | PriceValidationFailure {
  if (value === null || value === undefined) {
    return { valid: false, error: "priceInCents is required" };
  }
  if (typeof value !== "number") {
    return { valid: false, error: "priceInCents must be a number" };
  }
  if (!Number.isInteger(value)) {
    return { valid: false, error: "priceInCents must be an integer" };
  }
  if (value <= 0) {
    return { valid: false, error: "priceInCents must be a positive integer" };
  }
  return { valid: true };
}

type RestaurantInputData = {
  name: string;
  slug: string;
  email: string;
  password: string;
};

type ValidationSuccess = {
  valid: true;
  data: RestaurantInputData;
};

type ValidationFailure = {
  valid: false;
  error: string;
};

type ValidationResult = ValidationSuccess | ValidationFailure;

export function validateRestaurantInput(body: unknown): ValidationResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { valid: false, error: "Request body must be a JSON object" };
  }

  const record = body as Record<string, unknown>;
  const requiredFields: (keyof RestaurantInputData)[] = [
    "name",
    "slug",
    "email",
    "password",
  ];

  for (const field of requiredFields) {
    const value = record[field];
    if (typeof value !== "string" || value.trim() === "") {
      return {
        valid: false,
        error: `Field "${field}" is required and must be a non-empty string`,
      };
    }
  }

  return {
    valid: true,
    data: {
      name: (record.name as string).trim(),
      slug: (record.slug as string).trim(),
      email: (record.email as string).trim(),
      password: record.password as string,
    },
  };
}
