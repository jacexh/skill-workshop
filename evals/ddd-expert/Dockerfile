FROM golang:1.24.13-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates git nodejs ripgrep \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /eval /eval-home /artifacts /workspace \
    && printf '%s\n' 'export PATH="/usr/local/go/bin:$PATH"' > /etc/profile.d/go-path.sh

RUN mkdir -p /tmp/ddd-eval-deps \
    && cd /tmp/ddd-eval-deps \
    && go mod init example.invalid/ddd-eval-deps \
    && go get github.com/go-playground/validator/v10@v10.26.0 \
    && go mod download all \
    && rm -rf /tmp/ddd-eval-deps

WORKDIR /workspace
