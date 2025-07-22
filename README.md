# matedevdao-api

```
wrangler d1 execute matedevdao -y --local --file=./schema/nfts.sql
wrangler d1 execute matedevdao -y --local --file=./schema/contract_event_sync_status.sql

wrangler d1 execute matedevdao -y --local --file=./schema/profiles.sql
```

```
cd utils
node --loader ts-node/esm ./collect-bmcs-uris.ts
cd ..
```
