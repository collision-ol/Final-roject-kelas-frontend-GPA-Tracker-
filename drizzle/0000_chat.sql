CREATE TABLE chat_quota (bucket TEXT PRIMARY KEY NOT NULL, used INTEGER NOT NULL, expires_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE chat_threads (id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, curriculum TEXT NOT NULL, title TEXT NOT NULL, messages TEXT NOT NULL, updated_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX chat_threads_owner ON chat_threads(user_id, updated_at);
