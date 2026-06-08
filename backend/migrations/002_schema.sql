-- =============================================================================
-- Migration 002: Schema — Tables, Constraints, Indexes
-- Partner Enablement Portal
-- =============================================================================

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------
CREATE TABLE organizations (
    id          uuid        NOT NULL DEFAULT gen_random_uuid(),
    name        text        NOT NULL,
    slug        text        NOT NULL,
    logo_url    text,
    website     text,
    tier        text        NOT NULL DEFAULT 'standard'
                            CHECK (tier IN ('standard', 'silver', 'gold', 'platinum')),
    status      text        NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'suspended', 'pending')),
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT organizations_pkey PRIMARY KEY (id),
    CONSTRAINT organizations_slug_key UNIQUE (slug)
);

-- ---------------------------------------------------------------------------
-- users
-- Maps to Supabase auth.users — id is supplied externally, not generated here
-- ---------------------------------------------------------------------------
CREATE TABLE users (
    id                  uuid        NOT NULL,
    organization_id     uuid,
    email               text        NOT NULL,
    full_name           text        NOT NULL,
    avatar_url          text,
    role                text        NOT NULL
                                    CHECK (role IN ('vendor_admin', 'partner_admin', 'partner_user')),
    title               text,
    phone               text,
    is_active           boolean     NOT NULL DEFAULT true,
    profile_completed   boolean     NOT NULL DEFAULT false,
    last_login_at       timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT users_email_key UNIQUE (email),
    CONSTRAINT users_organization_id_fkey
        FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------------------
-- onboarding_checklist
-- ---------------------------------------------------------------------------
CREATE TABLE onboarding_checklist (
    id                              uuid        NOT NULL DEFAULT gen_random_uuid(),
    organization_id                 uuid        NOT NULL,
    mnda_signed                     boolean     NOT NULL DEFAULT false,
    mnda_signed_at                  timestamptz,
    reseller_agreement_signed       boolean     NOT NULL DEFAULT false,
    reseller_agreement_signed_at    timestamptz,
    account_mapping_done            boolean     NOT NULL DEFAULT false,
    account_mapping_done_at         timestamptz,
    sales_enablement_complete       boolean     NOT NULL DEFAULT false,
    sales_enablement_complete_at    timestamptz,
    technical_enablement_complete   boolean     NOT NULL DEFAULT false,
    technical_enablement_complete_at timestamptz,
    updated_by                      uuid,
    created_at                      timestamptz NOT NULL DEFAULT now(),
    updated_at                      timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT onboarding_checklist_pkey PRIMARY KEY (id),
    CONSTRAINT onboarding_checklist_organization_id_key UNIQUE (organization_id),
    CONSTRAINT onboarding_checklist_organization_id_fkey
        FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
    CONSTRAINT onboarding_checklist_updated_by_fkey
        FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------------------
-- courses
-- ---------------------------------------------------------------------------
CREATE TABLE courses (
    id                      uuid        NOT NULL DEFAULT gen_random_uuid(),
    title                   text        NOT NULL,
    slug                    text        NOT NULL,
    description             text,
    level                   text        NOT NULL
                                        CHECK (level IN ('foundation', 'practitioner', 'expert')),
    duration_minutes        integer     NOT NULL DEFAULT 0,
    thumbnail_url           text,
    is_published            boolean     NOT NULL DEFAULT false,
    prerequisite_course_id  uuid,
    sort_order              integer     NOT NULL DEFAULT 0,
    created_by              uuid,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT courses_pkey PRIMARY KEY (id),
    CONSTRAINT courses_slug_key UNIQUE (slug),
    CONSTRAINT courses_prerequisite_course_id_fkey
        FOREIGN KEY (prerequisite_course_id) REFERENCES courses (id) ON DELETE SET NULL,
    CONSTRAINT courses_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------------------
-- course_vertical_tags
-- ---------------------------------------------------------------------------
CREATE TABLE course_vertical_tags (
    course_id   uuid    NOT NULL,
    tag         text    NOT NULL
                        CHECK (tag IN ('financial_services', 'healthcare', 'government',
                                       'retail', 'manufacturing', 'general')),

    CONSTRAINT course_vertical_tags_pkey PRIMARY KEY (course_id, tag),
    CONSTRAINT course_vertical_tags_course_id_fkey
        FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------------
-- lessons
-- ---------------------------------------------------------------------------
CREATE TABLE lessons (
    id              uuid        NOT NULL DEFAULT gen_random_uuid(),
    course_id       uuid        NOT NULL,
    title           text        NOT NULL,
    type            text        NOT NULL CHECK (type IN ('video', 'pdf')),
    content_url     text        NOT NULL,
    duration_minutes integer    NOT NULL DEFAULT 0,
    sort_order      integer     NOT NULL DEFAULT 0,
    is_required     boolean     NOT NULL DEFAULT true,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT lessons_pkey PRIMARY KEY (id),
    CONSTRAINT lessons_course_id_fkey
        FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------------
-- prework_assignments
-- ---------------------------------------------------------------------------
CREATE TABLE prework_assignments (
    id          uuid        NOT NULL DEFAULT gen_random_uuid(),
    course_id   uuid        NOT NULL,
    title       text        NOT NULL,
    description text        NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT prework_assignments_pkey PRIMARY KEY (id),
    CONSTRAINT prework_assignments_course_id_key UNIQUE (course_id),
    CONSTRAINT prework_assignments_course_id_fkey
        FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------------
-- prework_submissions
-- ---------------------------------------------------------------------------
CREATE TABLE prework_submissions (
    id              uuid        NOT NULL DEFAULT gen_random_uuid(),
    assignment_id   uuid        NOT NULL,
    user_id         uuid        NOT NULL,
    content         text        NOT NULL,
    submitted_at    timestamptz NOT NULL DEFAULT now(),
    reviewed        boolean     NOT NULL DEFAULT false,
    reviewed_by     uuid,
    reviewed_at     timestamptz,

    CONSTRAINT prework_submissions_pkey PRIMARY KEY (id),
    CONSTRAINT prework_submissions_assignment_user_key UNIQUE (assignment_id, user_id),
    CONSTRAINT prework_submissions_assignment_id_fkey
        FOREIGN KEY (assignment_id) REFERENCES prework_assignments (id) ON DELETE CASCADE,
    CONSTRAINT prework_submissions_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT prework_submissions_reviewed_by_fkey
        FOREIGN KEY (reviewed_by) REFERENCES users (id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------------------
-- lesson_progress
-- ---------------------------------------------------------------------------
CREATE TABLE lesson_progress (
    id           uuid        NOT NULL DEFAULT gen_random_uuid(),
    user_id      uuid        NOT NULL,
    lesson_id    uuid        NOT NULL,
    completed_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT lesson_progress_pkey PRIMARY KEY (id),
    CONSTRAINT lesson_progress_user_lesson_key UNIQUE (user_id, lesson_id),
    CONSTRAINT lesson_progress_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT lesson_progress_lesson_id_fkey
        FOREIGN KEY (lesson_id) REFERENCES lessons (id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------------
-- certifications
-- ---------------------------------------------------------------------------
CREATE TABLE certifications (
    id              uuid        NOT NULL DEFAULT gen_random_uuid(),
    title           text        NOT NULL,
    slug            text        NOT NULL,
    description     text,
    type            text        NOT NULL CHECK (type IN ('sales', 'technical')),
    validity_months integer     NOT NULL DEFAULT 12,
    passing_score   integer     NOT NULL DEFAULT 70,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT certifications_pkey PRIMARY KEY (id),
    CONSTRAINT certifications_slug_key UNIQUE (slug)
);

-- ---------------------------------------------------------------------------
-- certification_course_requirements
-- ---------------------------------------------------------------------------
CREATE TABLE certification_course_requirements (
    certification_id    uuid    NOT NULL,
    course_id           uuid    NOT NULL,

    CONSTRAINT certification_course_requirements_pkey PRIMARY KEY (certification_id, course_id),
    CONSTRAINT ccr_certification_id_fkey
        FOREIGN KEY (certification_id) REFERENCES certifications (id) ON DELETE CASCADE,
    CONSTRAINT ccr_course_id_fkey
        FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------------
-- assessment_schedules
-- ---------------------------------------------------------------------------
CREATE TABLE assessment_schedules (
    id                  uuid        NOT NULL DEFAULT gen_random_uuid(),
    certification_id    uuid        NOT NULL,
    user_id             uuid        NOT NULL,
    requested_date      date        NOT NULL,
    confirmed_date      date,
    status              text        NOT NULL DEFAULT 'pending'
                                    CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
    notes               text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT assessment_schedules_pkey PRIMARY KEY (id),
    CONSTRAINT assessment_schedules_certification_id_fkey
        FOREIGN KEY (certification_id) REFERENCES certifications (id) ON DELETE RESTRICT,
    CONSTRAINT assessment_schedules_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------------
-- assessment_results
-- ---------------------------------------------------------------------------
CREATE TABLE assessment_results (
    id                      uuid        NOT NULL DEFAULT gen_random_uuid(),
    assessment_schedule_id  uuid        NOT NULL,
    user_id                 uuid        NOT NULL,
    score                   integer     NOT NULL,
    passed                  boolean     NOT NULL,
    evaluated_by            uuid        NOT NULL,
    completed_at            timestamptz NOT NULL DEFAULT now(),
    notes                   text,

    CONSTRAINT assessment_results_pkey PRIMARY KEY (id),
    CONSTRAINT assessment_results_schedule_id_fkey
        FOREIGN KEY (assessment_schedule_id) REFERENCES assessment_schedules (id) ON DELETE RESTRICT,
    CONSTRAINT assessment_results_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT assessment_results_evaluated_by_fkey
        FOREIGN KEY (evaluated_by) REFERENCES users (id) ON DELETE RESTRICT
);

-- ---------------------------------------------------------------------------
-- issued_certificates
-- ---------------------------------------------------------------------------
CREATE TABLE issued_certificates (
    id                  uuid        NOT NULL DEFAULT gen_random_uuid(),
    cert_number         text        NOT NULL,
    user_id             uuid        NOT NULL,
    certification_id    uuid        NOT NULL,
    issued_at           timestamptz NOT NULL DEFAULT now(),
    expires_at          timestamptz NOT NULL,
    pdf_url             text,
    is_revoked          boolean     NOT NULL DEFAULT false,
    revoked_at          timestamptz,
    revoked_by          uuid,
    reminder_60_sent    boolean     NOT NULL DEFAULT false,
    reminder_14_sent    boolean     NOT NULL DEFAULT false,

    CONSTRAINT issued_certificates_pkey PRIMARY KEY (id),
    CONSTRAINT issued_certificates_cert_number_key UNIQUE (cert_number),
    CONSTRAINT issued_certificates_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT issued_certificates_certification_id_fkey
        FOREIGN KEY (certification_id) REFERENCES certifications (id) ON DELETE RESTRICT,
    CONSTRAINT issued_certificates_revoked_by_fkey
        FOREIGN KEY (revoked_by) REFERENCES users (id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------------------
-- resources
-- ---------------------------------------------------------------------------
CREATE TABLE resources (
    id              uuid        NOT NULL DEFAULT gen_random_uuid(),
    title           text        NOT NULL,
    description     text,
    type            text        NOT NULL
                                CHECK (type IN ('datasheet', 'battlecard', 'demo_script',
                                                'competitive_comparison', 'case_study',
                                                'poc_success_criteria')),
    language        text        NOT NULL DEFAULT 'en',
    file_url        text        NOT NULL,
    version         text        NOT NULL DEFAULT '1.0',
    is_published    boolean     NOT NULL DEFAULT true,
    uploaded_by     uuid,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    search_vector   tsvector    GENERATED ALWAYS AS (
                        to_tsvector('english',
                            coalesce(title, '') || ' ' || coalesce(description, ''))
                    ) STORED,

    CONSTRAINT resources_pkey PRIMARY KEY (id),
    CONSTRAINT resources_uploaded_by_fkey
        FOREIGN KEY (uploaded_by) REFERENCES users (id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------------------
-- resource_vertical_tags
-- ---------------------------------------------------------------------------
CREATE TABLE resource_vertical_tags (
    resource_id uuid    NOT NULL,
    tag         text    NOT NULL
                        CHECK (tag IN ('financial_services', 'healthcare', 'government',
                                       'retail', 'manufacturing', 'general')),

    CONSTRAINT resource_vertical_tags_pkey PRIMARY KEY (resource_id, tag),
    CONSTRAINT resource_vertical_tags_resource_id_fkey
        FOREIGN KEY (resource_id) REFERENCES resources (id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------------
-- deals
-- ---------------------------------------------------------------------------
CREATE TABLE deals (
    id                      uuid            NOT NULL DEFAULT gen_random_uuid(),
    submitter_id            uuid            NOT NULL,
    organization_id         uuid            NOT NULL,
    company_name            text            NOT NULL,
    contact_name            text            NOT NULL,
    contact_email           text            NOT NULL,
    vertical                text            NOT NULL
                                            CHECK (vertical IN ('financial_services', 'healthcare',
                                                                'government', 'retail',
                                                                'manufacturing', 'other')),
    opportunity_value_usd   numeric(12, 2)  NOT NULL,
    expected_close_date     date            NOT NULL,
    competing_vendors       text[],
    notes                   text,
    status                  text            NOT NULL DEFAULT 'draft'
                                            CHECK (status IN ('draft', 'submitted', 'under_review',
                                                              'approved', 'rejected')),
    reviewer_id             uuid,
    reviewer_comment        text,
    created_at              timestamptz     NOT NULL DEFAULT now(),
    updated_at              timestamptz     NOT NULL DEFAULT now(),

    CONSTRAINT deals_pkey PRIMARY KEY (id),
    CONSTRAINT deals_submitter_id_fkey
        FOREIGN KEY (submitter_id) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT deals_organization_id_fkey
        FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT,
    CONSTRAINT deals_reviewer_id_fkey
        FOREIGN KEY (reviewer_id) REFERENCES users (id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------------------
-- deal_documents
-- ---------------------------------------------------------------------------
CREATE TABLE deal_documents (
    id          uuid        NOT NULL DEFAULT gen_random_uuid(),
    deal_id     uuid        NOT NULL,
    file_name   text        NOT NULL,
    file_url    text        NOT NULL,
    uploaded_by uuid        NOT NULL,
    uploaded_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT deal_documents_pkey PRIMARY KEY (id),
    CONSTRAINT deal_documents_deal_id_fkey
        FOREIGN KEY (deal_id) REFERENCES deals (id) ON DELETE CASCADE,
    CONSTRAINT deal_documents_uploaded_by_fkey
        FOREIGN KEY (uploaded_by) REFERENCES users (id) ON DELETE RESTRICT
);

-- ---------------------------------------------------------------------------
-- deal_status_history
-- ---------------------------------------------------------------------------
CREATE TABLE deal_status_history (
    id          uuid        NOT NULL DEFAULT gen_random_uuid(),
    deal_id     uuid        NOT NULL,
    from_status text,
    to_status   text        NOT NULL,
    actor_id    uuid        NOT NULL,
    comment     text,
    created_at  timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT deal_status_history_pkey PRIMARY KEY (id),
    CONSTRAINT deal_status_history_deal_id_fkey
        FOREIGN KEY (deal_id) REFERENCES deals (id) ON DELETE CASCADE,
    CONSTRAINT deal_status_history_actor_id_fkey
        FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE RESTRICT
);

-- ---------------------------------------------------------------------------
-- announcements
-- ---------------------------------------------------------------------------
CREATE TABLE announcements (
    id              uuid        NOT NULL DEFAULT gen_random_uuid(),
    title           text        NOT NULL,
    body_html       text        NOT NULL,
    type            text        NOT NULL
                                CHECK (type IN ('vendor_news', 'product_update', 'security_advisory')),
    is_pinned       boolean     NOT NULL DEFAULT false,
    is_published    boolean     NOT NULL DEFAULT true,
    created_by      uuid,
    published_at    timestamptz NOT NULL DEFAULT now(),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT announcements_pkey PRIMARY KEY (id),
    CONSTRAINT announcements_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------------------
-- announcement_reads
-- ---------------------------------------------------------------------------
CREATE TABLE announcement_reads (
    user_id         uuid        NOT NULL,
    announcement_id uuid        NOT NULL,
    read_at         timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT announcement_reads_pkey PRIMARY KEY (user_id, announcement_id),
    CONSTRAINT announcement_reads_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT announcement_reads_announcement_id_fkey
        FOREIGN KEY (announcement_id) REFERENCES announcements (id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------------
-- ai_embeddings
-- ---------------------------------------------------------------------------
CREATE TABLE ai_embeddings (
    id          uuid        NOT NULL DEFAULT gen_random_uuid(),
    source_type text        NOT NULL CHECK (source_type IN ('course', 'lesson', 'resource')),
    source_id   uuid        NOT NULL,
    chunk_text  text        NOT NULL,
    embedding   vector(1536),
    created_at  timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT ai_embeddings_pkey PRIMARY KEY (id)
);

-- ---------------------------------------------------------------------------
-- audit_log
-- ---------------------------------------------------------------------------
CREATE TABLE audit_log (
    id              uuid        NOT NULL DEFAULT gen_random_uuid(),
    actor_id        uuid,
    action          text        NOT NULL,
    resource_type   text        NOT NULL,
    resource_id     uuid,
    metadata        jsonb       NOT NULL DEFAULT '{}',
    ip_address      inet,
    created_at      timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT audit_log_pkey PRIMARY KEY (id)
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- users
CREATE INDEX idx_users_email           ON users (email);
CREATE INDEX idx_users_organization_id ON users (organization_id);
CREATE INDEX idx_users_role            ON users (role);

-- courses
CREATE INDEX idx_courses_slug        ON courses (slug);
CREATE INDEX idx_courses_is_published ON courses (is_published);
CREATE INDEX idx_courses_sort_order  ON courses (sort_order);

-- lessons
CREATE INDEX idx_lessons_course_id   ON lessons (course_id);
CREATE INDEX idx_lessons_sort_order  ON lessons (sort_order);

-- lesson_progress
CREATE INDEX idx_lesson_progress_user_id  ON lesson_progress (user_id);
CREATE INDEX idx_lesson_progress_lesson_id ON lesson_progress (lesson_id);

-- resources
CREATE INDEX idx_resources_type         ON resources (type);
CREATE INDEX idx_resources_is_published ON resources (is_published);
CREATE INDEX idx_resources_search_vector ON resources USING GIN (search_vector);

-- deals
CREATE INDEX idx_deals_submitter_id    ON deals (submitter_id);
CREATE INDEX idx_deals_organization_id ON deals (organization_id);
CREATE INDEX idx_deals_status          ON deals (status);

-- announcements
CREATE INDEX idx_announcements_is_published ON announcements (is_published);
CREATE INDEX idx_announcements_is_pinned    ON announcements (is_pinned);
CREATE INDEX idx_announcements_published_at ON announcements (published_at DESC);

-- ai_embeddings — IVFFlat index for cosine similarity search
-- lists=100 is a reasonable default; tune based on row count
CREATE INDEX idx_ai_embeddings_embedding
    ON ai_embeddings
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- audit_log
CREATE INDEX idx_audit_log_actor_id      ON audit_log (actor_id);
CREATE INDEX idx_audit_log_resource_type ON audit_log (resource_type);
CREATE INDEX idx_audit_log_created_at    ON audit_log (created_at DESC);
