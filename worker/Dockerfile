FROM node:20-slim

RUN apt-get update && apt-get install -y \
    ffmpeg \
    wget \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Build context is the REPO ROOT (not worker/) so this Dockerfile can COPY
# the shared services/ subtree it compiles below — see
# tsconfig.worker.json's file header for why. Railway's service settings
# must have Root Directory = repo root and Dockerfile Path = worker/Dockerfile
# accordingly, not "worker" as the root directory.
#
# /repo mirrors the real repo layout 1:1 (services/ and worker/ as siblings)
# so tsconfig.worker.json's rootDir/outDir/include/paths all resolve exactly
# as they do when run locally from the repo root — no Docker-specific path
# special-casing to keep in sync.
WORKDIR /repo

COPY services/ ./services/
COPY tsconfig.worker.json ./tsconfig.worker.json

COPY worker/package*.json ./worker/
RUN cd worker && npm install

COPY worker/ ./worker/

# Compiles services/** (billing, infrastructure, workflow, ai, rendering,
# gpu, queue, movie — everything reachable from MovieProductionFactory's DI
# graph) into worker/dist/shared/services/**, redirecting
# @/lib/supabase/admin to this worker's own client via tsconfig.worker.json's
# paths remap. No changes to the shared source itself. tsc's `paths` only
# affects type-checking, not emitted require() calls — tsc-alias rewrites
# the compiled output's `require("@/...")` calls into real relative paths
# Node can actually resolve.
RUN npx tsc -p tsconfig.worker.json && npx --prefix worker tsc-alias -p tsconfig.worker.json

RUN cd worker && npm prune --production

WORKDIR /repo/worker

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "src/index.js"]
