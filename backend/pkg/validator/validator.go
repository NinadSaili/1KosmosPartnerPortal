// Package validator provides lightweight input-validation helpers for HTTP
// request payloads.
package validator

import (
	"fmt"
	"net/mail"
	"strings"

	"github.com/google/uuid"
)

// ---------------------------------------------------------------------------
// ValidationError
// ---------------------------------------------------------------------------

// ValidationError is returned when one or more input fields fail validation.
// Fields maps a field name to a human-readable error message.
type ValidationError struct {
	Fields map[string]string
}

// Error implements the error interface.
func (e *ValidationError) Error() string {
	if len(e.Fields) == 0 {
		return "validation error"
	}
	parts := make([]string, 0, len(e.Fields))
	for field, msg := range e.Fields {
		parts = append(parts, fmt.Sprintf("%s: %s", field, msg))
	}
	return "validation error: " + strings.Join(parts, "; ")
}

// IsValidationError reports whether err is a *ValidationError.
func IsValidationError(err error) bool {
	_, ok := err.(*ValidationError)
	return ok
}

// ---------------------------------------------------------------------------
// Individual validators
// ---------------------------------------------------------------------------

// ValidateEmail returns true when email is a syntactically valid RFC 5322
// address.
func ValidateEmail(email string) bool {
	if strings.TrimSpace(email) == "" {
		return false
	}
	_, err := mail.ParseAddress(email)
	return err == nil
}

// ValidateUUID returns true when s is a valid UUID in any standard format.
func ValidateUUID(s string) bool {
	_, err := uuid.Parse(s)
	return err == nil
}

// ---------------------------------------------------------------------------
// Bulk validators
// ---------------------------------------------------------------------------

// ValidateRequired checks that each field in the map is non-empty after
// trimming whitespace.  It returns a map of field name → error message for
// every field that is blank.  A nil map means all fields are present.
func ValidateRequired(fields map[string]string) map[string]string {
	errs := make(map[string]string)
	for field, value := range fields {
		if strings.TrimSpace(value) == "" {
			errs[field] = "is required"
		}
	}
	if len(errs) == 0 {
		return nil
	}
	return errs
}

// ValidateStruct is a convenience wrapper that runs ValidateRequired and
// returns a *ValidationError when any field is empty, or nil on success.
func ValidateStruct(fields map[string]string) error {
	errs := ValidateRequired(fields)
	if len(errs) == 0 {
		return nil
	}
	return &ValidationError{Fields: errs}
}

// MergeErrors merges two field-error maps into one.  If both contain the same
// key the value from b takes precedence.
func MergeErrors(a, b map[string]string) map[string]string {
	if len(a) == 0 {
		return b
	}
	result := make(map[string]string, len(a)+len(b))
	for k, v := range a {
		result[k] = v
	}
	for k, v := range b {
		result[k] = v
	}
	return result
}
