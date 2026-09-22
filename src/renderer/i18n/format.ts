/** Supports both existing placeholder forms without regex/replacement-string injection. */
export function interpolate(text: string, params: Record<string, unknown> = {}): string {
  return text.replace(/\{\{([^{}]+)\}\}|\{([^{}]+)\}/g, (token, doubleKey, singleKey) => {
    const key = doubleKey || singleKey;
    return Object.prototype.hasOwnProperty.call(params, key) ? String(params[key] ?? '') : token;
  });
}
