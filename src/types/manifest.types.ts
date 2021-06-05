export interface ManifestV1 {
    manifest: string;
    version: string;
    index: {
        path: string;
    };
    paths: any;
}
