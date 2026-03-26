FROM node:22-slim

# Install native build tools + node-gyp globally
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm node-gyp

WORKDIR /app

COPY server/package.json server/pnpm-lock.yaml* ./server/
COPY data ./data

ENV npm_config_build_from_source=true

WORKDIR /app/server
RUN pnpm install --frozen-lockfile

# Rebuild better-sqlite3 from source directly inside the pnpm virtual store directory.
# pnpm rebuild does not place the .node file where the `bindings` module expects it;
# running node-gyp in the package directory fixes that.
RUN BSQ=$(find node_modules/.pnpm -maxdepth 3 -name "better-sqlite3" -type d | head -1) && \
    echo "Building in $BSQ" && cd "$BSQ" && node-gyp rebuild

COPY server/src ./src
COPY server/tsconfig.json ./

EXPOSE 3001
CMD ["pnpm", "start"]
