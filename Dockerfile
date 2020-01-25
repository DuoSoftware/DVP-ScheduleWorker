# FROM node:5.10.0
# ARG VERSION_TAG
# RUN git clone -b $VERSION_TAG https://github.com/DuoSoftware/DVP-ScheduleWorker.git /usr/local/src/scheduleworker
# RUN cd /usr/local/src/scheduleworker;
# WORKDIR /usr/local/src/scheduleworker
# RUN npm install
# EXPOSE 8852
# CMD [ "node", "/usr/local/src/scheduleworker/app.js" ]

FROM node:10-alpine
WORKDIR /usr/local/src/scheduleworker
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 8852
CMD [ "node", "app.js" ]
