FROM node:5.10.0
RUN git clone git://github.com/DuoSoftware/DVP-ScheduleWorker.git /usr/local/src/scheduleworker
RUN cd /usr/local/src/scheduleworke;
WORKDIR /usr/local/src/scheduleworke
RUN npm install
EXPOSE 8852
CMD [ "node", "/usr/local/src/scheduleworke/app.js" ]
