CREATE TABLE parsed_contract_event_blocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  last_parsed_block INTEGER NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER set_updated_at
BEFORE UPDATE ON parsed_contract_event_blocks
FOR EACH ROW
BEGIN
  UPDATE parsed_contract_event_blocks
  SET updated_at = CURRENT_TIMESTAMP
  WHERE id = OLD.id;
END;
