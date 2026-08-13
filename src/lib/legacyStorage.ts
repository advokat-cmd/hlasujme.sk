import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export interface LegacyRelocation {
  storedPath: string;
  normalizedPath: string;
  sourcePath: string;
  destinationPath: string;
}

function confined(root: string, relativePath: string): string {
  const absoluteRoot = path.resolve(root);
  const resolved = path.resolve(absoluteRoot, relativePath);
  const relation = path.relative(absoluteRoot, resolved);
  if (!relation || relation === "." || relation.startsWith("..") || path.isAbsolute(relation)) {
    throw new Error("Cesta smeruje mimo povoleného úložiska.");
  }
  return resolved;
}

export function planLegacyRelocation(storedPath: string, legacyRoot: string, storageRoot: string): LegacyRelocation | null {
  const unixPath = storedPath.replace(/\\/g, "/");
  if (!unixPath.startsWith("/storage/")) return null;
  const normalizedPath = unixPath.slice("/storage/".length);
  if (!normalizedPath) throw new Error("Neplatná cesta mimo povoleného úložiska.");
  return {
    storedPath,
    normalizedPath,
    sourcePath: confined(legacyRoot, normalizedPath),
    destinationPath: confined(storageRoot, normalizedPath),
  };
}

function hashFile(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

export function relocateLegacyFile(plan: LegacyRelocation, dryRun: boolean) {
  const sourceStat = statSync(plan.sourcePath);
  if (!sourceStat.isFile()) throw new Error(`Zdroj nie je súbor: ${plan.sourcePath}`);
  const sourceSha256 = hashFile(plan.sourcePath);
  if (dryRun) return { copied: false, sourceSha256, destinationSha256: sourceSha256 };

  if (existsSync(plan.destinationPath)) {
    const destinationStat = statSync(plan.destinationPath);
    const destinationSha256 = destinationStat.isFile() ? hashFile(plan.destinationPath) : "";
    if (sourceStat.size !== destinationStat.size || sourceSha256 !== destinationSha256) {
      throw new Error(`Cieľový súbor už existuje s iným obsahom: ${plan.destinationPath}`);
    }
    return { copied: false, sourceSha256, destinationSha256 };
  }

  mkdirSync(path.dirname(plan.destinationPath), { recursive: true });
  copyFileSync(plan.sourcePath, plan.destinationPath);
  const destinationStat = statSync(plan.destinationPath);
  const destinationSha256 = hashFile(plan.destinationPath);
  if (sourceStat.size !== destinationStat.size || sourceSha256 !== destinationSha256) {
    throw new Error(`Overenie skopírovaného súboru zlyhalo: ${plan.destinationPath}`);
  }
  return { copied: true, sourceSha256, destinationSha256 };
}
