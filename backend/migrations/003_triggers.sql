-- =============================================================================
-- Migration 003: Triggers and Functions
-- Partner Enablement Portal
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Generic updated_at trigger function
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Apply to every table that carries an updated_at column
DO $$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'organizations',
        'users',
        'courses',
        'lessons',
        'certifications',
        'deals',
        'announcements',
        'resources',
        'onboarding_checklist',
        'assessment_schedules'
    ]
    LOOP
        EXECUTE format(
            'CREATE TRIGGER trg_%s_updated_at
             BEFORE UPDATE ON %I
             FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();',
            t, t
        );
    END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Audit-log trigger
--    Fires AFTER INSERT / UPDATE / DELETE on tracked tables.
--    Writes one row per operation into audit_log with old/new data.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor_id  uuid;
    v_metadata  jsonb;
BEGIN
    -- Best-effort: pull the current user from the session setting Supabase sets.
    -- Falls back to NULL for service-role / migration runs.
    BEGIN
        v_actor_id := current_setting('request.jwt.claims', true)::jsonb->>'sub';
    EXCEPTION WHEN OTHERS THEN
        v_actor_id := NULL;
    END;

    CASE TG_OP
        WHEN 'INSERT' THEN
            v_metadata := jsonb_build_object(
                'new', row_to_json(NEW)::jsonb
            );
        WHEN 'UPDATE' THEN
            v_metadata := jsonb_build_object(
                'old', row_to_json(OLD)::jsonb,
                'new', row_to_json(NEW)::jsonb
            );
        WHEN 'DELETE' THEN
            v_metadata := jsonb_build_object(
                'old', row_to_json(OLD)::jsonb
            );
    END CASE;

    INSERT INTO audit_log (actor_id, action, resource_type, resource_id, metadata)
    VALUES (
        v_actor_id,
        TG_OP,                    -- 'INSERT' | 'UPDATE' | 'DELETE'
        TG_TABLE_NAME,
        CASE
            WHEN TG_OP = 'DELETE' THEN (row_to_json(OLD)::jsonb->>'id')::uuid
            ELSE                       (row_to_json(NEW)::jsonb->>'id')::uuid
        END,
        v_metadata
    );

    RETURN NULL; -- AFTER trigger; return value is ignored for row-level
END;
$$;

-- Attach audit trigger to tracked tables
DO $$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'deals',
        'resources',
        'announcements',
        'issued_certificates'
    ]
    LOOP
        EXECUTE format(
            'CREATE TRIGGER trg_%s_audit
             AFTER INSERT OR UPDATE OR DELETE ON %I
             FOR EACH ROW EXECUTE FUNCTION fn_audit_log();',
            t, t
        );
    END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Certificate number generation
--    Format: CRT-YYYYMM-XXXX  (XXXX = zero-padded monthly sequence)
--    Uses a dedicated sequence that resets per calendar month via
--    a lightweight approach: store the last-used month in a helper table
--    and reset the sequence when the month rolls over.
-- ---------------------------------------------------------------------------

-- Sequence used as the raw counter; we manage resets manually
CREATE SEQUENCE IF NOT EXISTS seq_cert_number_monthly
    START 1
    INCREMENT 1
    NO CYCLE;

-- Helper table tracks which month the sequence is currently counting for
CREATE TABLE IF NOT EXISTS _cert_number_state (
    current_month   char(6) NOT NULL  -- 'YYYYMM'
);
INSERT INTO _cert_number_state (current_month)
VALUES (to_char(now(), 'YYYYMM'))
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION fn_generate_cert_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
    v_month     char(6);
    v_stored    char(6);
    v_seq       bigint;
BEGIN
    v_month := to_char(now(), 'YYYYMM');

    SELECT current_month INTO v_stored FROM _cert_number_state FOR UPDATE;

    IF v_stored IS DISTINCT FROM v_month THEN
        -- Month rolled over — reset the sequence
        ALTER SEQUENCE seq_cert_number_monthly RESTART WITH 1;
        UPDATE _cert_number_state SET current_month = v_month;
    END IF;

    v_seq := nextval('seq_cert_number_monthly');

    RETURN 'CRT-' || v_month || '-' || lpad(v_seq::text, 4, '0');
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Auto-issue certificate after lesson_progress INSERT
--    check_course_completion(p_user_id, p_course_id):
--      • Verifies all required lessons for the course are complete
--      • Finds every certification that requires this course
--      • For each certification, checks whether ALL required courses are done
--      • If so, inserts an issued_certificate (once per user/certification)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION check_course_completion(
    p_user_id   uuid,
    p_course_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_all_required_done     boolean;
    v_cert                  record;
    v_cert_courses_done     boolean;
    v_already_issued        boolean;
    v_cert_number           text;
    v_validity_months       integer;
BEGIN
    -- 1. Are all required lessons in this course complete for the user?
    SELECT NOT EXISTS (
        SELECT 1
        FROM   lessons l
        WHERE  l.course_id   = p_course_id
          AND  l.is_required = true
          AND  NOT EXISTS (
              SELECT 1
              FROM   lesson_progress lp
              WHERE  lp.user_id   = p_user_id
                AND  lp.lesson_id = l.id
          )
    ) INTO v_all_required_done;

    IF NOT v_all_required_done THEN
        RETURN;  -- Course not yet fully complete
    END IF;

    -- 2. For each certification that lists this course as a requirement
    FOR v_cert IN
        SELECT c.*
        FROM   certifications c
        JOIN   certification_course_requirements ccr
               ON ccr.certification_id = c.id
        WHERE  ccr.course_id = p_course_id
    LOOP
        -- 3. Check whether ALL required courses for this cert are complete
        SELECT NOT EXISTS (
            SELECT 1
            FROM   certification_course_requirements ccr2
            WHERE  ccr2.certification_id = v_cert.id
              AND  NOT EXISTS (
                  -- All required lessons in that course must be done
                  SELECT 1
                  FROM   lessons l2
                  WHERE  l2.course_id   = ccr2.course_id
                    AND  l2.is_required = true
                  HAVING COUNT(*) = (
                      SELECT COUNT(*)
                      FROM   lesson_progress lp2
                      JOIN   lessons l3 ON l3.id = lp2.lesson_id
                      WHERE  lp2.user_id    = p_user_id
                        AND  l3.course_id   = ccr2.course_id
                        AND  l3.is_required = true
                  )
              )
        ) INTO v_cert_courses_done;

        -- Simpler rewrite of the above using a count comparison
        SELECT (
            -- Count of cert-required courses where user finished all required lessons
            SELECT COUNT(DISTINCT ccr3.course_id)
            FROM   certification_course_requirements ccr3
            WHERE  ccr3.certification_id = v_cert.id
              AND  NOT EXISTS (
                  SELECT 1 FROM lessons l4
                  WHERE  l4.course_id   = ccr3.course_id
                    AND  l4.is_required = true
                    AND  NOT EXISTS (
                        SELECT 1 FROM lesson_progress lp3
                        WHERE  lp3.user_id   = p_user_id
                          AND  lp3.lesson_id = l4.id
                    )
              )
        ) = (
            -- Total courses required for this cert
            SELECT COUNT(*) FROM certification_course_requirements
            WHERE  certification_id = v_cert.id
        ) INTO v_cert_courses_done;

        IF NOT v_cert_courses_done THEN
            CONTINUE;
        END IF;

        -- 4. Check if a valid (non-revoked) certificate already exists
        SELECT EXISTS (
            SELECT 1
            FROM   issued_certificates ic
            WHERE  ic.user_id           = p_user_id
              AND  ic.certification_id  = v_cert.id
              AND  ic.is_revoked        = false
              AND  ic.expires_at        > now()
        ) INTO v_already_issued;

        IF v_already_issued THEN
            CONTINUE;
        END IF;

        -- 5. Generate cert number and issue
        v_cert_number    := fn_generate_cert_number();
        v_validity_months := v_cert.validity_months;

        INSERT INTO issued_certificates (
            cert_number,
            user_id,
            certification_id,
            issued_at,
            expires_at
        ) VALUES (
            v_cert_number,
            p_user_id,
            v_cert.id,
            now(),
            now() + (v_validity_months || ' months')::interval
        );
    END LOOP;
END;
$$;

-- Trigger function that calls check_course_completion after lesson_progress insert
CREATE OR REPLACE FUNCTION fn_after_lesson_progress_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_course_id uuid;
BEGIN
    SELECT course_id INTO v_course_id
    FROM   lessons
    WHERE  id = NEW.lesson_id;

    IF v_course_id IS NOT NULL THEN
        PERFORM check_course_completion(NEW.user_id, v_course_id);
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lesson_progress_check_completion
AFTER INSERT ON lesson_progress
FOR EACH ROW EXECUTE FUNCTION fn_after_lesson_progress_insert();
