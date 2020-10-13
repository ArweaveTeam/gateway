import createHttpError from "http-errors";

export const resolveManifestPathId = (
  manifest: PathManifest,
  relativePathToResolve?: string
): string => {
  if (relativePathToResolve) {
    if (manifest.paths[relativePathToResolve]) {
      return manifest.paths[relativePathToResolve].id;
    }

    throw createHttpError(404);
  }

  return resolveManifestIndex(manifest);
};

export const resolveManifestIndex = ({
  index,
  paths,
}: PathManifest): string => {
  if (index && index.path) {
    if (paths[index.path]) {
      return paths[index.path].id;
    }
  }

  throw createHttpError(400);
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
