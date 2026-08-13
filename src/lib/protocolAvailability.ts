export function hasSealedProtocol(
  value: { pdfPath: string } | null | undefined,
): boolean {
  return Boolean(value?.pdfPath.trim());
}
