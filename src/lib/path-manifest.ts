export const resolveTx = (
  { index, paths }: PathManifest,
  path: string | undefined
): string | undefined => {
  if (path && paths[path]) {
    const id = paths[path].id;
    return id;
  }

  if (index && index.path) {
    const id = paths[index.path].id;
    return id;
  }

  throw new Error("not_found");
};

const validateId = (id: string): boolean => {
  return !!id.match(/a-zA-Z0-9-_{43}/i);
};

interface PathManifest {
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
