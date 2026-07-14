FROM golang:1.25.5-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates git nodejs ripgrep \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /eval /eval-home /artifacts /workspace \
    && printf '%s\n' 'export PATH="/usr/local/go/bin:$PATH"' > /etc/profile.d/go-path.sh

COPY cases/guard-clean-house-style/workspace/go.mod \
     cases/guard-clean-house-style/workspace/go.sum \
     /tmp/ddd-eval-deps/

RUN cd /tmp/ddd-eval-deps \
    && go mod download all \
    && rm -rf /tmp/ddd-eval-deps

WORKDIR /workspace
