.PHONY: up down dev-backend dev-frontend test demo-traffic sim test-sim

GO_BIN ?= /usr/local/go/bin/go

up:
	docker compose up -d

down:
	docker compose down

dev-backend:
	cd backend && $(GO_BIN) run -ldflags="-linkmode=external" ./cmd/meterbox

dev-frontend:
	cd frontend && ([ -x node_modules/.bin/next ] || npm install) && npm run dev

test:
	cd backend && $(GO_BIN) test -ldflags="-linkmode=external" -v ./...

sim:
	cd simulator && mix run --no-halt

test-sim:
	cd simulator && mix test

demo-traffic:
	curl -s -X POST http://localhost:8888/api/v1/events \
		-H "Authorization: Bearer mb_ing_live_acme_default_collector_key_01" \
		-H "Content-Type: application/json" \
		-d '{"specversion":"1.0","id":"evt_cli_01","source":"https://gateway.acme-ai.dev","type":"ai.llm.tokens","subject":"cust_hyperion_labs","data":{"tokens":3200,"model":"claude-4-sonnet"}}' | jq .
