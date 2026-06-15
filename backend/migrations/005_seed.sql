-- =============================================================================
-- Migration 005: Seed Data
-- Partner Enablement Portal
-- =============================================================================
-- All inserts are wrapped in a single transaction.
-- Fixed UUIDs are used throughout for referential consistency.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Fixed UUID constants (used as references throughout this file)
-- ---------------------------------------------------------------------------
-- Organization
--   TechForce Solutions : 'a0000000-0000-0000-0000-000000000001'
-- Users
--   vendor_admin        : '00000000-0000-0000-0000-000000000001'
--   partner_admin       : '00000000-0000-0000-0000-000000000002'
--   partner_user        : '00000000-0000-0000-0000-000000000003'
-- Courses
--   session-1-demo      : 'c0000000-0000-0000-0000-000000000001'
--   session-2-advanced  : 'c0000000-0000-0000-0000-000000000002'
-- Certifications
--   sales-cert          : 'ce000000-0000-0000-0000-000000000001'
--   technical-cert      : 'ce000000-0000-0000-0000-000000000002'
-- Resources (r1–r6)
--   datasheet           : 'f1000000-0000-0000-0000-000000000001'
--   battlecard          : 'f1000000-0000-0000-0000-000000000002'
--   demo_script         : 'f1000000-0000-0000-0000-000000000003'
--   competitive         : 'f1000000-0000-0000-0000-000000000004'
--   case_study          : 'f1000000-0000-0000-0000-000000000005'
--   poc_success_crit    : 'f1000000-0000-0000-0000-000000000006'
-- Deals
--   meridian (approved) : 'd0000000-0000-0000-0000-000000000001'
--   pacific  (submitted): 'd0000000-0000-0000-0000-000000000002'
-- Announcements
--   platform 4.2        : 'ab000000-0000-0000-0000-000000000001'
--   battlecard news     : 'ab000000-0000-0000-0000-000000000002'

-- ===========================================================================
-- 1. ORGANIZATION
-- ===========================================================================
INSERT INTO organizations (id, name, slug, tier, status, created_at, updated_at)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'TechForce Solutions',
    'techforce-solutions',
    'gold',
    'active',
    now(),
    now()
);

-- ===========================================================================
-- 2. USERS
-- ===========================================================================
-- vendor_admin (no organization)
INSERT INTO users (id, organization_id, email, full_name, role, is_active, profile_completed, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    NULL,
    'admin@1kosmos.com',
    'Sarah Chen',
    'vendor_admin',
    true,
    true,
    now(),
    now()
);

-- partner_admin (TechForce Solutions)
INSERT INTO users (id, organization_id, email, full_name, role, is_active, profile_completed, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000001',
    'admin@techforce.com',
    'James Rodriguez',
    'partner_admin',
    true,
    true,
    now(),
    now()
);

-- partner_user (TechForce Solutions)
INSERT INTO users (id, organization_id, email, full_name, role, is_active, profile_completed, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000001',
    'engineer@techforce.com',
    'Priya Patel',
    'partner_user',
    true,
    true,
    now(),
    now()
);

-- ===========================================================================
-- 3. ONBOARDING CHECKLIST
-- ===========================================================================
INSERT INTO onboarding_checklist (
    id,
    organization_id,
    mnda_signed,
    mnda_signed_at,
    reseller_agreement_signed,
    reseller_agreement_signed_at,
    account_mapping_done,
    account_mapping_done_at,
    sales_enablement_complete,
    sales_enablement_complete_at,
    technical_enablement_complete,
    technical_enablement_complete_at,
    updated_by,
    created_at,
    updated_at
)
VALUES (
    gen_random_uuid(),
    'a0000000-0000-0000-0000-000000000001',
    true,
    '2024-01-15 00:00:00+00',
    true,
    '2024-01-20 00:00:00+00',
    false,
    NULL,
    false,
    NULL,
    false,
    NULL,
    '00000000-0000-0000-0000-000000000001',
    now(),
    now()
);

-- ===========================================================================
-- 4. COURSES
-- ===========================================================================

-- Course 1: Session 1 — Demo, Tenant Walkthrough & Architecture
INSERT INTO courses (
    id, title, slug, description, level, duration_minutes,
    is_published, prerequisite_course_id, sort_order,
    created_by, created_at, updated_at
)
VALUES (
    'c0000000-0000-0000-0000-000000000001',
    'Session 1 — Demo, Tenant Walkthrough & Architecture',
    'session-1-demo',
    'An end-to-end introduction to the 1Kosmos platform: the 9-step identity-proofing demo, live AdminX tenant walkthrough, enrollment and authentication flows, architecture deep-dive, and integration patterns.',
    'practitioner',
    210,
    true,
    NULL,
    1,
    '00000000-0000-0000-0000-000000000001',
    now(),
    now()
);

-- Course 1 vertical tag
INSERT INTO course_vertical_tags (course_id, tag)
VALUES ('c0000000-0000-0000-0000-000000000001', 'general');

-- Course 1 Lessons
INSERT INTO lessons (id, course_id, title, type, content_url, duration_minutes, sort_order, is_required, created_at, updated_at)
VALUES
    (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000001',
     'Welcome & Session Overview',
     'video', '/storage/courses/session-1/01-welcome-overview.mp4', 10, 1, true, now(), now()),

    (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000001',
     'The 9-Step Demo: Identity Proofing to Access',
     'video', '/storage/courses/session-1/02-9-step-demo.mp4', 30, 2, true, now(), now()),

    (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000001',
     'Live Tenant Walkthrough: AdminX Portal',
     'video', '/storage/courses/session-1/03-adminx-walkthrough.mp4', 25, 3, true, now(), now()),

    (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000001',
     'Enrollment Flows: Mobile & Desktop',
     'video', '/storage/courses/session-1/04-enrollment-flows.mp4', 20, 4, true, now(), now()),

    (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000001',
     'Authentication Flows: FIDO2, Biometrics, MFA',
     'video', '/storage/courses/session-1/05-authentication-flows.mp4', 25, 5, true, now(), now()),

    (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000001',
     'Architecture Deep Dive: Components & Data Flow',
     'pdf', '/storage/courses/session-1/06-architecture-deep-dive.pdf', 30, 6, true, now(), now()),

    (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000001',
     'Zero Trust Reference Architecture',
     'pdf', '/storage/courses/session-1/07-zero-trust-reference-arch.pdf', 20, 7, true, now(), now()),

    (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000001',
     'Integration Patterns Overview',
     'video', '/storage/courses/session-1/08-integration-patterns.mp4', 30, 8, true, now(), now()),

    (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000001',
     'Session 1 Q&A and Wrap-up',
     'video', '/storage/courses/session-1/09-qa-wrapup.mp4', 20, 9, true, now(), now());

-- Course 1 Pre-work
INSERT INTO prework_assignments (id, course_id, title, description, created_at)
VALUES (
    gen_random_uuid(),
    'c0000000-0000-0000-0000-000000000001',
    'Pre-Session 1 Reading',
    'Review the 1Kosmos Platform Overview datasheet and the FIDO2 Alliance whitepaper. Submit a 200-word summary of how passwordless authentication addresses modern identity threats.',
    now()
);

-- -----------------------------------------------
-- Course 2: Session 2 — Advanced Components, Objections & POC Scoping
-- -----------------------------------------------
INSERT INTO courses (
    id, title, slug, description, level, duration_minutes,
    is_published, prerequisite_course_id, sort_order,
    created_by, created_at, updated_at
)
VALUES (
    'c0000000-0000-0000-0000-000000000002',
    'Session 2 — Advanced Components, Objections & POC Scoping',
    'session-2-advanced',
    'Advanced enablement covering OIDC/SAML integrations, Microsoft Entra Model 1 vs 2, objection-handling playbooks for Microsoft E5 and CrowdStrike, biometric data privacy Q&A, and a hands-on POC scoping workshop.',
    'expert',
    185,
    true,
    'c0000000-0000-0000-0000-000000000001',   -- prerequisite: Course 1
    2,
    '00000000-0000-0000-0000-000000000001',
    now(),
    now()
);

-- Course 2 vertical tag
INSERT INTO course_vertical_tags (course_id, tag)
VALUES ('c0000000-0000-0000-0000-000000000002', 'general');

-- Course 2 Lessons
INSERT INTO lessons (id, course_id, title, type, content_url, duration_minutes, sort_order, is_required, created_at, updated_at)
VALUES
    (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000002',
     'OIDC & SAML Integration Scenarios',
     'video', '/storage/courses/session-2/01-oidc-saml-integrations.mp4', 25, 1, true, now(), now()),

    (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000002',
     'Microsoft Entra Model 1 vs Model 2 Deep Dive',
     'video', '/storage/courses/session-2/02-entra-model1-vs-model2.mp4', 30, 2, true, now(), now()),

    (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000002',
     'Objection Handling: Microsoft E5 Overlap',
     'video', '/storage/courses/session-2/03-objection-e5-overlap.mp4', 20, 3, true, now(), now()),

    (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000002',
     'Objection Handling: Integration Complexity & CrowdStrike Comparison',
     'video', '/storage/courses/session-2/04-objection-crowdstrike.mp4', 20, 4, true, now(), now()),

    (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000002',
     'Biometric Data Storage: Privacy & Security Q&A',
     'pdf', '/storage/courses/session-2/05-biometric-privacy-qa.pdf', 15, 5, true, now(), now()),

    (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000002',
     'POC Scoping Workshop Framework',
     'pdf', '/storage/courses/session-2/06-poc-scoping-framework.pdf', 25, 6, true, now(), now()),

    (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000002',
     'Building Your POC Success Criteria',
     'video', '/storage/courses/session-2/07-poc-success-criteria.mp4', 25, 7, true, now(), now()),

    (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000002',
     'Session 2 Assessment Prep & Wrap-up',
     'video', '/storage/courses/session-2/08-assessment-prep-wrapup.mp4', 25, 8, true, now(), now());

-- ===========================================================================
-- 5. CERTIFICATIONS
-- ===========================================================================

-- Sales Certification (requires Course 1)
INSERT INTO certifications (id, title, slug, description, type, validity_months, passing_score, created_at, updated_at)
VALUES (
    'ce000000-0000-0000-0000-000000000001',
    '1Kosmos Sales Certification',
    'sales-cert',
    'Validates the ability to position, demo, and sell the 1Kosmos platform to enterprise prospects across all verticals.',
    'sales',
    12,
    70,
    now(),
    now()
);

INSERT INTO certification_course_requirements (certification_id, course_id)
VALUES ('ce000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001');

-- Technical Certification (requires Course 1 + Course 2)
INSERT INTO certifications (id, title, slug, description, type, validity_months, passing_score, created_at, updated_at)
VALUES (
    'ce000000-0000-0000-0000-000000000002',
    '1Kosmos Technical Certification',
    'technical-cert',
    'Validates deep technical knowledge of 1Kosmos architecture, integrations, objection handling, and POC delivery.',
    'technical',
    12,
    80,
    now(),
    now()
);

INSERT INTO certification_course_requirements (certification_id, course_id)
VALUES
    ('ce000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001'),
    ('ce000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002');

-- ===========================================================================
-- 6. RESOURCES
-- ===========================================================================

INSERT INTO resources (id, title, description, type, language, file_url, version, is_published, uploaded_by, created_at, updated_at)
VALUES
    (
        'f1000000-0000-0000-0000-000000000001',
        '1Kosmos Platform Datasheet',
        'Overview of the 1Kosmos BlockID platform, capabilities, and key differentiators.',
        'datasheet',
        'en',
        '/storage/resources/1kosmos-platform-datasheet-v2.1.pdf',
        '2.1',
        true,
        '00000000-0000-0000-0000-000000000001',
        now(), now()
    ),
    (
        'f1000000-0000-0000-0000-000000000002',
        'vs Microsoft Entra ID Battlecard',
        'Head-to-head comparison of 1Kosmos BlockID vs Microsoft Entra ID for sales conversations.',
        'battlecard',
        'en',
        '/storage/resources/battlecard-vs-entra.pdf',
        '1.0',
        true,
        '00000000-0000-0000-0000-000000000001',
        now(), now()
    ),
    (
        'f1000000-0000-0000-0000-000000000003',
        'Standard 45-Minute Demo Script',
        'Step-by-step script for delivering the standard 1Kosmos platform demonstration to enterprise prospects.',
        'demo_script',
        'en',
        '/storage/resources/demo-script-standard.pdf',
        '1.2',
        true,
        '00000000-0000-0000-0000-000000000001',
        now(), now()
    ),
    (
        'f1000000-0000-0000-0000-000000000004',
        'CrowdStrike vs 1Kosmos Competitive Analysis',
        'Detailed competitive analysis comparing CrowdStrike Falcon Identity Protection and 1Kosmos BlockID.',
        'competitive_comparison',
        'en',
        '/storage/resources/competitive-crowdstrike.pdf',
        '1.0',
        true,
        '00000000-0000-0000-0000-000000000001',
        now(), now()
    ),
    (
        'f1000000-0000-0000-0000-000000000005',
        'Financial Services Identity Case Study',
        'How a Tier-1 financial institution deployed 1Kosmos BlockID to eliminate password-based breaches.',
        'case_study',
        'en',
        '/storage/resources/case-study-finserv.pdf',
        '1.0',
        true,
        '00000000-0000-0000-0000-000000000001',
        now(), now()
    ),
    (
        'f1000000-0000-0000-0000-000000000006',
        'Enterprise POC Success Criteria Checklist',
        'Structured checklist for scoping, executing, and evaluating a 1Kosmos proof of concept engagement.',
        'poc_success_criteria',
        'en',
        '/storage/resources/poc-success-criteria.pdf',
        '1.1',
        true,
        '00000000-0000-0000-0000-000000000001',
        now(), now()
    );

-- Resource vertical tags
INSERT INTO resource_vertical_tags (resource_id, tag)
VALUES
    ('f1000000-0000-0000-0000-000000000001', 'general'),
    ('f1000000-0000-0000-0000-000000000002', 'general'),
    ('f1000000-0000-0000-0000-000000000003', 'general'),
    ('f1000000-0000-0000-0000-000000000004', 'general'),
    ('f1000000-0000-0000-0000-000000000005', 'financial_services'),
    ('f1000000-0000-0000-0000-000000000006', 'general');

-- ===========================================================================
-- 7. DEALS
-- ===========================================================================

-- Deal 1: Meridian Health Systems — approved
INSERT INTO deals (
    id, submitter_id, organization_id,
    company_name, contact_name, contact_email,
    vertical, opportunity_value_usd, expected_close_date,
    competing_vendors, notes, status, reviewer_id, reviewer_comment,
    created_at, updated_at
)
VALUES (
    'd0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000003',   -- partner_user
    'a0000000-0000-0000-0000-000000000001',   -- TechForce Solutions
    'Meridian Health Systems',
    'Dr. Amanda Foster',
    'amanda.foster@meridian.health',
    'healthcare',
    125000.00,
    '2024-04-30',
    ARRAY['Microsoft Entra', 'Okta'],
    NULL,
    'approved',
    '00000000-0000-0000-0000-000000000001',   -- vendor_admin
    'Strong healthcare vertical fit, clean financials.',
    now() - interval '30 days',
    now() - interval '10 days'
);

-- Deal 2: Pacific Coast Credit Union — submitted
INSERT INTO deals (
    id, submitter_id, organization_id,
    company_name, contact_name, contact_email,
    vertical, opportunity_value_usd, expected_close_date,
    competing_vendors, notes, status,
    created_at, updated_at
)
VALUES (
    'd0000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000003',   -- partner_user
    'a0000000-0000-0000-0000-000000000001',   -- TechForce Solutions
    'Pacific Coast Credit Union',
    'Mark Williams',
    'mwilliams@pccu.org',
    'financial_services',
    85000.00,
    '2024-05-15',
    ARRAY['Ping Identity'],
    NULL,
    'submitted',
    now() - interval '5 days',
    now() - interval '5 days'
);

-- ===========================================================================
-- 8. ANNOUNCEMENTS
-- ===========================================================================

INSERT INTO announcements (
    id, title, body_html, type, is_pinned, is_published,
    created_by, published_at, created_at, updated_at
)
VALUES
    (
        'ab000000-0000-0000-0000-000000000001',
        '1Kosmos Platform 4.2 Released',
        '<h2>Platform 4.2 Highlights</h2><ul><li>Enhanced FIDO2 device attestation</li><li>New AdminX dashboard with real-time analytics</li><li>SCIM 2.0 provisioning for major IdPs</li></ul><p>Update your demo tenants before your next customer engagement.</p>',
        'product_update',
        true,
        true,
        '00000000-0000-0000-0000-000000000001',
        now() - interval '7 days',
        now() - interval '7 days',
        now() - interval '7 days'
    ),
    (
        'ab000000-0000-0000-0000-000000000002',
        'New Competitive Battlecard: vs CrowdStrike Falcon Identity',
        '<p>The updated battlecard covers the latest CrowdStrike Falcon Identity features and our differentiation on biometric-grade authentication. Available in the Resource Center.</p>',
        'vendor_news',
        false,
        true,
        '00000000-0000-0000-0000-000000000001',
        now() - interval '3 days',
        now() - interval '3 days',
        now() - interval '3 days'
    );

-- ===========================================================================
-- 9. DEAL STATUS HISTORY — Deal 1 (Meridian)
-- ===========================================================================

-- Transition 1: draft → submitted (actor = partner_user)
INSERT INTO deal_status_history (id, deal_id, from_status, to_status, actor_id, comment, created_at)
VALUES (
    gen_random_uuid(),
    'd0000000-0000-0000-0000-000000000001',
    'draft',
    'submitted',
    '00000000-0000-0000-0000-000000000003',
    NULL,
    now() - interval '28 days'
);

-- Transition 2: submitted → under_review (actor = vendor_admin)
INSERT INTO deal_status_history (id, deal_id, from_status, to_status, actor_id, comment, created_at)
VALUES (
    gen_random_uuid(),
    'd0000000-0000-0000-0000-000000000001',
    'submitted',
    'under_review',
    '00000000-0000-0000-0000-000000000001',
    NULL,
    now() - interval '20 days'
);

-- Transition 3: under_review → approved (actor = vendor_admin)
INSERT INTO deal_status_history (id, deal_id, from_status, to_status, actor_id, comment, created_at)
VALUES (
    gen_random_uuid(),
    'd0000000-0000-0000-0000-000000000001',
    'under_review',
    'approved',
    '00000000-0000-0000-0000-000000000001',
    'Strong healthcare vertical fit, clean financials.',
    now() - interval '10 days'
);

COMMIT;
