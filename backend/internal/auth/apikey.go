package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"strings"

	"github.com/meterbox/meterbox/internal/models"
)

type contextKey string

const TenantContextKey contextKey = "meterbox_tenant_context"

// HashKey computes the deterministic SHA-256 hex digest of a raw API key.
func HashKey(rawKey string) string {
	sum := sha256.Sum256([]byte(strings.TrimSpace(rawKey)))
	return hex.EncodeToString(sum[:])
}

// GenerateScopedKey creates a new cryptographically random API key with a structured prefix:
//   - mb_ing_live_... / mb_ing_test_...
//   - mb_ent_live_... / mb_ent_test_...
//   - mb_sk_live_...  / mb_sk_test_...
//   - mb_portal_...
func GenerateScopedKey(scope models.KeyScope, envType string) (rawKey, prefix, preview, hash string, err error) {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", "", "", "", err
	}
	envTag := "live"
	if envType == "sandbox" {
		envTag = "test"
	}

	switch scope {
	case models.ScopeIngest:
		prefix = fmt.Sprintf("mb_ing_%s_", envTag)
	case models.ScopeEntitlement:
		prefix = fmt.Sprintf("mb_ent_%s_", envTag)
	case models.ScopePortal:
		prefix = "mb_portal_"
	default:
		prefix = fmt.Sprintf("mb_sk_%s_", envTag)
	}

	secretPart := hex.EncodeToString(buf)
	rawKey = prefix + secretPart
	preview = prefix + secretPart[:4] + "..." + secretPart[len(secretPart)-4:]
	hash = HashKey(rawKey)
	return rawKey, prefix, preview, hash, nil
}

// KeyResolver looks up a TenantContext by SHA-256 key hash or explicit namespace header (for dashboard session).
type KeyResolver interface {
	ResolveAPIKeyHash(keyHash string) (*models.TenantContext, error)
	ResolveNamespace(namespace string) (*models.TenantContext, error)
}

// TenantFromContext extracts the resolved TenantContext from an HTTP request context.
func TenantFromContext(ctx context.Context) *models.TenantContext {
	if val, ok := ctx.Value(TenantContextKey).(*models.TenantContext); ok {
		return val
	}
	return nil
}

// WithTenant injects a TenantContext into a context.Context.
func WithTenant(ctx context.Context, tc *models.TenantContext) context.Context {
	return context.WithValue(ctx, TenantContextKey, tc)
}

// Middleware authenticates incoming requests via `Authorization: Bearer mb_...`, `X-Meterbox-Key`,
// or dashboard session header `X-OpenMeter-Namespace`, and enforces strict scope boundaries.
func Middleware(resolver KeyResolver) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			rawToken := extractToken(r)
			var tenantCtx *models.TenantContext
			var err error

			if rawToken != "" {
				keyHash := HashKey(rawToken)
				tenantCtx, err = resolver.ResolveAPIKeyHash(keyHash)
				if err != nil || tenantCtx == nil {
					writeAuthError(w, http.StatusUnauthorized, "invalid_api_key", "API key is invalid, expired, or revoked")
					return
				}
			} else {
				// Control plane UI session / explicit namespace header fallback
				ns := r.Header.Get("X-OpenMeter-Namespace")
				if ns == "" {
					ns = r.URL.Query().Get("namespace")
				}
				if ns == "" {
					ns = "ns_live_acme"
				}
				tenantCtx, err = resolver.ResolveNamespace(ns)
				if err != nil || tenantCtx == nil {
					writeAuthError(w, http.StatusUnauthorized, "unknown_namespace", "Target OpenMeter namespace not found")
					return
				}
			}

			// Enforce scope boundaries on OpenMeter routes
			if !isRouteAllowedForScope(r.Method, r.URL.Path, tenantCtx) {
				writeAuthError(
					w,
					http.StatusForbidden,
					"insufficient_scope",
					fmt.Sprintf("Key with scope '%s' is not permitted to call %s %s", tenantCtx.Scope, r.Method, r.URL.Path),
				)
				return
			}

			// Propagate canonical OpenMeter namespace header downstream
			w.Header().Set("X-OpenMeter-Namespace", tenantCtx.Namespace)
			ctx := WithTenant(r.Context(), tenantCtx)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func extractToken(r *http.Request) string {
	authHeader := strings.TrimSpace(r.Header.Get("Authorization"))
	if strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
		token := strings.TrimSpace(authHeader[7:])
		if strings.HasPrefix(token, "mb_") {
			return token
		}
	}
	if apiKey := strings.TrimSpace(r.Header.Get("X-Meterbox-Key")); apiKey != "" {
		return apiKey
	}
	return ""
}

func isRouteAllowedForScope(method, path string, tc *models.TenantContext) bool {
	switch tc.Scope {
	case models.ScopeAdmin:
		return true
	case models.ScopeIngest:
		// Ingest keys can ONLY POST to /api/v1/events or /api/v1/posthog/*
		return method == http.MethodPost && (strings.HasPrefix(path, "/api/v1/events") || strings.HasPrefix(path, "/api/v1/posthog/"))
	case models.ScopeEntitlement:
		// Entitlement check keys can only read entitlement values or mint portal tokens
		if method == http.MethodGet && strings.Contains(path, "/entitlements/") {
			return true
		}
		if method == http.MethodPost && strings.HasPrefix(path, "/api/v1/portal/tokens") {
			return true
		}
		return false
	case models.ScopePortal:
		// Portal tokens can only access /api/portal/v1/* or their own subject's entitlements
		if strings.HasPrefix(path, "/api/portal/v1/") {
			return method == http.MethodGet
		}
		if method == http.MethodGet && tc.SubjectFilter != "" && strings.Contains(path, "/subjects/"+tc.SubjectFilter+"/") {
			return true
		}
		return false
	default:
		return false
	}
}

func writeAuthError(w http.ResponseWriter, status int, code, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = fmt.Fprintf(w, `{"error":{"code":%q,"message":%q}}`, code, message)
}
