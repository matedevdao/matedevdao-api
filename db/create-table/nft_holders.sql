CREATE TABLE nft_holders (
  nft_address TEXT,
  token_id INTEGER,
  holder TEXT,
  PRIMARY KEY (nft_address, token_id)
);
CREATE INDEX idx_nft_holders_holder ON nft_holders (holder);