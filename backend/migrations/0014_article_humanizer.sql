-- The humanizer's verdict, stored with the article.
--
-- Humanization runs inside validation now, so the pipeline has to record what
-- it did: without these columns the browser had no way to know an article had
-- been humanized and the Bing checklist stayed red on every server-backed row.
ALTER TABLE articles ADD COLUMN humanized INTEGER NOT NULL DEFAULT 0;
ALTER TABLE articles ADD COLUMN humanizer_score INTEGER;
ALTER TABLE articles ADD COLUMN humanizer_passes INTEGER;
ALTER TABLE articles ADD COLUMN humanizer_note TEXT;
ALTER TABLE articles ADD COLUMN humanizer_stripped TEXT;
