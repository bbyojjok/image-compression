# node version
FROM node:10

# dockerfile author
MAINTAINER lst

# dir
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# dependency
COPY ./app/package*.json ./
RUN npm install
RUN npm install -g nodemon

# source
COPY ./app ./

# port
EXPOSE 889

# runtime
CMD ["npm", "start"]
