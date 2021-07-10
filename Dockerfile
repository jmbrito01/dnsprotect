FROM node:14

COPY . /usr/src/dnsprotect
WORKDIR /usr/src/dnsprotect 

RUN yarn install && yarn cache clean

ENTRYPOINT ["yarn", "cli"]

