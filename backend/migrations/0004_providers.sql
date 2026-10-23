-- 0004_providers.sql — custom providers / BYO keys.
-- `ai_keys` already modelled "a key bound to a workspace". These columns turn it
-- into a full provider record: any OpenAI-compatible endpoint, its model, its
-- price, and whether it is the default. No provider is hardcoded and there is no
-- cap on how many a workspace may add.

ALTER TABLE ai_keys ADD COLUMN kind TEXT NOT NULL DEFAULT 'openai_compatible';
ALTER TABLE ai_keys ADD COLUMN base_url TEXT;
ALTER TABLE ai_keys ADD COLUMN model_id TEXT;
ALTER TABLE ai_keys ADD COLUMN price_in_per_mtok REAL NOT NULL DEFAULT 0;
ALTER TABLE ai_keys ADD COLUMN price_out_per_mtok REAL NOT NULL DEFAULT 0;
ALTER TABLE ai_keys ADD COLUMN max_tokens INTEGER NOT NULL DEFAULT 4096;
ALTER TABLE ai_keys ADD COLUMN temperature REAL NOT NULL DEFAULT 0.7;
ALTER TABLE ai_keys ADD COLUMN is_default INTEGER NOT NULL DEFAULT 0;
-- text | vision | lint — the vision gate and the writing gate may use different
-- keys than generation, exactly as their UI allows.
ALTER TABLE ai_keys ADD COLUMN role TEXT NOT NULL DEFAULT 'text';

CREATE INDEX IF NOT EXISTS idx_ai_keys_workspace ON ai_keys(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_keys_default ON ai_keys(workspace_id, role, is_default);
