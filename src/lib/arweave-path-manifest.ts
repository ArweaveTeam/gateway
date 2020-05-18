export const resolveManifestPath = (
  { index, paths }: PathManifest,
  subpath: string | undefined
): string | undefined => {
  if (subpath && paths[subpath]) {
    return paths[subpath] ? paths[subpath].id : undefined;
  }

  if (
    !subpath &&
    index &&
    index.path &&
    paths[index.path] &&
    paths[index.path].id
  ) {
    return paths[index.path].id;
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
