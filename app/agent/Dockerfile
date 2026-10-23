FROM public.ecr.aws/docker/library/node:22-slim

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY main.ts ./
COPY domain ./domain
COPY memory ./memory
COPY model ./model
COPY tools ./tools
RUN npm run build && npm prune --omit=dev

USER node
EXPOSE 8080
CMD ["node", "dist/main.js"]
