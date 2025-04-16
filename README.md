# matedevdao-api

```
wrangler d1 execute matedevdao -y --remote --file=./schema/nft_holders.sql
wrangler d1 execute matedevdao -y --remote --file=./schema/parsed_contract_event_blocks.sql
```

```
cd utils
node --loader ts-node/esm ./collect-bmcs-uris.ts
cd ..
```