// Package pdf provides certificate PDF generation via headless Chromium using
// the chromedp library.
package pdf

import (
	"bytes"
	"context"
	"fmt"
	"html/template"
	"time"

	"github.com/chromedp/cdproto/page"
	"github.com/chromedp/chromedp"
)

// CertificateData holds the dynamic values substituted into the certificate
// HTML template.
type CertificateData struct {
	// RecipientName is the full name of the certificate holder.
	RecipientName string
	// CertificationTitle is the name of the certification programme.
	CertificationTitle string
	// CertNumber is the unique certificate identifier (e.g. "1K-2024-000123").
	CertNumber string
	// IssuedDate is a human-readable issue date string, e.g. "January 15, 2024".
	IssuedDate string
	// ExpiryDate is a human-readable expiry date string, e.g. "January 15, 2026".
	// May be empty for lifetime certifications.
	ExpiryDate string
}

// certHTMLTemplate is the Go HTML template used to produce the certificate page
// rendered by Chromium before printing to PDF.
const certHTMLTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Certificate of Achievement</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }

  @page {
    size: A4 landscape;
    margin: 0;
  }

  body {
    width: 297mm;
    height: 210mm;
    font-family: 'Georgia', serif;
    background: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .certificate {
    width: 277mm;
    height: 190mm;
    border: 12px solid #0f1f3d;
    border-radius: 8px;
    position: relative;
    padding: 30px 50px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    background: linear-gradient(135deg, #ffffff 0%, #f0f4ff 100%);
  }

  /* Corner ornaments */
  .certificate::before,
  .certificate::after {
    content: '';
    position: absolute;
    width: 40px;
    height: 40px;
    border-color: #c5a028;
    border-style: solid;
    border-width: 0;
  }
  .certificate::before {
    top: 12px; left: 12px;
    border-top-width: 4px;
    border-left-width: 4px;
  }
  .certificate::after {
    bottom: 12px; right: 12px;
    border-bottom-width: 4px;
    border-right-width: 4px;
  }

  /* Header section */
  .header {
    text-align: center;
    width: 100%;
  }

  .brand-logo {
    font-size: 28px;
    font-weight: 900;
    letter-spacing: 3px;
    color: #0f1f3d;
    text-transform: uppercase;
    font-family: 'Arial Black', Arial, sans-serif;
  }

  .brand-logo span {
    color: #c5a028;
  }

  .brand-tagline {
    font-size: 10px;
    color: #666;
    letter-spacing: 2px;
    text-transform: uppercase;
    margin-top: 4px;
    font-family: Arial, sans-serif;
  }

  .divider {
    width: 80%;
    height: 2px;
    background: linear-gradient(to right, transparent, #c5a028, transparent);
    margin: 12px auto;
  }

  /* Title */
  .certificate-title {
    font-size: 13px;
    letter-spacing: 5px;
    color: #555;
    text-transform: uppercase;
    font-family: Arial, sans-serif;
    margin-bottom: 4px;
  }

  /* Body section */
  .body {
    text-align: center;
    width: 100%;
  }

  .presented-to {
    font-size: 14px;
    color: #666;
    font-style: italic;
    margin-bottom: 8px;
    font-family: Arial, sans-serif;
  }

  .recipient-name {
    font-size: 42px;
    color: #0f1f3d;
    font-family: 'Georgia', serif;
    font-weight: bold;
    margin-bottom: 12px;
    text-shadow: 1px 1px 2px rgba(0,0,0,0.1);
  }

  .completion-text {
    font-size: 13px;
    color: #555;
    font-family: Arial, sans-serif;
    margin-bottom: 6px;
  }

  .certification-title {
    font-size: 22px;
    color: #0f1f3d;
    font-weight: bold;
    font-family: 'Georgia', serif;
    margin-bottom: 6px;
  }

  /* Footer section */
  .footer {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }

  .footer-item {
    text-align: center;
    flex: 1;
  }

  .footer-label {
    font-size: 9px;
    color: #999;
    text-transform: uppercase;
    letter-spacing: 1px;
    font-family: Arial, sans-serif;
    margin-bottom: 2px;
  }

  .footer-value {
    font-size: 12px;
    color: #333;
    font-family: Arial, sans-serif;
    font-weight: bold;
    border-top: 1px solid #ccc;
    padding-top: 4px;
  }

  .seal {
    flex: 0 0 80px;
    width: 80px;
    height: 80px;
    border: 4px double #c5a028;
    border-radius: 50%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: radial-gradient(circle, #fff9ed, #fff);
    text-align: center;
  }

  .seal-text {
    font-size: 7px;
    font-weight: bold;
    color: #0f1f3d;
    text-transform: uppercase;
    letter-spacing: 1px;
    line-height: 1.3;
    font-family: Arial, sans-serif;
  }

  .seal-star {
    font-size: 18px;
    color: #c5a028;
    line-height: 1;
  }
</style>
</head>
<body>
<div class="certificate">

  <!-- Header -->
  <div class="header">
    <div class="brand-logo">1<span>Kosmos</span></div>
    <div class="brand-tagline">Decentralized Identity &amp; Workforce Security</div>
    <div class="divider"></div>
    <div class="certificate-title">Certificate of Achievement</div>
  </div>

  <!-- Body -->
  <div class="body">
    <div class="presented-to">This certificate is proudly presented to</div>
    <div class="recipient-name">{{.RecipientName}}</div>
    <div class="completion-text">for successfully completing all requirements for the</div>
    <div class="certification-title">{{.CertificationTitle}}</div>
    <div class="completion-text">certification programme</div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="footer-item">
      <div class="footer-label">Date Issued</div>
      <div class="footer-value">{{.IssuedDate}}</div>
    </div>

    <div class="seal">
      <div class="seal-star">&#9733;</div>
      <div class="seal-text">Officially<br>Certified<br>1Kosmos</div>
    </div>

    {{if .ExpiryDate}}
    <div class="footer-item">
      <div class="footer-label">Valid Until</div>
      <div class="footer-value">{{.ExpiryDate}}</div>
    </div>
    {{else}}
    <div class="footer-item">
      <div class="footer-label">Validity</div>
      <div class="footer-value">Lifetime</div>
    </div>
    {{end}}

    <div class="footer-item" style="display:none"><!-- spacer --></div>
    <div class="footer-item">
      <div class="footer-label">Certificate No.</div>
      <div class="footer-value">{{.CertNumber}}</div>
    </div>
  </div>

</div>
</body>
</html>`

// GenerateCertificatePDF renders the certificate HTML template with data and
// uses chromedp to print it as a PDF via headless Chromium.
//
// The returned byte slice is the raw PDF content ready to be served or stored.
func GenerateCertificatePDF(ctx context.Context, data CertificateData) ([]byte, error) {
	// Render the HTML template.
	tmpl, err := template.New("cert").Parse(certHTMLTemplate)
	if err != nil {
		return nil, fmt.Errorf("pdf: parse template: %w", err)
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return nil, fmt.Errorf("pdf: render template: %w", err)
	}
	htmlContent := buf.String()

	// Create a chromedp context with a 60-second timeout.
	allocCtx, cancelAlloc := chromedp.NewExecAllocator(ctx,
		append(chromedp.DefaultExecAllocatorOptions[:],
			chromedp.Flag("headless", true),
			chromedp.Flag("disable-gpu", true),
			chromedp.Flag("no-sandbox", true),
			chromedp.Flag("disable-dev-shm-usage", true),
		)...,
	)
	defer cancelAlloc()

	tabCtx, cancelTab := chromedp.NewContext(allocCtx)
	defer cancelTab()

	timeoutCtx, cancelTimeout := context.WithTimeout(tabCtx, 60*time.Second)
	defer cancelTimeout()

	// Navigate to the rendered HTML and print to PDF.
	var pdfBuf []byte
	if err := chromedp.Run(timeoutCtx,
		chromedp.Navigate("about:blank"),
		chromedp.ActionFunc(func(ctx context.Context) error {
			frameTree, err := page.GetFrameTree().Do(ctx)
			if err != nil {
				return err
			}
			return page.SetDocumentContent(frameTree.Frame.ID, htmlContent).Do(ctx)
		}),
		// Wait for the page to settle.
		chromedp.Sleep(500*time.Millisecond),
		// Print to PDF in A4 landscape.
		chromedp.ActionFunc(func(ctx context.Context) error {
			var err error
			pdfBuf, _, err = page.PrintToPDF().
				WithPrintBackground(true).
				WithLandscape(true).
				WithPaperWidth(11.69).  // A4 width in inches (landscape)
				WithPaperHeight(8.27). // A4 height in inches (landscape)
				WithMarginTop(0).
				WithMarginBottom(0).
				WithMarginLeft(0).
				WithMarginRight(0).
				Do(ctx)
			return err
		}),
	); err != nil {
		return nil, fmt.Errorf("pdf: chromedp render: %w", err)
	}

	return pdfBuf, nil
}
