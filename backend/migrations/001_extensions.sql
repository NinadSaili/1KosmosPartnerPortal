-- =============================================================================
-- Migration 001: PostgreSQL Extensions
-- Partner Enablement Portal
-- =============================================================================

-- UUID generation support
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Cryptographic functions (gen_random_uuid, crypt, etc.)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Trigram-based full-text and fuzzy search (LIKE '%…%' acceleration)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- pgvector: vector similarity search for AI embeddings (1536-dim OpenAI)
CREATE EXTENSION IF NOT EXISTS "vector";
