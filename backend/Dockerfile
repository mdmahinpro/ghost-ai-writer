# gaw-api — the Rust backend. Migrations are compiled in via sqlx::migrate!,
# so the runtime image needs neither the migration files nor a toolchain.
FROM rust:1-slim-bookworm AS build
WORKDIR /src
COPY Cargo.toml Cargo.lock ./
COPY api ./api
COPY migrations ./migrations
RUN cargo build --release --bin gaw-api

FROM debian:bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /src/target/release/gaw-api /usr/local/bin/gaw-api
# Platforms route to the container, not to loopback; $PORT is set by the host.
ENV HOST=0.0.0.0 \
    ROLE=all \
    DATABASE_URL=sqlite:/data/gaw.db?mode=rwc
RUN mkdir -p /data
EXPOSE 8080
CMD ["gaw-api"]
