FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY . .
USER node
EXPOSE 3000
CMD ["sh", "-c", "if [ \"$ALLOW_INDEX_CHANGES\" = true ]; then node scripts/check-production-indexes.js --apply --staging-only || exit $?; fi; exec node server.js"]
