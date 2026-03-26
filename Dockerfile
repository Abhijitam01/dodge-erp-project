FROM node:22-slim

# Install native build tools for better-sqlite3
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy server workspace only
COPY server/package.json server/pnpm-lock.yaml* ./server/
COPY data ./data

# Install pnpm
RUN npm install -g pnpm

# Install server dependencies, then force-recompile better-sqlite3 for this platform
WORKDIR /app/server
RUN pnpm install --frozen-lockfile
RUN pnpm rebuild better-sqlite3

# Copy server source
COPY server/src ./src
COPY server/tsconfig.json ./

EXPOSE 3001

CMD ["pnpm", "start"]
