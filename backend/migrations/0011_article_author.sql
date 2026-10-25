-- 0011_article_author.sql — a byline on the article row.
--
-- The Bing checklist has a "Named author" gate: a stable byline with a city and
-- beat gives a site an entity the search engine can associate with a topic.
-- The pipeline already picks an author per article (the TS engine assigns one
-- from the site's roster), but the server never persisted it, so every
-- server-backed article rendered "Named author: fix" no matter how good the
-- byline was and the checklist could never pass.
--
-- Store the resolved display name plus the identity needed to link the byline
-- back to the author page. All nullable: existing rows simply have no byline
-- until they are regenerated, and a missing author must never break a row.

ALTER TABLE articles ADD COLUMN author_name TEXT;
ALTER TABLE articles ADD COLUMN author_slug TEXT;
-- Free-text beat, e.g. "narrowing a research question". Shown next to the name.
ALTER TABLE articles ADD COLUMN author_beat TEXT;
-- City, for the "a byline with a city" part of the gate.
ALTER TABLE articles ADD COLUMN author_city TEXT;
