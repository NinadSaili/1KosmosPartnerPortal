package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/1kosmos/partner-portal/internal/config"
	"github.com/1kosmos/partner-portal/internal/db"
	"github.com/1kosmos/partner-portal/internal/router"
	"github.com/1kosmos/partner-portal/pkg/logger"
	"github.com/joho/godotenv"
)

func main() {
	// Load .env file if present (ignored in production where env vars are injected).
	_ = godotenv.Load()

	// Load configuration from environment variables.
	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to load config: %v\n", err)
		os.Exit(1)
	}

	// Initialize structured logger.
	log := logger.NewLogger(cfg.LogLevel, cfg.Env)
	log.Info().Str("env", cfg.Env).Str("port", cfg.Port).Msg("starting partner portal API")

	// Connect to PostgreSQL.
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	pool, err := db.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to connect to database")
	}
	defer pool.Close()
	log.Info().Msg("database connection established")

	// Build the chi router with all routes registered.
	r := router.New(cfg, pool, log)

	// Construct the HTTP server.
	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      r,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// Start serving in a background goroutine.
	serverErr := make(chan error, 1)
	go func() {
		log.Info().Str("addr", srv.Addr).Msg("HTTP server listening")
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErr <- err
		}
	}()

	// Wait for an OS signal or a fatal server error.
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	select {
	case sig := <-quit:
		log.Info().Str("signal", sig.String()).Msg("shutdown signal received")
	case err := <-serverErr:
		log.Error().Err(err).Msg("server error")
	}

	// Graceful shutdown with a 30-second deadline.
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()

	log.Info().Msg("shutting down HTTP server")
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Error().Err(err).Msg("graceful shutdown failed; forcing close")
		_ = srv.Close()
	}

	log.Info().Msg("server stopped")
}
