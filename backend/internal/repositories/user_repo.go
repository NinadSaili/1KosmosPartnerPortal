package repositories

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/1kosmos/partner-portal/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// UserRepository handles all database operations for users.
type UserRepository struct {
	db *pgxpool.Pool
}

// NewUserRepository creates a new UserRepository.
func NewUserRepository(db *pgxpool.Pool) *UserRepository {
	return &UserRepository{db: db}
}

const userSelectCols = `id, organization_id, email, full_name, role, avatar_url, title, phone, is_active, profile_completed, last_login_at, created_at, updated_at`

func scanUser(row interface{ Scan(...any) error }) (*models.User, error) {
	var u models.User
	err := row.Scan(
		&u.ID, &u.OrganizationID, &u.Email, &u.FullName, &u.Role,
		&u.AvatarURL, &u.Title, &u.Phone, &u.IsActive, &u.ProfileCompleted,
		&u.LastLoginAt, &u.CreatedAt, &u.UpdatedAt,
	)
	return &u, err
}

// CreateUser inserts a new user record and returns the created user.
func (r *UserRepository) CreateUser(ctx context.Context, user *models.User) (*models.User, error) {
	const q = `
		INSERT INTO users (id, organization_id, email, full_name, role, avatar_url, title, phone, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING ` + userSelectCols

	if user.ID == uuid.Nil {
		user.ID = uuid.New()
	}
	now := time.Now().UTC()
	user.CreatedAt = now
	user.UpdatedAt = now

	row := r.db.QueryRow(ctx, q,
		user.ID,
		user.OrganizationID,
		user.Email,
		user.FullName,
		user.Role,
		user.AvatarURL,
		user.Title,
		user.Phone,
		user.IsActive,
		user.CreatedAt,
		user.UpdatedAt,
	)

	created, err := scanUser(row)
	if err != nil {
		return nil, fmt.Errorf("create user: %w", err)
	}
	return created, nil
}

// GetUserByID fetches a user by their UUID.
func (r *UserRepository) GetUserByID(ctx context.Context, id string) (*models.User, error) {
	q := `SELECT ` + userSelectCols + ` FROM users WHERE id = $1 AND is_active = true`

	u, err := scanUser(r.db.QueryRow(ctx, q, id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("get user by id: %w", err)
	}
	return u, nil
}

// GetUserByEmail fetches a user by their email address.
func (r *UserRepository) GetUserByEmail(ctx context.Context, email string) (*models.User, error) {
	q := `SELECT ` + userSelectCols + ` FROM users WHERE email = $1 AND is_active = true`

	u, err := scanUser(r.db.QueryRow(ctx, q, email))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("get user by email: %w", err)
	}
	return u, nil
}

// UpdateUser performs a dynamic UPDATE on the users table using the provided
// field map and returns the updated user record.
func (r *UserRepository) UpdateUser(ctx context.Context, id string, updates map[string]any) (*models.User, error) {
	if len(updates) == 0 {
		return r.GetUserByID(ctx, id)
	}

	setClauses := make([]string, 0, len(updates)+1)
	args := make([]any, 0, len(updates)+2)
	i := 1
	for col, val := range updates {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", col, i))
		args = append(args, val)
		i++
	}
	setClauses = append(setClauses, fmt.Sprintf("updated_at = $%d", i))
	args = append(args, time.Now().UTC())
	i++
	args = append(args, id)

	q := fmt.Sprintf(`UPDATE users SET %s WHERE id = $%d RETURNING `+userSelectCols,
		strings.Join(setClauses, ", "), i)

	u, err := scanUser(r.db.QueryRow(ctx, q, args...))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("update user: %w", err)
	}
	return u, nil
}

// ListUsers returns a paginated list of users, optionally filtered by orgID and role.
func (r *UserRepository) ListUsers(ctx context.Context, orgID *string, role *string, offset, limit int) ([]models.User, int, error) {
	conditions := []string{}
	args := []any{}
	argIdx := 1

	if orgID != nil {
		conditions = append(conditions, fmt.Sprintf("organization_id = $%d", argIdx))
		args = append(args, *orgID)
		argIdx++
	}
	if role != nil {
		conditions = append(conditions, fmt.Sprintf("role = $%d", argIdx))
		args = append(args, *role)
		argIdx++
	}

	where := ""
	if len(conditions) > 0 {
		where = "WHERE " + strings.Join(conditions, " AND ")
	}

	countQ := fmt.Sprintf("SELECT COUNT(*) FROM users %s", where)
	var total int
	if err := r.db.QueryRow(ctx, countQ, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count users: %w", err)
	}

	listArgs := append(args, limit, offset)
	listQ := fmt.Sprintf(`SELECT `+userSelectCols+` FROM users %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
		where, argIdx, argIdx+1)

	rows, err := r.db.Query(ctx, listQ, listArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("list users: %w", err)
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		u, err := scanUser(rows)
		if err != nil {
			return nil, 0, fmt.Errorf("scan user row: %w", err)
		}
		users = append(users, *u)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterate users: %w", err)
	}
	return users, total, nil
}

// DeleteUser deactivates a user by setting is_active = false.
func (r *UserRepository) DeleteUser(ctx context.Context, id string) error {
	const q = `UPDATE users SET is_active = false, updated_at = $1 WHERE id = $2 AND is_active = true`
	ct, err := r.db.Exec(ctx, q, time.Now().UTC(), id)
	if err != nil {
		return fmt.Errorf("delete user: %w", err)
	}
	if ct.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
