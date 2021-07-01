CREATE TABLE manifest (
    "manifest_url" varchar(64),
    "manifest_id" varchar(64),
    "tx_id" varchar(64),
    "path" text,

    PRIMARY KEY("manifest_id", "tx_id")
);