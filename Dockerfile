FROM node:5.10.0
RUN git clone git://github.com/DuoSoftware/DVP-ScheduleWorker.git /usr/local/src/scheduleworker
RUN cd /usr/local/src/scheduleworker;
WORKDIR /usr/local/src/scheduleworker
RUN npm install
EXPOSE 8852
CMD [ "node", "/usr/local/src/scheduleworker/app.js" ]
