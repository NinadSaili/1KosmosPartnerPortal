// Package email provides a thin wrapper around the SendGrid v3 API for
// transactional email delivery.
package email

import (
	"fmt"

	sendgrid "github.com/sendgrid/sendgrid-go"
	"github.com/sendgrid/sendgrid-go/helpers/mail"
)

// EmailClient wraps the SendGrid client and stores the default sender address.
type EmailClient struct {
	client    *sendgrid.Client
	fromEmail string
	fromName  string
}

// NewEmailClient constructs an EmailClient using the provided SendGrid API key
// and sender address.
func NewEmailClient(apiKey, fromEmail string) *EmailClient {
	return &EmailClient{
		client:    sendgrid.NewSendClient(apiKey),
		fromEmail: fromEmail,
		fromName:  "1Kosmos Partner Portal",
	}
}

// SendEmail sends a single HTML email.
//
//   - to        – recipient email address.
//   - subject   – email subject line.
//   - htmlBody  – full HTML body; a plain-text version is derived automatically.
func (e *EmailClient) SendEmail(to, subject, htmlBody string) error {
	from := mail.NewEmail(e.fromName, e.fromEmail)
	recipient := mail.NewEmail("", to)

	message := mail.NewSingleEmail(from, subject, recipient, stripHTML(htmlBody), htmlBody)
	message.SetMailSettings(&mail.MailSettings{
		SandboxMode: &mail.Setting{Enable: boolPtr(false)},
	})

	resp, err := e.client.Send(message)
	if err != nil {
		return fmt.Errorf("email: send: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("email: send: unexpected status %d: %s", resp.StatusCode, resp.Body)
	}
	return nil
}

// SendDealStatusNotification sends an email to a partner contact informing
// them of a change in deal status.
func (e *EmailClient) SendDealStatusNotification(to, dealCompanyName, newStatus, comment string) error {
	commentSection := ""
	if comment != "" {
		commentSection = fmt.Sprintf(`<p><strong>Comment:</strong> %s</p>`, comment)
	}

	html := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px">
  <div style="background:#0f1f3d;padding:20px;text-align:center;border-radius:8px 8px 0 0">
    <h1 style="color:#fff;margin:0;font-size:22px">1Kosmos Partner Portal</h1>
  </div>
  <div style="border:1px solid #ddd;border-top:none;padding:30px;border-radius:0 0 8px 8px">
    <h2 style="color:#0f1f3d">Deal Status Update</h2>
    <p>The status of your deal registration for <strong>%s</strong> has been updated.</p>
    <div style="background:#f5f7fa;padding:15px;border-left:4px solid #0f1f3d;margin:20px 0">
      <p style="margin:0"><strong>New Status:</strong>
        <span style="color:#0066cc;font-weight:bold">%s</span>
      </p>
    </div>
    %s
    <p>Please log in to the Partner Portal for more details.</p>
    <p style="color:#999;font-size:12px;margin-top:30px">
      This is an automated message from the 1Kosmos Partner Portal.
      Please do not reply to this email.
    </p>
  </div>
</body>
</html>`, dealCompanyName, newStatus, commentSection)

	subject := fmt.Sprintf("Deal Status Update: %s — %s", dealCompanyName, newStatus)
	return e.SendEmail(to, subject, html)
}

// SendCertExpiryReminder sends a reminder email when a certificate is
// approaching its expiry date.
func (e *EmailClient) SendCertExpiryReminder(to, certName, expiryDate string, daysLeft int) error {
	urgencyColor := "#0066cc"
	urgencyText := "upcoming"
	if daysLeft <= 7 {
		urgencyColor = "#cc0000"
		urgencyText = "URGENT"
	} else if daysLeft <= 30 {
		urgencyColor = "#ff6600"
		urgencyText = "soon"
	}

	html := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px">
  <div style="background:#0f1f3d;padding:20px;text-align:center;border-radius:8px 8px 0 0">
    <h1 style="color:#fff;margin:0;font-size:22px">1Kosmos Partner Portal</h1>
  </div>
  <div style="border:1px solid #ddd;border-top:none;padding:30px;border-radius:0 0 8px 8px">
    <h2 style="color:#0f1f3d">Certificate Expiry Reminder</h2>
    <p>Your certification <strong>%s</strong> is expiring <span style="color:%s;font-weight:bold">%s</span>.</p>
    <div style="background:#f5f7fa;padding:15px;border-left:4px solid %s;margin:20px 0">
      <p style="margin:0"><strong>Expiry Date:</strong> %s</p>
      <p style="margin:8px 0 0"><strong>Days Remaining:</strong> %d</p>
    </div>
    <p>Please log in to the Partner Portal to renew your certification before it expires.</p>
    <p style="color:#999;font-size:12px;margin-top:30px">
      This is an automated message from the 1Kosmos Partner Portal.
      Please do not reply to this email.
    </p>
  </div>
</body>
</html>`, certName, urgencyColor, urgencyText, urgencyColor, expiryDate, daysLeft)

	subject := fmt.Sprintf("Certification Expiry Reminder: %s expires on %s", certName, expiryDate)
	return e.SendEmail(to, subject, html)
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

// stripHTML produces a minimal plain-text version of an HTML string by
// removing tags.  This is intentionally simple — for production use a proper
// HTML-to-text library is preferable.
func stripHTML(html string) string {
	result := make([]byte, 0, len(html))
	inTag := false
	for i := 0; i < len(html); i++ {
		switch {
		case html[i] == '<':
			inTag = true
		case html[i] == '>':
			inTag = false
			result = append(result, ' ')
		case !inTag:
			result = append(result, html[i])
		}
	}
	return string(result)
}

func boolPtr(b bool) *bool { return &b }
