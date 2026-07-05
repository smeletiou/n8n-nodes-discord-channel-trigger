# Extends the official n8n image with our custom Discord Channel Trigger node,
# built inside the container so any native dependencies compile for the
# correct platform (rather than being copied over from the host).
FROM docker.n8n.io/n8nio/n8n:latest

USER root

# Copy only source files -- node_modules/dist are excluded via .dockerignore,
# so npm install runs fresh, targeting this container's OS/architecture.
COPY . /home/node/.n8n/custom/node_modules/n8n-nodes-discord-channel-trigger

RUN cd /home/node/.n8n/custom/node_modules/n8n-nodes-discord-channel-trigger && \
    npm install && \
    npm run build && \
    npm prune --omit=dev

USER node
