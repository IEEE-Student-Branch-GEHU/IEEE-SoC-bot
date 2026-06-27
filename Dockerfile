FROM node:20

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Build Vite frontend and esbuild server
RUN npm run build

# Expose port 7860 for Hugging Face
EXPOSE 7860
ENV PORT=7860
ENV NODE_ENV=production

CMD ["npm", "start"]
