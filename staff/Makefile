PNPM ?= pnpm

.PHONY: install dev build start lint lint-eslint lint-styles format typecheck clean prepare

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

lint-eslint:
	$(PNPM) run lint:eslint

lint-styles:
	$(PNPM) run lint:styles

format:
	$(PNPM) run format

typecheck:
	$(PNPM) typecheck

prepare:
	$(PNPM) run prepare

clean:
	rm -rf node_modules .next
