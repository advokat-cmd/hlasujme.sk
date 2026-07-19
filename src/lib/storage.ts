import path from "node:path";

export function getStorageRoot(): string {
  const configured = process.env.STORAGE_ROOT;
  if (process.env.NODE_ENV === "production" && (!configured || !path.isAbsolute(configured))) {
    throw new Error("STORAGE_ROOT musí byť v produkcii absolútna cesta.");
  }
  return path.resolve(
    /*turbopackIgnore: true*/ configured || path.join(process.cwd(), "storage"),
  );
}

export function resolveStoragePath(relativePath: string): string {
  if (typeof relativePath !== "string" || !relativePath.trim()) throw new Error("Neplatná cesta úložiska.");
  const root = getStorageRoot();
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/?storage\//, "").replace(/^\/+/, "");
  const resolved = path.resolve(root, normalized);
  const relation = path.relative(root, resolved);
  if (!relation || relation === "." || relation.startsWith("..") || path.isAbsolute(relation)) {
    throw new Error("Cesta smeruje mimo povoleného úložiska.");
  }
  return resolved;
}

export function storageRelativePath(absolutePath: string): string {
  const root = getStorageRoot();
  const relation = path.relative(root, path.resolve(absolutePath));
  if (!relation || relation.startsWith("..") || path.isAbsolute(relation)) {
    throw new Error("Cesta smeruje mimo povoleného úložiska.");
  }
  return relation.replace(/\\/g, "/");
}
