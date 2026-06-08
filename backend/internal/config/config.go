package config

import "github.com/kelseyhightower/envconfig"

// Config holds all application configuration sourced from environment variables.
type Config struct {
	DatabaseURL            string   `envconfig:"DATABASE_URL"              required:"true"`
	SupabaseURL            string   `envconfig:"SUPABASE_URL"              required:"true"`
	SupabaseAnonKey        string   `envconfig:"SUPABASE_ANON_KEY"         required:"true"`
	SupabaseServiceRoleKey string   `envconfig:"SUPABASE_SERVICE_ROLE_KEY" required:"true"`
	JWTSecret              string   `envconfig:"JWT_SECRET"                required:"true"`
	Port                   string   `envconfig:"PORT"                      default:"8080"`
	AllowedOrigins         []string `envconfig:"ALLOWED_ORIGINS"`
	SendGridAPIKey         string   `envconfig:"SENDGRID_API_KEY"`
	FromEmail              string   `envconfig:"FROM_EMAIL"                default:"noreply@1kosmos.com"`
	AnthropicAPIKey        string   `envconfig:"ANTHROPIC_API_KEY"`
	StorageBucket          string   `envconfig:"STORAGE_BUCKET"            default:"partner-portal"`
	LogLevel               string   `envconfig:"LOG_LEVEL"                 default:"info"`
	Env                    string   `envconfig:"ENV"                       default:"development"`
}

// Load reads configuration from environment variables using the envconfig package.
// It returns an error if any required variable is missing.
func Load() (*Config, error) {
	var cfg Config
	if err := envconfig.Process("", &cfg); err != nil {
		return nil, err
	}
	return &cfg, nil
}
