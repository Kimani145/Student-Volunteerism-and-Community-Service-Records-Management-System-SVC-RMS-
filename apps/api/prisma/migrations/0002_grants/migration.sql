CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'svc_app') THEN
    CREATE ROLE svc_app LOGIN PASSWORD 'svc_app_password';
  END IF;
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM svc_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  users, sessions, email_tokens, schools, students, consents, activity_types,
  community_partners, activities, participations, attendances, certificates,
  record_classes, documents, activity_reports, notifications
TO svc_app;
GRANT SELECT, INSERT ON TABLE audit_log TO svc_app;
GRANT USAGE, SELECT ON SEQUENCE audit_log_id_seq TO svc_app;
