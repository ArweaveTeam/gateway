declare namespace Express {
    export interface Request {
        id?: string;
        session: {
            node: string;
        };
    }
}
