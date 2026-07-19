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
BUILD_ASSETS_DIR = build_assets
MANIFEST_FILE = $(BUILD_ASSETS_DIR)/manifest.build.json
STAGING_DIR = staging

# --- Environment ---
NODE_OPTIONS = --openssl-legacy-provider
CI = false

# --- Targets ---

.PHONY: all build prepare package deploy clean

# Default target
all: package

# 1. Prepare build assets and resources
prepare:
	@echo "==> Preparing build assets..."
	@mkdir -p $(BUILD_ASSETS_DIR)
	@printf '{\n' > $(MANIFEST_FILE)
	@printf '  "date": "%s",\n' "$(DATE_STR)" >> $(MANIFEST_FILE)
	@printf '  "version": "%s"\n' "$(VERSION_FULL)" >> $(MANIFEST_FILE)
	@printf '}\n' >> $(MANIFEST_FILE)

# 2. Install and Build
build: prepare
	@echo "==> Installing dependencies and building..."
	@NODE_OPTIONS=$(NODE_OPTIONS) CI=$(CI) npm install
	@NODE_OPTIONS=$(NODE_OPTIONS) CI=$(CI) npm run build

# 3. Package the artifacts
package: build
	@echo "==> Packaging artifacts..."
	@rm -rf $(STAGING_DIR) $(ARTIFACTS_DIR)
	@mkdir -p $(ARTIFACTS_DIR)
	@mkdir -p $(STAGING_DIR)/files
	# Copy catalogue files to root of staging
	@cp -r catalogue/. $(STAGING_DIR)/
	# Update version in metadata.json
	@python3 -c 'import json, sys; \
		path = sys.argv[1]; \
		data = json.load(open(path)); \
		data["version"] = sys.argv[2]; \
		json.dump(data, open(path, "w"), indent=2)' $(STAGING_DIR)/metadata.json "$(VERSION_FULL)"
	# Copy dist files to staging/files
	@cp -r dist/. $(STAGING_DIR)/files/
	# Gzip files in staging/files
	@find $(STAGING_DIR)/files/ -type f \( -name "*.js" -o -name "*.css" -o -name "*.map" -o -name "*.json" -o -name "*.svg" \) -exec gzip -k {} \;
	# Create archive from staging
	@tar -C $(STAGING_DIR) -zcf "$(ARTIFACTS_DIR)/$(ARCHIVE_NAME).$(VERSION_FULL).tar.gz" .
	@echo "==> Generating SHA256 digest..."
	@sha256sum "$(ARTIFACTS_DIR)/$(ARCHIVE_NAME).$(VERSION_FULL).tar.gz" > "$(ARTIFACTS_DIR)/$(ARCHIVE_NAME).$(VERSION_FULL).tar.gz.sha256"
	@rm -rf $(STAGING_DIR) $(BUILD_ASSETS_DIR)

# 4. Deploy to remote server
deploy: package
	@echo "==> Deploying artifacts to $(REMOTE_TARGET)..."
	@rsync -avz $(ARTIFACTS_DIR)/ $(REMOTE_TARGET)

# Clean up build artifacts
clean:
	@echo "==> Cleaning..."
	@rm -rf $(ARTIFACTS_DIR)
	@rm -rf $(STAGING_DIR)
	@rm -rf $(BUILD_ASSETS_DIR)
	@rm -f $(MANIFEST_FILE)
	@rm -rf $(DIST_DIR)
	@rm -rf node_modules
