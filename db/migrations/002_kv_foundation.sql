BEGIN;

CREATE SCHEMA IF NOT EXISTS kv;

CREATE TABLE IF NOT EXISTS kv.entities (
    id text PRIMARY KEY,
    entity_type text NOT NULL CHECK (entity_type IN (
        'person', 'company', 'place', 'property', 'asset', 'vehicle',
        'account', 'device', 'document'
    )),
    display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 160),
    sensitivity text NOT NULL DEFAULT 'private' CHECK (sensitivity IN ('internal', 'private', 'sensitive', 'location')),
    owner_user_id integer NOT NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS kv_entities_owner_idx ON kv.entities(owner_user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS kv_entities_type_idx ON kv.entities(entity_type, updated_at DESC);

CREATE TABLE IF NOT EXISTS kv.entity_relationships (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    from_entity_id text NOT NULL REFERENCES kv.entities(id) ON DELETE CASCADE,
    to_entity_id text NOT NULL REFERENCES kv.entities(id) ON DELETE CASCADE,
    relation_type text NOT NULL CHECK (relation_type IN (
        'owns', 'works_at', 'located_at', 'contains', 'uses', 'belongs_to', 'related_to'
    )),
    created_by integer NOT NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (from_entity_id, to_entity_id, relation_type),
    CHECK (from_entity_id <> to_entity_id)
);

CREATE INDEX IF NOT EXISTS kv_relationships_from_idx ON kv.entity_relationships(from_entity_id);
CREATE INDEX IF NOT EXISTS kv_relationships_to_idx ON kv.entity_relationships(to_entity_id);

CREATE TABLE IF NOT EXISTS kv.entity_grants (
    entity_id text NOT NULL REFERENCES kv.entities(id) ON DELETE CASCADE,
    user_id integer NOT NULL,
    permission text NOT NULL CHECK (permission IN ('view', 'edit', 'manage')),
    granted_by integer NOT NULL,
    grant_source text NOT NULL DEFAULT 'direct' CHECK (grant_source IN ('direct', 'consent', 'system')),
    expires_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (entity_id, user_id)
);

CREATE INDEX IF NOT EXISTS kv_grants_user_idx ON kv.entity_grants(user_id, expires_at);

CREATE TABLE IF NOT EXISTS kv.dashboard_layouts (
    user_id integer PRIMARY KEY,
    layout jsonb NOT NULL DEFAULT '[]'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kv.security_events (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    occurred_at timestamptz NOT NULL DEFAULT now(),
    actor_user_id integer,
    actor_label text NOT NULL,
    event_type text NOT NULL,
    outcome text NOT NULL CHECK (outcome IN ('success', 'denied', 'error')),
    resource_type text,
    resource_id text,
    detail jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS kv_security_events_time_idx ON kv.security_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS kv_security_events_actor_idx ON kv.security_events(actor_user_id, occurred_at DESC);

COMMIT;
