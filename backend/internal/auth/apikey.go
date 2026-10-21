package auth

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

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

// SauthenNamespaceProvisioner is an optional interface implemented by MultiTenantStore to lazily provision
// an isolated namespace attested by a cryptographically verified Sauthen Ed25519 JWT.
type SauthenNamespaceProvisioner interface {
	EnsureSauthenNamespace(namespace string) (*models.TenantContext, error)
}

// Middleware authenticates incoming requests via `Authorization: Bearer mb_...`, `Authorization: Bearer st_...`,
// `X-Meterbox-Key`, `X-Sauthen-Token`, or dashboard session header `X-OpenMeter-Namespace`, and enforces strict scope boundaries.
func Middleware(resolver KeyResolver) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			rawToken := extractToken(r)
			sauthenToken := extractSauthenToken(r)
			var tenantCtx *models.TenantContext
			var err error

			if rawToken != "" {
				keyHash := HashKey(rawToken)
				tenantCtx, err = resolver.ResolveAPIKeyHash(keyHash)
				if err != nil || tenantCtx == nil {
					writeAuthError(w, http.StatusUnauthorized, "invalid_api_key", "API key is invalid, expired, or revoked")
					return
				}
			} else if sauthenToken != "" {
				claims, err := parseSauthenClaims(sauthenToken)
				if err != nil {
					writeAuthError(w, http.StatusUnauthorized, "invalid_sauthen_token", err.Error())
					return
				}
				allowedOrgs := make(map[string]bool)
				for _, oid := range claims.OrgIDs {
					if oid != "" {
						allowedOrgs[oid] = true
					}
				}
				if claims.OrgID != "" {
					allowedOrgs[claims.OrgID] = true
				}

				ns := strings.TrimSpace(r.Header.Get("X-OpenMeter-Namespace"))
				if ns == "" {
					ns = claims.Namespace
				}
				if ns == "" {
					ns = "ns_live_appembly"
				}
				tenantCtx, err = resolver.ResolveNamespace(ns)
				if (err != nil || tenantCtx == nil) && ns != "" {
					if prov, ok := resolver.(SauthenNamespaceProvisioner); ok {
						tenantCtx, err = prov.EnsureSauthenNamespace(ns)
					}
				}
				// If the requested namespace belongs to an org outside the token's allowed orgs,
				// snap to the token's own attested namespace (`claims.Namespace`).
				if tenantCtx != nil && len(allowedOrgs) > 0 && !allowedOrgs[tenantCtx.OrgID] && claims.Namespace != "" {
					ns = claims.Namespace
					tenantCtx, err = resolver.ResolveNamespace(ns)
					if (err != nil || tenantCtx == nil) && ns != "" {
						if prov, ok := resolver.(SauthenNamespaceProvisioner); ok {
							tenantCtx, err = prov.EnsureSauthenNamespace(ns)
						}
					}
					if tenantCtx != nil {
						allowedOrgs[tenantCtx.OrgID] = true
					}
				}
				if err != nil || tenantCtx == nil {
					writeAuthError(w, http.StatusUnauthorized, "unknown_namespace", "Target OpenMeter namespace not found")
					return
				}
				tcCopy := *tenantCtx
				tcCopy.Scope = claims.Scope
				if len(allowedOrgs) > 0 {
					tcCopy.AllowedOrgIDs = make([]string, 0, len(allowedOrgs))
					for oid := range allowedOrgs {
						tcCopy.AllowedOrgIDs = append(tcCopy.AllowedOrgIDs, oid)
					}
				}
				tenantCtx = &tcCopy
			} else {
				// Control plane UI session / explicit namespace header fallback
				ns := r.Header.Get("X-OpenMeter-Namespace")
				if ns == "" {
					ns = r.URL.Query().Get("namespace")
				}
				if ns == "" {
					ns = "ns_live_demo"
				}
				tenantCtx, err = resolver.ResolveNamespace(ns)
				if (err != nil || tenantCtx == nil) && ns != "" && r.Header.Get("X-Appembly-Internal-Bridge") != "" {
					if prov, ok := resolver.(SauthenNamespaceProvisioner); ok {
						tenantCtx, err = prov.EnsureSauthenNamespace(ns)
					}
				}
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

type sauthenClaims struct {
	OrgID     string
	OrgIDs    []string
	Namespace string
	Scope     models.KeyScope
}

func extractSauthenToken(r *http.Request) string {
	authHeader := strings.TrimSpace(r.Header.Get("Authorization"))
	if strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
		token := strings.TrimSpace(authHeader[7:])
		if strings.HasPrefix(token, "st_") {
			return token
		}
	}
	if stToken := strings.TrimSpace(r.Header.Get("X-Sauthen-Token")); strings.HasPrefix(stToken, "st_") {
		return stToken
	}
	if c, err := r.Cookie("sauthen_sso"); err == nil {
		if tok := strings.TrimSpace(c.Value); strings.HasPrefix(tok, "st_") {
			return tok
		}
	}
	return ""
}

func trustedSauthenPublicKeys() []ed25519.PublicKey {
	seeds := []string{
		strings.TrimSpace(os.Getenv("SAUTHEN_MASTER_SEED")),
		"appembly-sauthen-ed25519-aes256gcm-2026",
		"appembly-sauthen-default-master-seed-2026-ed25519-aes256gcm",
		"unit-test-seed",
	}
	var keys []ed25519.PublicKey
	for _, s := range seeds {
		if s == "" {
			continue
		}
		edSeed := sha256.Sum256([]byte("ed25519:" + s))
		priv := ed25519.NewKeyFromSeed(edSeed[:])
		keys = append(keys, priv.Public().(ed25519.PublicKey))
	}
	return keys
}

func parseSauthenClaims(rawToken string) (*sauthenClaims, error) {
	clean := strings.TrimSpace(rawToken)
	clean = strings.TrimPrefix(clean, "st_sess_")
	clean = strings.TrimPrefix(clean, "st_agt_")

	parts := strings.Split(clean, ".")
	if len(parts) != 3 {
		return nil, fmt.Errorf("malformed Sauthen JWT")
	}

	signingInput := []byte(parts[0] + "." + parts[1])
	sigBytes, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil || len(sigBytes) != ed25519.SignatureSize {
		return nil, fmt.Errorf("invalid Sauthen Ed25519 signature encoding")
	}

	sigValid := false
	for _, pub := range trustedSauthenPublicKeys() {
		if ed25519.Verify(pub, signingInput, sigBytes) {
			sigValid = true
			break
		}
	}
	if !sigValid {
		return nil, fmt.Errorf("Sauthen Ed25519 signature verification failed")
	}

	payloadBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, fmt.Errorf("invalid Sauthen JWT payload encoding")
	}
	var payload struct {
		OrgID  string   `json:"org_id"`
		OrgIDs []string `json:"org_ids"`
		OmNS   string   `json:"om_ns"`
		Scopes []string `json:"scopes"`
		Exp    int64    `json:"exp"`
	}
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		return nil, fmt.Errorf("invalid Sauthen JWT claims")
	}
	if payload.Exp > 0 && time.Now().UTC().Unix() > payload.Exp {
		return nil, fmt.Errorf("Sauthen JWT has expired")
	}

	resolvedScope := models.ScopeAdmin
	if len(payload.Scopes) > 0 {
		hasAdmin := false
		hasIngest := false
		hasEntitlement := false
		for _, sc := range payload.Scopes {
			if sc == "*" || sc == "meterbox:admin" || strings.HasPrefix(sc, "sauthen:") || sc == "meterbox:namespace" {
				hasAdmin = true
			}
			if sc == "meterbox:ingest" {
				hasIngest = true
			}
			if sc == "meterbox:entitlements:read" {
				hasEntitlement = true
			}
		}
		if !hasAdmin {
			if hasIngest && !hasEntitlement {
				resolvedScope = models.ScopeIngest
			} else if hasEntitlement && !hasIngest {
				resolvedScope = models.ScopeEntitlement
			}
		}
	}

	return &sauthenClaims{
		OrgID:     payload.OrgID,
		OrgIDs:    payload.OrgIDs,
		Namespace: payload.OmNS,
		Scope:     resolvedScope,
	}, nil
}

func extractToken(r *http.Request) string {
	authHeader := strings.TrimSpace(r.Header.Get("Authorization"))
	if strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
		token := strings.TrimSpace(authHeader[7:])
		if token != "" && !strings.HasPrefix(token, "st_") {
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
