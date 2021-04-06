# Tuning the Database

Optimizing your Postgres Database is a great way to improve the performance of queries. The following is an example configuration for a 64GB RAM instance with 32 vCPUS.

```sql
ALTER SYSTEM SET max_connections = '1000';
ALTER SYSTEM SET shared_buffers = '16GB';
ALTER SYSTEM SET effective_cache_size = '48GB';
ALTER SYSTEM SET maintenance_work_mem = '2GB';
ALTER SYSTEM SET checkpoint_completion_target = '0.9';
ALTER SYSTEM SET wal_buffers = '1GB';
ALTER SYSTEM SET default_statistics_target = '100';
ALTER SYSTEM SET random_page_cost = '2.0';
ALTER SYSTEM SET effective_io_concurrency = '200';
ALTER SYSTEM SET work_mem = '8GB';
ALTER SYSTEM SET min_wal_size = '2GB';
ALTER SYSTEM SET max_wal_size = '8GB';
ALTER SYSTEM SET max_worker_processes = '30';
ALTER SYSTEM SET max_parallel_workers_per_gather = '4';
ALTER SYSTEM SET max_parallel_workers = '30';
ALTER SYSTEM SET max_parallel_maintenance_workers = '4';
ALTER SYSTEM SET autovacuum_vacuum_scale_factor = '0.1';
ALTER SYSTEM SET autovacuum_max_workers = '4';

--- Do a non intrusive reload after altering system settings

SELECT pg_reload_conf();
```

### RAM Considerations

The RAM usage should be ratioed 1/4 for `shared_buffers` and 3/4 for `effective_cache_size`.

```sql
ALTER SYSTEM SET shared_buffers = '...';                    --- 1/4 total RAM
ALTER SYSTEM SET effective_cache_size = '...';              --- 3/4 total RAM
```

`work_mem` and `wal_buffers` should be larger than default, given the amount of inserts happening concurrently on the database. A few GBs for each is enough.

```sql
ALTER SYSTEM SET wal_buffers = '1GB';                       --- Ideally over 512mb
ALTER SYSTEM SET work_mem = '8GB';                          --- Ideally over 2GB
```

### Thread parallelization

If you're running the Postgres server with the Express server. Make sure to keep a thread or two available.

```sql
ALTER SYSTEM SET max_worker_processes = '30';               --- For a 32 vCPU server 
ALTER SYSTEM SET max_parallel_workers_per_gather = '4';     --- Can reduce for less cores
ALTER SYSTEM SET max_parallel_workers = '30';               --- For a 32 vCPU server
ALTER SYSTEM SET max_parallel_maintenance_workers = '4';    --- Can reduce for less cores
```





