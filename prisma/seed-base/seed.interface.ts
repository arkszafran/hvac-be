export interface ISeedResult {
    success: boolean;
    error?: string;
}

export interface ISeed {
    id: string;
    date: Date;
    path: string;
}
