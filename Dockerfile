
# Check out https://hub.docker.com/_/node to select a new base image
FROM node:16-alpine
# Install dependencies
# RUN npm install -g nodemon
# RUN npm i -g @loopback/cli
# Set to a non-root built-in user `node`
USER node
WORKDIR /app

# add `/app/node_modules/.bin` to $PATH
# ENV PATH /app/node_modules/.bin:$PATH

# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
# COPY --chown=node server/package*.json ./
# Install dependencies
# RUN npm install
# COPY --chown=node server/ .
EXPOSE 3000
CMD ["npm", "run", "start:dev"]
