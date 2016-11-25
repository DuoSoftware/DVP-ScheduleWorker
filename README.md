# DVP-ScheduleWorker

DVP-ScheduleWorker is a module which help developers to add and fire schedules.

##### Works with

  - Cron patterns (  ex- * * * * * * )
  - Dates (ex - Fri Nov 25 2016 13:13:00 GMT+0630)
  
Important:
  - When user providing a Date , GMT Should be included.  (use moment.js to format datetime)

#### Parameters

- CronePattern     (cron pattern or date) 
- Description 
- CallbackURL   (URL which should be called when schedule time is arrived)
- CallbackData  ( Data which should be send to Callback URL, accept as String)
- Reference     (Unique reference)
