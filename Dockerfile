FROM node:12
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3307
CMD ["npm","start"]
