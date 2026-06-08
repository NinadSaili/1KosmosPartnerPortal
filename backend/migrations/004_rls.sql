-- =============================================================================
-- Migration 004: Row-Level Security (RLS) Policies
-- Partner Enablement Portal
-- =============================================================================
-- All policies rely on two stable helper functions that look up the current
-- authenticated user's role and organization from the users table, using
-- auth.uid() (Supabase's built-in function that resolves the JWT sub claim).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT role FROM users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT organization_id FROM users WHERE id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- ORGANIZATIONS
-- ---------------------------------------------------------------------------
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- SELECT: vendor_admin sees all; others see only their own org
CREATE POLICY organizations_select ON organizations
    FOR SELECT
    TO authenticated
    USING (
        get_user_role() = 'vendor_admin'
        OR id = get_user_org_id()
    );

-- INSERT: vendor_admin only
CREATE POLICY organizations_insert ON organizations
    FOR INSERT
    TO authenticated
    WITH CHECK (get_user_role() = 'vendor_admin');

-- UPDATE: vendor_admin only
CREATE POLICY organizations_update ON organizations
    FOR UPDATE
    TO authenticated
    USING    (get_user_role() = 'vendor_admin')
    WITH CHECK (get_user_role() = 'vendor_admin');

-- DELETE: vendor_admin only
CREATE POLICY organizations_delete ON organizations
    FOR DELETE
    TO authenticated
    USING (get_user_role() = 'vendor_admin');

-- ---------------------------------------------------------------------------
-- USERS
-- ---------------------------------------------------------------------------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- SELECT:
--   vendor_admin  → all rows
--   partner_admin → users in same org
--   partner_user  → only self
CREATE POLICY users_select ON users
    FOR SELECT
    TO authenticated
    USING (
        get_user_role() = 'vendor_admin'
        OR (get_user_role() = 'partner_admin' AND organization_id = get_user_org_id())
        OR id = auth.uid()
    );

-- INSERT: vendor_admin only
CREATE POLICY users_insert ON users
    FOR INSERT
    TO authenticated
    WITH CHECK (get_user_role() = 'vendor_admin');

-- UPDATE:
--   user updates own row
--   vendor_admin updates anyone
--   partner_admin updates users in their org
CREATE POLICY users_update ON users
    FOR UPDATE
    TO authenticated
    USING (
        id = auth.uid()
        OR get_user_role() = 'vendor_admin'
        OR (get_user_role() = 'partner_admin' AND organization_id = get_user_org_id())
    )
    WITH CHECK (
        id = auth.uid()
        OR get_user_role() = 'vendor_admin'
        OR (get_user_role() = 'partner_admin' AND organization_id = get_user_org_id())
    );

-- DELETE: vendor_admin only
CREATE POLICY users_delete ON users
    FOR DELETE
    TO authenticated
    USING (get_user_role() = 'vendor_admin');

-- ---------------------------------------------------------------------------
-- ONBOARDING_CHECKLIST
-- ---------------------------------------------------------------------------
ALTER TABLE onboarding_checklist ENABLE ROW LEVEL SECURITY;

-- SELECT:
--   vendor_admin → all
--   partner_admin / partner_user → their own org's row
CREATE POLICY onboarding_checklist_select ON onboarding_checklist
    FOR SELECT
    TO authenticated
    USING (
        get_user_role() = 'vendor_admin'
        OR organization_id = get_user_org_id()
    );

-- INSERT: vendor_admin only (checklist rows are created via seed / admin action)
CREATE POLICY onboarding_checklist_insert ON onboarding_checklist
    FOR INSERT
    TO authenticated
    WITH CHECK (get_user_role() = 'vendor_admin');

-- UPDATE: vendor_admin and partner_admin of that org
CREATE POLICY onboarding_checklist_update ON onboarding_checklist
    FOR UPDATE
    TO authenticated
    USING (
        get_user_role() = 'vendor_admin'
        OR (get_user_role() = 'partner_admin' AND organization_id = get_user_org_id())
    )
    WITH CHECK (
        get_user_role() = 'vendor_admin'
        OR (get_user_role() = 'partner_admin' AND organization_id = get_user_org_id())
    );

-- DELETE: vendor_admin only
CREATE POLICY onboarding_checklist_delete ON onboarding_checklist
    FOR DELETE
    TO authenticated
    USING (get_user_role() = 'vendor_admin');

-- ---------------------------------------------------------------------------
-- COURSES
-- ---------------------------------------------------------------------------
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

-- SELECT:
--   vendor_admin → all (including unpublished)
--   others       → published only
CREATE POLICY courses_select ON courses
    FOR SELECT
    TO authenticated
    USING (
        get_user_role() = 'vendor_admin'
        OR is_published = true
    );

-- INSERT / UPDATE / DELETE: vendor_admin only
CREATE POLICY courses_insert ON courses
    FOR INSERT
    TO authenticated
    WITH CHECK (get_user_role() = 'vendor_admin');

CREATE POLICY courses_update ON courses
    FOR UPDATE
    TO authenticated
    USING    (get_user_role() = 'vendor_admin')
    WITH CHECK (get_user_role() = 'vendor_admin');

CREATE POLICY courses_delete ON courses
    FOR DELETE
    TO authenticated
    USING (get_user_role() = 'vendor_admin');

-- ---------------------------------------------------------------------------
-- COURSE_VERTICAL_TAGS
-- ---------------------------------------------------------------------------
ALTER TABLE course_vertical_tags ENABLE ROW LEVEL SECURITY;

-- SELECT: all authenticated (visibility mirrors the published course check via join in app layer)
CREATE POLICY course_vertical_tags_select ON course_vertical_tags
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY course_vertical_tags_insert ON course_vertical_tags
    FOR INSERT
    TO authenticated
    WITH CHECK (get_user_role() = 'vendor_admin');

CREATE POLICY course_vertical_tags_update ON course_vertical_tags
    FOR UPDATE
    TO authenticated
    USING    (get_user_role() = 'vendor_admin')
    WITH CHECK (get_user_role() = 'vendor_admin');

CREATE POLICY course_vertical_tags_delete ON course_vertical_tags
    FOR DELETE
    TO authenticated
    USING (get_user_role() = 'vendor_admin');

-- ---------------------------------------------------------------------------
-- LESSONS
-- ---------------------------------------------------------------------------
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;

-- SELECT: authenticated users can read lessons belonging to a published course
--         vendor_admin sees all lessons regardless of publish state
CREATE POLICY lessons_select ON lessons
    FOR SELECT
    TO authenticated
    USING (
        get_user_role() = 'vendor_admin'
        OR EXISTS (
            SELECT 1 FROM courses c
            WHERE c.id = lessons.course_id
              AND c.is_published = true
        )
    );

CREATE POLICY lessons_insert ON lessons
    FOR INSERT
    TO authenticated
    WITH CHECK (get_user_role() = 'vendor_admin');

CREATE POLICY lessons_update ON lessons
    FOR UPDATE
    TO authenticated
    USING    (get_user_role() = 'vendor_admin')
    WITH CHECK (get_user_role() = 'vendor_admin');

CREATE POLICY lessons_delete ON lessons
    FOR DELETE
    TO authenticated
    USING (get_user_role() = 'vendor_admin');

-- ---------------------------------------------------------------------------
-- PREWORK_ASSIGNMENTS
-- ---------------------------------------------------------------------------
ALTER TABLE prework_assignments ENABLE ROW LEVEL SECURITY;

-- SELECT: all authenticated (belongs to a course)
CREATE POLICY prework_assignments_select ON prework_assignments
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY prework_assignments_insert ON prework_assignments
    FOR INSERT
    TO authenticated
    WITH CHECK (get_user_role() = 'vendor_admin');

CREATE POLICY prework_assignments_update ON prework_assignments
    FOR UPDATE
    TO authenticated
    USING    (get_user_role() = 'vendor_admin')
    WITH CHECK (get_user_role() = 'vendor_admin');

CREATE POLICY prework_assignments_delete ON prework_assignments
    FOR DELETE
    TO authenticated
    USING (get_user_role() = 'vendor_admin');

-- ---------------------------------------------------------------------------
-- PREWORK_SUBMISSIONS
-- ---------------------------------------------------------------------------
ALTER TABLE prework_submissions ENABLE ROW LEVEL SECURITY;

-- SELECT: own rows; vendor_admin all; partner_admin their org's users
CREATE POLICY prework_submissions_select ON prework_submissions
    FOR SELECT
    TO authenticated
    USING (
        get_user_role() = 'vendor_admin'
        OR user_id = auth.uid()
        OR (
            get_user_role() = 'partner_admin'
            AND EXISTS (
                SELECT 1 FROM users u
                WHERE u.id = prework_submissions.user_id
                  AND u.organization_id = get_user_org_id()
            )
        )
    );

-- INSERT: own submissions only
CREATE POLICY prework_submissions_insert ON prework_submissions
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- UPDATE: vendor_admin (for review fields); submitter cannot modify reviewed rows
CREATE POLICY prework_submissions_update ON prework_submissions
    FOR UPDATE
    TO authenticated
    USING (
        get_user_role() = 'vendor_admin'
        OR (user_id = auth.uid() AND reviewed = false)
    )
    WITH CHECK (
        get_user_role() = 'vendor_admin'
        OR (user_id = auth.uid() AND reviewed = false)
    );

-- ---------------------------------------------------------------------------
-- LESSON_PROGRESS
-- ---------------------------------------------------------------------------
ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;

-- SELECT:
--   own rows only, vendor_admin all, partner_admin their org
CREATE POLICY lesson_progress_select ON lesson_progress
    FOR SELECT
    TO authenticated
    USING (
        get_user_role() = 'vendor_admin'
        OR user_id = auth.uid()
        OR (
            get_user_role() = 'partner_admin'
            AND EXISTS (
                SELECT 1 FROM users u
                WHERE u.id = lesson_progress.user_id
                  AND u.organization_id = get_user_org_id()
            )
        )
    );

-- INSERT: own rows only
CREATE POLICY lesson_progress_insert ON lesson_progress
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- DELETE: own rows only
CREATE POLICY lesson_progress_delete ON lesson_progress
    FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- CERTIFICATIONS
-- ---------------------------------------------------------------------------
ALTER TABLE certifications ENABLE ROW LEVEL SECURITY;

-- SELECT: all authenticated
CREATE POLICY certifications_select ON certifications
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY certifications_insert ON certifications
    FOR INSERT
    TO authenticated
    WITH CHECK (get_user_role() = 'vendor_admin');

CREATE POLICY certifications_update ON certifications
    FOR UPDATE
    TO authenticated
    USING    (get_user_role() = 'vendor_admin')
    WITH CHECK (get_user_role() = 'vendor_admin');

CREATE POLICY certifications_delete ON certifications
    FOR DELETE
    TO authenticated
    USING (get_user_role() = 'vendor_admin');

-- ---------------------------------------------------------------------------
-- CERTIFICATION_COURSE_REQUIREMENTS
-- ---------------------------------------------------------------------------
ALTER TABLE certification_course_requirements ENABLE ROW LEVEL SECURITY;

-- SELECT: all authenticated
CREATE POLICY ccr_select ON certification_course_requirements
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY ccr_insert ON certification_course_requirements
    FOR INSERT
    TO authenticated
    WITH CHECK (get_user_role() = 'vendor_admin');

CREATE POLICY ccr_update ON certification_course_requirements
    FOR UPDATE
    TO authenticated
    USING    (get_user_role() = 'vendor_admin')
    WITH CHECK (get_user_role() = 'vendor_admin');

CREATE POLICY ccr_delete ON certification_course_requirements
    FOR DELETE
    TO authenticated
    USING (get_user_role() = 'vendor_admin');

-- ---------------------------------------------------------------------------
-- ASSESSMENT_SCHEDULES
-- ---------------------------------------------------------------------------
ALTER TABLE assessment_schedules ENABLE ROW LEVEL SECURITY;

-- SELECT: own rows; vendor_admin all; partner_admin their org
CREATE POLICY assessment_schedules_select ON assessment_schedules
    FOR SELECT
    TO authenticated
    USING (
        get_user_role() = 'vendor_admin'
        OR user_id = auth.uid()
        OR (
            get_user_role() = 'partner_admin'
            AND EXISTS (
                SELECT 1 FROM users u
                WHERE u.id = assessment_schedules.user_id
                  AND u.organization_id = get_user_org_id()
            )
        )
    );

-- INSERT: partner_user and partner_admin scheduling for themselves
CREATE POLICY assessment_schedules_insert ON assessment_schedules
    FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        AND get_user_role() IN ('partner_user', 'partner_admin')
    );

-- UPDATE: vendor_admin (to confirm / cancel) or the user (to cancel their own pending)
CREATE POLICY assessment_schedules_update ON assessment_schedules
    FOR UPDATE
    TO authenticated
    USING (
        get_user_role() = 'vendor_admin'
        OR (user_id = auth.uid() AND status = 'pending')
    )
    WITH CHECK (
        get_user_role() = 'vendor_admin'
        OR (user_id = auth.uid() AND status = 'pending')
    );

-- DELETE: vendor_admin only
CREATE POLICY assessment_schedules_delete ON assessment_schedules
    FOR DELETE
    TO authenticated
    USING (get_user_role() = 'vendor_admin');

-- ---------------------------------------------------------------------------
-- ASSESSMENT_RESULTS
-- ---------------------------------------------------------------------------
ALTER TABLE assessment_results ENABLE ROW LEVEL SECURITY;

-- SELECT: own; vendor_admin all; partner_admin their org
CREATE POLICY assessment_results_select ON assessment_results
    FOR SELECT
    TO authenticated
    USING (
        get_user_role() = 'vendor_admin'
        OR user_id = auth.uid()
        OR (
            get_user_role() = 'partner_admin'
            AND EXISTS (
                SELECT 1 FROM users u
                WHERE u.id = assessment_results.user_id
                  AND u.organization_id = get_user_org_id()
            )
        )
    );

-- INSERT / UPDATE: vendor_admin only
CREATE POLICY assessment_results_insert ON assessment_results
    FOR INSERT
    TO authenticated
    WITH CHECK (get_user_role() = 'vendor_admin');

CREATE POLICY assessment_results_update ON assessment_results
    FOR UPDATE
    TO authenticated
    USING    (get_user_role() = 'vendor_admin')
    WITH CHECK (get_user_role() = 'vendor_admin');

-- DELETE: vendor_admin only
CREATE POLICY assessment_results_delete ON assessment_results
    FOR DELETE
    TO authenticated
    USING (get_user_role() = 'vendor_admin');

-- ---------------------------------------------------------------------------
-- ISSUED_CERTIFICATES
-- ---------------------------------------------------------------------------
ALTER TABLE issued_certificates ENABLE ROW LEVEL SECURITY;

-- SELECT: own; vendor_admin all; partner_admin their org
CREATE POLICY issued_certificates_select ON issued_certificates
    FOR SELECT
    TO authenticated
    USING (
        get_user_role() = 'vendor_admin'
        OR user_id = auth.uid()
        OR (
            get_user_role() = 'partner_admin'
            AND EXISTS (
                SELECT 1 FROM users u
                WHERE u.id = issued_certificates.user_id
                  AND u.organization_id = get_user_org_id()
            )
        )
    );

-- INSERT: system / trigger writes only — vendor_admin as fallback
CREATE POLICY issued_certificates_insert ON issued_certificates
    FOR INSERT
    TO authenticated
    WITH CHECK (get_user_role() = 'vendor_admin');

-- UPDATE (revoke fields): vendor_admin only
CREATE POLICY issued_certificates_update ON issued_certificates
    FOR UPDATE
    TO authenticated
    USING    (get_user_role() = 'vendor_admin')
    WITH CHECK (get_user_role() = 'vendor_admin');

-- DELETE: vendor_admin only
CREATE POLICY issued_certificates_delete ON issued_certificates
    FOR DELETE
    TO authenticated
    USING (get_user_role() = 'vendor_admin');

-- ---------------------------------------------------------------------------
-- RESOURCES
-- ---------------------------------------------------------------------------
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;

-- SELECT: vendor_admin sees all; others see published only
CREATE POLICY resources_select ON resources
    FOR SELECT
    TO authenticated
    USING (
        get_user_role() = 'vendor_admin'
        OR is_published = true
    );

CREATE POLICY resources_insert ON resources
    FOR INSERT
    TO authenticated
    WITH CHECK (get_user_role() = 'vendor_admin');

CREATE POLICY resources_update ON resources
    FOR UPDATE
    TO authenticated
    USING    (get_user_role() = 'vendor_admin')
    WITH CHECK (get_user_role() = 'vendor_admin');

CREATE POLICY resources_delete ON resources
    FOR DELETE
    TO authenticated
    USING (get_user_role() = 'vendor_admin');

-- ---------------------------------------------------------------------------
-- RESOURCE_VERTICAL_TAGS
-- ---------------------------------------------------------------------------
ALTER TABLE resource_vertical_tags ENABLE ROW LEVEL SECURITY;

-- SELECT: all authenticated
CREATE POLICY resource_vertical_tags_select ON resource_vertical_tags
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY resource_vertical_tags_insert ON resource_vertical_tags
    FOR INSERT
    TO authenticated
    WITH CHECK (get_user_role() = 'vendor_admin');

CREATE POLICY resource_vertical_tags_update ON resource_vertical_tags
    FOR UPDATE
    TO authenticated
    USING    (get_user_role() = 'vendor_admin')
    WITH CHECK (get_user_role() = 'vendor_admin');

CREATE POLICY resource_vertical_tags_delete ON resource_vertical_tags
    FOR DELETE
    TO authenticated
    USING (get_user_role() = 'vendor_admin');

-- ---------------------------------------------------------------------------
-- DEALS
-- ---------------------------------------------------------------------------
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

-- SELECT:
--   submitter sees own deals
--   vendor_admin sees all
--   partner_admin sees their org's deals
CREATE POLICY deals_select ON deals
    FOR SELECT
    TO authenticated
    USING (
        get_user_role() = 'vendor_admin'
        OR submitter_id = auth.uid()
        OR (
            get_user_role() = 'partner_admin'
            AND organization_id = get_user_org_id()
        )
    );

-- INSERT: partner_user and partner_admin
CREATE POLICY deals_insert ON deals
    FOR INSERT
    TO authenticated
    WITH CHECK (
        get_user_role() IN ('partner_user', 'partner_admin')
        AND submitter_id = auth.uid()
        AND organization_id = get_user_org_id()
    );

-- UPDATE:
--   submitter can update when status = 'draft'
--   vendor_admin can update any deal
CREATE POLICY deals_update ON deals
    FOR UPDATE
    TO authenticated
    USING (
        get_user_role() = 'vendor_admin'
        OR (submitter_id = auth.uid() AND status = 'draft')
    )
    WITH CHECK (
        get_user_role() = 'vendor_admin'
        OR (submitter_id = auth.uid() AND status = 'draft')
    );

-- DELETE: vendor_admin only
CREATE POLICY deals_delete ON deals
    FOR DELETE
    TO authenticated
    USING (get_user_role() = 'vendor_admin');

-- ---------------------------------------------------------------------------
-- DEAL_DOCUMENTS
-- ---------------------------------------------------------------------------
ALTER TABLE deal_documents ENABLE ROW LEVEL SECURITY;

-- SELECT: deal submitter; vendor_admin; partner_admin of org
CREATE POLICY deal_documents_select ON deal_documents
    FOR SELECT
    TO authenticated
    USING (
        get_user_role() = 'vendor_admin'
        OR uploaded_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM deals d
            WHERE d.id = deal_documents.deal_id
              AND (
                d.submitter_id = auth.uid()
                OR (get_user_role() = 'partner_admin' AND d.organization_id = get_user_org_id())
              )
        )
    );

-- INSERT: deal submitter only
CREATE POLICY deal_documents_insert ON deal_documents
    FOR INSERT
    TO authenticated
    WITH CHECK (
        uploaded_by = auth.uid()
        AND EXISTS (
            SELECT 1 FROM deals d
            WHERE d.id = deal_documents.deal_id
              AND d.submitter_id = auth.uid()
        )
    );

-- DELETE: vendor_admin only
CREATE POLICY deal_documents_delete ON deal_documents
    FOR DELETE
    TO authenticated
    USING (get_user_role() = 'vendor_admin');

-- ---------------------------------------------------------------------------
-- DEAL_STATUS_HISTORY
-- ---------------------------------------------------------------------------
ALTER TABLE deal_status_history ENABLE ROW LEVEL SECURITY;

-- SELECT: deal submitter; vendor_admin; partner_admin of org
CREATE POLICY deal_status_history_select ON deal_status_history
    FOR SELECT
    TO authenticated
    USING (
        get_user_role() = 'vendor_admin'
        OR actor_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM deals d
            WHERE d.id = deal_status_history.deal_id
              AND (
                d.submitter_id = auth.uid()
                OR (get_user_role() = 'partner_admin' AND d.organization_id = get_user_org_id())
              )
        )
    );

-- INSERT: authenticated (written by triggers or service layer)
CREATE POLICY deal_status_history_insert ON deal_status_history
    FOR INSERT
    TO authenticated
    WITH CHECK (actor_id = auth.uid() OR get_user_role() = 'vendor_admin');

-- DELETE: vendor_admin only (audit trail should rarely be deleted)
CREATE POLICY deal_status_history_delete ON deal_status_history
    FOR DELETE
    TO authenticated
    USING (get_user_role() = 'vendor_admin');

-- ---------------------------------------------------------------------------
-- ANNOUNCEMENTS
-- ---------------------------------------------------------------------------
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- SELECT: vendor_admin sees all; others see published only
CREATE POLICY announcements_select ON announcements
    FOR SELECT
    TO authenticated
    USING (
        get_user_role() = 'vendor_admin'
        OR is_published = true
    );

CREATE POLICY announcements_insert ON announcements
    FOR INSERT
    TO authenticated
    WITH CHECK (get_user_role() = 'vendor_admin');

CREATE POLICY announcements_update ON announcements
    FOR UPDATE
    TO authenticated
    USING    (get_user_role() = 'vendor_admin')
    WITH CHECK (get_user_role() = 'vendor_admin');

CREATE POLICY announcements_delete ON announcements
    FOR DELETE
    TO authenticated
    USING (get_user_role() = 'vendor_admin');

-- ---------------------------------------------------------------------------
-- ANNOUNCEMENT_READS
-- ---------------------------------------------------------------------------
ALTER TABLE announcement_reads ENABLE ROW LEVEL SECURITY;

-- SELECT: own rows only
CREATE POLICY announcement_reads_select ON announcement_reads
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- INSERT: own rows only
CREATE POLICY announcement_reads_insert ON announcement_reads
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- DELETE: own rows only
CREATE POLICY announcement_reads_delete ON announcement_reads
    FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- AI_EMBEDDINGS
-- ---------------------------------------------------------------------------
ALTER TABLE ai_embeddings ENABLE ROW LEVEL SECURITY;

-- SELECT: all authenticated users (embeddings are used for semantic search)
CREATE POLICY ai_embeddings_select ON ai_embeddings
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY ai_embeddings_insert ON ai_embeddings
    FOR INSERT
    TO authenticated
    WITH CHECK (get_user_role() = 'vendor_admin');

CREATE POLICY ai_embeddings_update ON ai_embeddings
    FOR UPDATE
    TO authenticated
    USING    (get_user_role() = 'vendor_admin')
    WITH CHECK (get_user_role() = 'vendor_admin');

CREATE POLICY ai_embeddings_delete ON ai_embeddings
    FOR DELETE
    TO authenticated
    USING (get_user_role() = 'vendor_admin');

-- ---------------------------------------------------------------------------
-- AUDIT_LOG
-- ---------------------------------------------------------------------------
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- SELECT: vendor_admin only
CREATE POLICY audit_log_select ON audit_log
    FOR SELECT
    TO authenticated
    USING (get_user_role() = 'vendor_admin');

-- INSERT: any authenticated session (trigger / service layer writes)
CREATE POLICY audit_log_insert ON audit_log
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- No UPDATE or DELETE policies — audit log is immutable

-- ---------------------------------------------------------------------------
-- _CERT_NUMBER_STATE (internal helper table — not user-facing)
-- ---------------------------------------------------------------------------
ALTER TABLE _cert_number_state ENABLE ROW LEVEL SECURITY;

-- Only allow access via SECURITY DEFINER functions; block direct user access
CREATE POLICY cert_number_state_select ON _cert_number_state
    FOR SELECT
    TO authenticated
    USING (get_user_role() = 'vendor_admin');

CREATE POLICY cert_number_state_all ON _cert_number_state
    FOR ALL
    TO authenticated
    USING (false)
    WITH CHECK (false);
