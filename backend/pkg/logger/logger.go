package logger

import (
	"os"
	"strings"
	"time"

	"github.com/rs/zerolog"
)

// NewLogger constructs a zerolog.Logger configured for the given level and
// environment.  In development the output is a human-readable console writer;
// in production it writes structured JSON to stdout.
func NewLogger(level, env string) zerolog.Logger {
	zerolog.TimeFieldFormat = time.RFC3339

	lvl, err := zerolog.ParseLevel(strings.ToLower(level))
	if err != nil {
		lvl = zerolog.InfoLevel
	}

	var logger zerolog.Logger

	if strings.ToLower(env) == "development" || strings.ToLower(env) == "dev" {
		output := zerolog.ConsoleWriter{
			Out:        os.Stdout,
			TimeFormat: "15:04:05",
		}
		logger = zerolog.New(output).
			Level(lvl).
			With().
			Timestamp().
			Caller().
			Logger()
	} else {
		logger = zerolog.New(os.Stdout).
			Level(lvl).
			With().
			Timestamp().
			Caller().
			Logger()
	}

	return logger
}
