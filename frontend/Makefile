PNPM ?= pnpm

.PHONY: install dev build start lint typecheck clean

install:
	$(PNPM) install

dev:
	$(PNPM) dev

build:
	$(PNPM) build

start:
	$(PNPM) start

lint:
	$(PNPM) lint

typecheck:
	$(PNPM) exec tsc --noEmit

clean:
	rm -rf node_modules .next
