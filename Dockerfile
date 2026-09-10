# Продакшен-образ Luxury House Calculator: один контейнер, один порт (4000).
# Сервер (Express) раздаёт собранный клиент (React) как статику и обслуживает /api/*.
# База данных — SQLite-файл на смонтированном томе (см. docker-compose.yml).

FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY calc-engine/package.json calc-engine/package.json
COPY server/package.json server/package.json
COPY client/package.json client/package.json
RUN npm install

COPY . .
RUN npm run build -w calc-engine
RUN npm run build -w server
RUN npm run build -w client

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/calc-engine ./calc-engine
COPY --from=build /app/server ./server
COPY --from=build /app/client/dist ./client/dist
COPY --from=build /app/data ./data

# Постоянное хранилище — база данных и загруженные PDF монтируются сюда как том Docker,
# чтобы данные переживали пересборку/перезапуск контейнера (см. docker-compose.yml).
RUN mkdir -p /app/data-volume

EXPOSE 4000

# db push синхронизирует схему при каждом старте контейнера — идемпотентно при отсутствии
# изменений схемы; на потенциально разрушительное изменение схемы команда откажет выполняться
# без явного --accept-data-loss (безопасное поведение по умолчанию). Полноценные миграции
# можно добавить позже через `prisma migrate`, когда потребуется история изменений схемы.
CMD ["sh", "-c", "cd server && npx prisma db push --skip-generate && node dist/index.js"]
