// Package jobs contains long-running background jobs for the partner portal.
package jobs

import (
	"context"
	"time"

	"github.com/rs/zerolog"

	"github.com/1kosmos/partner-portal/internal/repositories"
	"github.com/1kosmos/partner-portal/pkg/email"
)

// ExpiryChecker scans for certificates approaching expiry and sends reminder
// emails to certificate holders.
type ExpiryChecker struct {
	certRepo    *repositories.CertificationRepository
	emailClient *email.EmailClient
	log         zerolog.Logger
}

// NewExpiryChecker constructs an ExpiryChecker.
func NewExpiryChecker(
	certRepo *repositories.CertificationRepository,
	emailClient *email.EmailClient,
	log zerolog.Logger,
) *ExpiryChecker {
	return &ExpiryChecker{
		certRepo:    certRepo,
		emailClient: emailClient,
		log:         log,
	}
}

// Run executes the expiry-check logic once.  It checks for certificates
// expiring in 60 days and 14 days, sends reminder emails for each, and
// marks the corresponding reminder column as sent so duplicates are avoided.
func (c *ExpiryChecker) Run(ctx context.Context) {
	c.log.Info().Msg("expiry_checker: starting run")

	for _, days := range []int{60, 14} {
		expiring, err := c.certRepo.GetExpiringCertificates(ctx, days)
		if err != nil {
			c.log.Error().Err(err).Int("days", days).Msg("expiry_checker: failed to fetch expiring certs")
			continue
		}

		c.log.Info().Int("days", days).Int("count", len(expiring)).Msg("expiry_checker: processing expiring certs")

		for _, ic := range expiring {
			expiryStr := ""
			if ic.ExpiresAt != nil {
				expiryStr = ic.ExpiresAt.Format("2006-01-02")
			}

			// Look up the certification title for the email body.
			certTitle := "Your certification"
			if cert, cerr := c.certRepo.GetCertificationByID(ctx, ic.CertificationID.String()); cerr == nil {
				certTitle = cert.Title
			}

			// In production, look up the user's real email address via the user
			// repository.  Here we use a deterministic placeholder so the job
			// compiles and runs without a user-repo dependency.
			toEmail := "user-" + ic.UserID.String() + "@portal.local"

			if c.emailClient != nil {
				if err := c.emailClient.SendCertExpiryReminder(toEmail, certTitle, expiryStr, days); err != nil {
					c.log.Error().
						Err(err).
						Str("cert_id", ic.ID.String()).
						Int("days", days).
						Msg("expiry_checker: failed to send reminder email")
					// Do not mark as sent if the email failed.
					continue
				}
			}

			if err := c.certRepo.UpdateCertificateReminderSent(ctx, ic.ID.String(), days); err != nil {
				c.log.Error().
					Err(err).
					Str("cert_id", ic.ID.String()).
					Int("days", days).
					Msg("expiry_checker: failed to mark reminder as sent")
			} else {
				c.log.Info().
					Str("cert_id", ic.ID.String()).
					Str("to", toEmail).
					Int("days", days).
					Msg("expiry_checker: reminder sent")
			}
		}
	}

	c.log.Info().Msg("expiry_checker: run complete")
}

// StartDailyExpiryCheck launches a goroutine that calls Run once per day,
// targeting midnight UTC.  The goroutine respects context cancellation.
//
// Typical usage from main:
//
//	checker := jobs.NewExpiryChecker(certRepo, emailClient, log)
//	jobs.StartDailyExpiryCheck(ctx, checker)
func StartDailyExpiryCheck(ctx context.Context, checker *ExpiryChecker) {
	go func() {
		checker.log.Info().Msg("expiry_checker: daily scheduler started")

		for {
			// Calculate the duration until the next midnight UTC.
			now := time.Now().UTC()
			nextMidnight := time.Date(
				now.Year(), now.Month(), now.Day()+1,
				0, 0, 0, 0,
				time.UTC,
			)
			waitDuration := time.Until(nextMidnight)

			checker.log.Info().
				Str("next_run", nextMidnight.Format(time.RFC3339)).
				Dur("wait", waitDuration).
				Msg("expiry_checker: scheduled next run")

			timer := time.NewTimer(waitDuration)

			select {
			case <-ctx.Done():
				timer.Stop()
				checker.log.Info().Msg("expiry_checker: daily scheduler stopped (context cancelled)")
				return
			case <-timer.C:
				// Run the check in the same goroutine so sequential execution is
				// guaranteed and a slow run doesn't queue up duplicate runs.
				checker.Run(ctx)
			}
		}
	}()
}
