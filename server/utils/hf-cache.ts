import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

/**
 * Resolve the HuggingFace CLI default cache directory.
 *
 * Resolution order:
 *   1. HUGGINGFACE_HUB_CACHE env var (direct path to cache)
 *   2. HF_HOME env var → $HF_HOME/hub/
 *   3. Default: ~/.cache/huggingface/hub/
 */
export function getHfCacheDir(): string {
  if (process.env.HUGGINGFACE_HUB_CACHE) {
    return process.env.HUGGINGFACE_HUB_CACHE;
  }
  if (process.env.HF_HOME) {
    return path.join(process.env.HF_HOME, 'hub');
  }
  return path.join(os.homedir(), '.cache', 'huggingface', 'hub');
}

/**
 * List all cached model directories in the HuggingFace cache.
 * Models are stored as: models--{org}--{name}/snapshots/{hash}/
 *
 * @returns Array of { name, org, fullName, snapshotPath } for each cached model.
 */
export function listCachedModels(cacheDir?: string): CachedModel[] {
  const dir = cacheDir ?? getHfCacheDir();
  if (!fs.existsSync(dir)) {
    return [];
  }

  const models: CachedModel[] = [];
  const entries = fs.readdirSync(dir);

  for (const entry of entries) {
    if (!entry.startsWith('models--')) continue;

    const parts = entry.replace('models--', '').split('--');
    if (parts.length < 2) continue;

    const org = parts[0];
    const name = parts.slice(1).join('--');
    const fullName = `${org}/${name}`;
    const snapshotsDir = path.join(dir, entry, 'snapshots');

    if (!fs.existsSync(snapshotsDir)) continue;

    const snapshots = fs.readdirSync(snapshotsDir);
    if (snapshots.length === 0) continue;

    // Use the most recently modified snapshot directory
    const latestSnapshot = snapshots
      .map((s) => ({
        name: s,
        mtime: fs.statSync(path.join(snapshotsDir, s)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime)[0].name;
    const snapshotPath = path.join(snapshotsDir, latestSnapshot);

    models.push({ name, org, fullName, snapshotPath });
  }

  return models;
}

/**
 * Find a cached model by name. Supports:
 *   - Full name: "org/model-name"
 *   - Short name: "model-name" (matches any org)
 *   - Partial match: "gemma3" matches "google/gemma-3-..."
 */
export function findCachedModel(
  modelName: string,
  cacheDir?: string,
): CachedModel | undefined {
  const models = listCachedModels(cacheDir);

  // Exact full name match
  const exactMatch = models.find(
    (m) => m.fullName.toLowerCase() === modelName.toLowerCase(),
  );
  if (exactMatch) return exactMatch;

  // Exact short name match
  const shortMatch = models.find(
    (m) => m.name.toLowerCase() === modelName.toLowerCase(),
  );
  if (shortMatch) return shortMatch;

  // Partial/fuzzy match — model name contains the search term
  const normalizedSearch = modelName.toLowerCase().replace(/[-_]/g, '');
  const partialMatch = models.find((m) => {
    const normalizedName = m.fullName.toLowerCase().replace(/[-_]/g, '');
    return normalizedName.includes(normalizedSearch);
  });
  if (partialMatch) return partialMatch;

  return undefined;
}

export interface CachedModel {
  name: string;
  org: string;
  fullName: string;
  snapshotPath: string;
}
