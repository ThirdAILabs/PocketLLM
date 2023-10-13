#!/bin/bash

DEVELOPER_ID="Developer ID Application: ThirdAI Corp (KJ35JRW2T6)"

# Function to sign files
sign_file() {
    local file="$1"
    echo "Signing $file"
    codesign --force --verify --verbose --sign "$DEVELOPER_ID" "$file"
}

# Recursively sign binaries in a directory
sign_directory() {
    local dir="$1"
    find "$dir" -type f \( -perm +111 -o -name "*.dylib" \) | while read binary; do
        sign_file "$binary"
    done
}

# Start the signing process
sign_directory .

