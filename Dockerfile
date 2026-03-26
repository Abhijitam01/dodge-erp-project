FROM node:22-slim

# Install native build tools for better-sqlite3
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy server workspace only
COPY server/package.json server/pnpm-lock.yaml* ./server/
COPY data ./data

# Install pnpm
RUN npm install -g pnpm

# Force better-sqlite3 to compile from source for this platform (linux-x64)
# pnpm rebuild is unreliable with the .pnpm virtual store layout; this env var
# makes pnpm compile native modules from source during install instead.
ENV npm_config_build_from_source=true

WORKDIR /app/server
RUN pnpm install --frozen-lockfile
# Explicitly recompile better-sqlite3 for this Linux platform (the env var alone
# is sometimes ignored when pnpm uses a prebuilt binary from the lockfile cache).
RUN pnpm rebuild better-sqlite3

# Copy server source
COPY server/src ./src
COPY server/tsconfig.json ./

EXPOSE 3001

CMD ["pnpm", "start"]
