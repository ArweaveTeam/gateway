export const resolveManifestPathId = (
  { index, paths }: PathManifest,
  relativePathToResolve: string
): string | undefined => {
  if (relativePathToResolve && paths[relativePathToResolve]) {
    return paths[relativePathToResolve]?.id;
  }
};

export const resolveManifestIndex = (
  { index, paths }: PathManifest,
  relativePathToResolve: string
): string | undefined => {
  const indexPath = index?.path;
  if (indexPath) {
    return paths[indexPath]?.id;
  }
};

export interface PathManifest {
  manifest: "arweave/paths";
  version: string;
  paths: {
    [key: string]: {
      id: string;
    };
  };
  index?: {
    path: string;
  };
}
