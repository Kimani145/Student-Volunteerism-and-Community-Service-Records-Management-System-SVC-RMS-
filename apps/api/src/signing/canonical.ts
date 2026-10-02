export function canonicalizeJson(obj: any): string {
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalizeJson).join(',') + ']';
  }
  if (obj && typeof obj === 'object') {
    const keys = Object.keys(obj).sort();
    return (
      '{' +
      keys
        .filter((k) => obj[k] !== undefined)
        .map((k) => JSON.stringify(k) + ':' + canonicalizeJson(obj[k]))
        .join(',') +
      '}'
    );
  }
  return JSON.stringify(obj);
}
