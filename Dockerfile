FROM --platform=linux/amd64 node:18.17.0 as build

RUN apt-get update && apt-get install -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev postgresql-client

WORKDIR /opt/
COPY package.json yarn.lock wait-for-postgres.sh ./
COPY prisma ./prisma/
RUN yarn install --prod=false
COPY . ./
RUN pnpm build

###
EXPOSE 3000

CMD ["pnpm", "run", "start:prod"]
