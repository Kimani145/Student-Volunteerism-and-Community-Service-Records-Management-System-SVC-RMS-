-- ===== Types =====
CREATE TYPE user_role AS ENUM ('STUDENT','STAFF','MANAGEMENT','ADMIN');
CREATE TYPE activity_status AS ENUM ('DRAFT','PUBLISHED','IN_PROGRESS','COMPLETED','CANCELLED');
CREATE TYPE participation_status AS ENUM ('REGISTERED','CANCELLED','ATTENDED','ABSENT');
CREATE TYPE attendance_method AS ENUM ('QR_SELF','MANUAL_STAFF');
CREATE TYPE certificate_status AS ENUM ('ISSUED','REVOKED');
CREATE TYPE document_status AS ENUM ('ACTIVE','DISPOSED');

-- ===== Identity =====
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE CHECK (email = lower(email)),
  password_hash TEXT NOT NULL,
  role user_role NOT NULL,
  can_approve BOOLEAN NOT NULL DEFAULT FALSE CHECK (NOT can_approve OR role IN ('STAFF','ADMIN')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  email_verified_at TIMESTAMPTZ,
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  failed_login_count INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id UUID NOT NULL,                       -- rotation family for reuse detection
  refresh_hash BYTEA NOT NULL UNIQUE,            -- SHA-256(token || pepper)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,               -- absolute cap: created_at + 8h
  revoked_at TIMESTAMPTZ,
  ip INET, user_agent TEXT
);
CREATE INDEX ix_sessions_user ON sessions(user_id);

CREATE TABLE email_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('VERIFY_EMAIL','RESET_PASSWORD')),
  token_hash BYTEA NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);

CREATE TABLE schools (
  id SMALLSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE               -- seed list is a placeholder (Appendix A)
);

CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  reg_number VARCHAR(50) NOT NULL UNIQUE CHECK (reg_number = upper(reg_number)),
  full_name VARCHAR(255) NOT NULL,
  gender TEXT NOT NULL DEFAULT 'UNDISCLOSED' CHECK (gender IN ('FEMALE','MALE','OTHER','UNDISCLOSED')),
  school_id SMALLINT NOT NULL REFERENCES schools(id),
  programme VARCHAR(255) NOT NULL,
  year_of_study SMALLINT NOT NULL CHECK (year_of_study BETWEEN 1 AND 6),
  phone VARCHAR(30),                              -- optional (data minimisation)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  notice_version VARCHAR(20) NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip INET
);

-- ===== Activities =====
CREATE TABLE activity_types (
  id SMALLSERIAL PRIMARY KEY,
  code VARCHAR(40) NOT NULL UNIQUE,               -- TREE_PLANTING, FUNDRAISING, CLEANUP, DONATION, MENTORSHIP, OTHER
  name VARCHAR(100) NOT NULL
);

CREATE TABLE community_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(255),
  email VARCHAR(255), phone VARCHAR(50), address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  type_id SMALLINT NOT NULL REFERENCES activity_types(id),
  description TEXT NOT NULL,
  venue VARCHAR(255) NOT NULL,
  venue_lat NUMERIC(9,6), venue_lng NUMERIC(9,6), geofence_radius_m INTEGER CHECK (geofence_radius_m > 0),
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  registration_closes_at TIMESTAMPTZ NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  service_hours NUMERIC(4,1) NOT NULL CHECK (service_hours > 0),
  eligible_years SMALLINT[],                      -- NULL = all years
  status activity_status NOT NULL DEFAULT 'DRAFT',
  partner_id UUID REFERENCES community_partners(id) ON DELETE RESTRICT,
  organizer_id UUID NOT NULL REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_at > start_at),
  CHECK (registration_closes_at <= start_at),
  CHECK (approved_by IS NULL OR approved_by <> organizer_id),
  CHECK (status IN ('DRAFT','CANCELLED') OR approved_by IS NOT NULL)
);
CREATE INDEX ix_activities_status_start ON activities(status, start_at);

-- ===== Participation and attendance =====
CREATE TABLE participations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE RESTRICT,
  status participation_status NOT NULL DEFAULT 'REGISTERED',
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at TIMESTAMPTZ,
  hours_awarded NUMERIC(4,1) NOT NULL DEFAULT 0 CHECK (hours_awarded >= 0),
  hours_override_reason TEXT,
  UNIQUE (student_id, activity_id)
);
CREATE INDEX ix_participations_activity_status ON participations(activity_id, status);

CREATE TABLE attendances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participation_id UUID NOT NULL UNIQUE REFERENCES participations(id) ON DELETE RESTRICT,
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  method attendance_method NOT NULL,
  recorded_by UUID NOT NULL REFERENCES users(id), -- the student's own user for QR_SELF
  lat NUMERIC(9,6), lng NUMERIC(9,6),
  location_flag BOOLEAN NOT NULL DEFAULT FALSE,
  remarks TEXT
);

-- ===== Certificates =====
CREATE TABLE certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participation_id UUID NOT NULL REFERENCES participations(id) ON DELETE RESTRICT,
  cvid VARCHAR(40) NOT NULL UNIQUE,
  payload JSONB NOT NULL,                         -- exactly what was signed
  signature BYTEA NOT NULL,                       -- Ed25519 over canonical(payload)
  key_id VARCHAR(32) NOT NULL,
  status certificate_status NOT NULL DEFAULT 'ISSUED',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  issued_by UUID NOT NULL REFERENCES users(id),
  revoked_at TIMESTAMPTZ, revoked_by UUID REFERENCES users(id), revocation_reason TEXT,
  supersedes_id UUID REFERENCES certificates(id),
  template_version SMALLINT NOT NULL DEFAULT 1,
  pdf_storage_key TEXT, pdf_sha256 CHAR(64),      -- filled on first download
  CHECK ((status = 'REVOKED') = (revoked_at IS NOT NULL AND revoked_by IS NOT NULL AND revocation_reason IS NOT NULL))
);
CREATE UNIQUE INDEX ux_certificates_one_active ON certificates(participation_id) WHERE status = 'ISSUED';

-- ===== Records repository =====
CREATE TABLE record_classes (
  code VARCHAR(40) PRIMARY KEY,                   -- e.g. ATTENDANCE_REGISTER, APPROVAL_LETTER, PHOTO, FINANCIAL, ACTIVITY_REPORT
  name VARCHAR(150) NOT NULL,
  retention_years SMALLINT NOT NULL CHECK (retention_years > 0)  -- PLACEHOLDER values until DCOLAP confirms (Appendix A)
);

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE RESTRICT,
  class_code VARCHAR(40) NOT NULL REFERENCES record_classes(code),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  file_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL CHECK (mime_type IN ('application/pdf','image/png','image/jpeg')),
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
  sha256 CHAR(64) NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  captured_by UUID NOT NULL REFERENCES users(id),
  retention_expires_at TIMESTAMPTZ NOT NULL,
  legal_hold BOOLEAN NOT NULL DEFAULT FALSE,
  status document_status NOT NULL DEFAULT 'ACTIVE',
  disposed_at TIMESTAMPTZ, disposed_by UUID REFERENCES users(id), disposal_reason TEXT,
  search_tsv TSVECTOR GENERATED ALWAYS AS
    (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(file_name,''))) STORED
);
CREATE INDEX ix_documents_search ON documents USING GIN (search_tsv);
CREATE INDEX ix_documents_activity ON documents(activity_id);

CREATE TABLE activity_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE RESTRICT,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, title VARCHAR(255) NOT NULL, body TEXT, link TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_notifications_user_unread ON notifications(user_id, created_at DESC) WHERE read_at IS NULL;

-- ===== Audit (append-only, hash-chained) =====
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  source TEXT NOT NULL CHECK (source IN ('DB','APP')),
  event_type TEXT NOT NULL,                       -- e.g. participations.UPDATE, auth.LOGIN_FAILED
  table_name TEXT, record_id TEXT, operation TEXT,
  old_data JSONB, new_data JSONB,
  actor_user_id UUID, actor_ip INET, request_id TEXT,
  prev_hash BYTEA, row_hash BYTEA
);
CREATE INDEX ix_audit_actor_time ON audit_log(actor_user_id, occurred_at DESC);
CREATE INDEX ix_audit_table_record ON audit_log(table_name, record_id);

CREATE FUNCTION audit_chain() RETURNS trigger AS $$
DECLARE prev BYTEA;
BEGIN
  PERFORM pg_advisory_xact_lock(7001);            -- serialise chain writes
  SELECT row_hash INTO prev FROM audit_log ORDER BY id DESC LIMIT 1;
  NEW.prev_hash := prev;
  NEW.row_hash := sha256(convert_to(
    coalesce(encode(prev,'hex'),'') || NEW.occurred_at::text || NEW.source || NEW.event_type ||
    coalesce(NEW.table_name,'') || coalesce(NEW.record_id,'') || coalesce(NEW.operation,'') ||
    coalesce(NEW.old_data::text,'') || coalesce(NEW.new_data::text,'') ||
    coalesce(NEW.actor_user_id::text,''), 'UTF8'));
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_audit_chain BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION audit_chain();

CREATE FUNCTION audit_immutable() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'audit_log is append-only'; END $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_audit_no_mutation BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION audit_immutable();
CREATE TRIGGER trg_audit_no_truncate BEFORE TRUNCATE ON audit_log FOR EACH STATEMENT EXECUTE FUNCTION audit_immutable();

CREATE FUNCTION audit_row_change() RETURNS trigger AS $$
DECLARE o JSONB; n JSONB; rid TEXT;
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN o := to_jsonb(OLD) - 'password_hash' - 'refresh_hash' - 'token_hash'; END IF;
  IF TG_OP IN ('INSERT','UPDATE') THEN n := to_jsonb(NEW) - 'password_hash' - 'refresh_hash' - 'token_hash'; END IF;
  rid := COALESCE(n->>'id', o->>'id');
  INSERT INTO audit_log(source,event_type,table_name,record_id,operation,old_data,new_data,actor_user_id,actor_ip,request_id)
  VALUES ('DB', TG_TABLE_NAME || '.' || TG_OP, TG_TABLE_NAME, rid, TG_OP, o, n,
          NULLIF(current_setting('app.user_id', true), '')::uuid,
          NULLIF(current_setting('app.client_ip', true), '')::inet,
          NULLIF(current_setting('app.request_id', true), ''));
  RETURN COALESCE(NEW, OLD);
END $$ LANGUAGE plpgsql;

DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['users','students','activities','participations','attendances','certificates',
                           'documents','community_partners','activity_reports'] LOOP
    EXECUTE format('CREATE TRIGGER trg_audit_%I AFTER INSERT OR UPDATE OR DELETE ON %I
                    FOR EACH ROW EXECUTE FUNCTION audit_row_change()', t, t);
  END LOOP;
END $$;

-- ===== Edit-lock once a certificate is ISSUED =====
CREATE FUNCTION block_edit_after_certificate() RETURNS trigger AS $$
DECLARE pid UUID;
BEGIN
  IF TG_TABLE_NAME = 'participations' THEN
    pid := OLD.id;
    IF TG_OP = 'UPDATE' THEN
      IF NEW.status = OLD.status AND NEW.hours_awarded = OLD.hours_awarded THEN
        RETURN NEW;                               -- unrelated column change
      END IF;
    END IF;
  ELSE
    pid := OLD.participation_id;
  END IF;
  IF EXISTS (SELECT 1 FROM certificates WHERE participation_id = pid AND status = 'ISSUED') THEN
    RAISE EXCEPTION 'CERTIFICATE_LOCKED' USING ERRCODE = 'P0001';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_lock_participations BEFORE UPDATE OR DELETE ON participations FOR EACH ROW EXECUTE FUNCTION block_edit_after_certificate();
CREATE TRIGGER trg_lock_attendances   BEFORE UPDATE OR DELETE ON attendances   FOR EACH ROW EXECUTE FUNCTION block_edit_after_certificate();

-- ===== Grants (app connects as svc_app, never as owner) =====
-- REVOKE ALL ON ALL TABLES IN SCHEMA public FROM svc_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON <all tables except audit_log> TO svc_app;
-- GRANT SELECT, INSERT ON audit_log TO svc_app;  GRANT USAGE ON SEQUENCE audit_log_id_seq TO svc_app;
