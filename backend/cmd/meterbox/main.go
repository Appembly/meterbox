package main

import (
	"context"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/meterbox/meterbox/internal/clickhouse"
	"github.com/meterbox/meterbox/internal/control"
	"github.com/meterbox/meterbox/internal/store"
)

func main() {
	preferredAddr := envOrDefault("METERBOX_ADDR", ":8888")
	chEndpoint := envOrDefault("CLICKHOUSE_HTTP_URL", "http://127.0.0.1:18123")
	redpandaEndpoint := envOrDefault("REDPANDA_PROXY_URL", "http://127.0.0.1:18082")
	redisAddr := envOrDefault("REDIS_ADDR", "127.0.0.1:16379")

	chClient := clickhouse.NewClient(chEndpoint, "openmeter")
	multiStore := store.NewMultiTenantStore(chClient, redpandaEndpoint, redisAddr)
	srv := control.NewServer(multiStore)

	listener, boundAddr, err := listenWithFallback(preferredAddr)
	if err != nil {
		log.Fatalf("failed to bind HTTP listener: %v", err)
	}

	httpServer := &http.Server{
		Handler:           srv.Router(),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
	}

	go func() {
		displayURL := formatLocalURL(boundAddr)
		log.Printf("[Meterbox] Control Plane & OpenMeter Edge Gateway listening on %s (%s)", boundAddr, displayURL)
		if err := httpServer.Serve(listener); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = httpServer.Shutdown(ctx)
}

func listenWithFallback(preferred string) (net.Listener, string, error) {
	candidates := []string{preferred, ":8888", ":8889", ":8090", ":8091", ":0"}
	var lastErr error
	for _, addr := range candidates {
		ln, err := net.Listen("tcp", addr)
		if err == nil {
			return ln, ln.Addr().String(), nil
		}
		lastErr = err
	}
	return nil, "", lastErr
}

func formatLocalURL(addr string) string {
	if idx := strings.LastIndex(addr, ":"); idx != -1 {
		return fmt.Sprintf("http://localhost%s", addr[idx:])
	}
	return "http://" + addr
}

func envOrDefault(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
