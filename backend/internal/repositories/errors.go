package repositories

import "errors"

// ErrNotFound is returned when a requested record does not exist.
var ErrNotFound = errors.New("record not found")

// ErrConflict is returned when a unique constraint is violated.
var ErrConflict = errors.New("record already exists")
