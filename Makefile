# Makefile

# --- Configuration ---
# Defaults that can be overridden via command line (e.g., make build VERSION=2027.0)
VERSION ?= 2026.3
BUILD_NUMBER ?= 1
VERSION_FULL ?= $(VERSION).$(BUILD_NUMBER)
ARCHIVE_NAME ?= millegrilles_authentication_typescript
REMOTE_TARGET ?= fs1.maple.maceroc.com:archives/authentication

# --- Helpers ---
DATE_STR := $(shell date '+%Y-%m-%d %H:%M')

# --- Paths ---
ARTIFACTS_DIR = artifacts
DIST_DIR = dist
MANIFEST_FILE = src/manifest.build.json
API_MAPPING_SIGNED = src/resources/apiMapping.signed.json
API_MAPPING = src/resources/apiMapping.json

# --- Environment ---
NODE_OPTIONS = --openssl-legacy-provider
CI = false

# --- Targets ---

.PHONY: all build prepare package deploy clean

# Default target
all: package

# 1. Prepare resources (manifest and api mapping)
prepare:
	@echo "==> Preparing resources..."
	@printf '{\n' > $(MANIFEST_FILE)
	@printf '  "date": "%s",\n' "$(DATE_STR)" >> $(MANIFEST_FILE)
	@printf '  "version": "%s"\n' "$(VERSION_FULL)" >> $(MANIFEST_FILE)
	@printf '}\n' >> $(MANIFEST_FILE)
	@if [ -f $(API_MAPPING_SIGNED) ]; then \
		cp $(API_MAPPING_SIGNED) $(API_MAPPING); \
	else \
		echo "Error: $(API_MAPPING_SIGNED) not found"; exit 1; \
	fi

# 2. Install and Build
build: prepare
	@echo "==> Installing dependencies and building..."
	@NODE_OPTIONS=$(NODE_OPTIONS) CI=$(CI) npm install
	@NODE_OPTIONS=$(NODE_OPTIONS) CI=$(CI) npm run build

# 3. Package the artifacts
package: build
	@echo "==> Packaging artifacts..."
	@mkdir -p $(ARTIFACTS_DIR)
	@find $(DIST_DIR) -type f \( -name "*.js" -o -name "*.css" -o -name "*.map" -o -name "*.json" -o -name "*.svg" \) -exec gzip -k {} \;
	@tar -C $(DIST_DIR) -zcf "$(ARTIFACTS_DIR)/$(ARCHIVE_NAME).$(VERSION_FULL).tar.gz" .
	@echo "==> Generating SHA256 digest..."
	@sha256sum "$(ARTIFACTS_DIR)/$(ARCHIVE_NAME).$(VERSION_FULL).tar.gz" > "$(ARTIFACTS_DIR)/$(ARCHIVE_NAME).$(VERSION_FULL).tar.gz.sha256"

# 4. Deploy to remote server
deploy: package
	@echo "==> Deploying artifacts to $(REMOTE_TARGET)..."
	@rsync -avz $(ARTIFACTS_DIR)/ $(REMOTE_TARGET)

# Clean up build artifacts
clean:
	@echo "==> Cleaning..."
	@rm -rf $(ARTIFACTS_DIR)
	@rm -f $(MANIFEST_FILE)
	@rm -f $(API_MAPPING)
	@rm -rf $(DIST_DIR)
	@rm -rf node_modules


