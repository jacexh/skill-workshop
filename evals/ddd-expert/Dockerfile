FROM golang:1.24.13-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates git ripgrep \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /eval /eval-home /artifacts /workspace

WORKDIR /workspace
