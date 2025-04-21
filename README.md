# matedevdao-api

```
wrangler d1 execute matedevdao -y --remote --file=./schema/nfts.sql
wrangler d1 execute matedevdao -y --remote --file=./schema/contract_event_sync_status.sql
```

```
cd utils
node --loader ts-node/esm ./collect-bmcs-uris.ts
cd ..
```