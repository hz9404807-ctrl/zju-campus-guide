FROM node:24-alpine
WORKDIR /app
COPY dist/ ./dist/
COPY server.mjs ./server.mjs
USER node
EXPOSE 7860
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:7860/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server.mjs"]
