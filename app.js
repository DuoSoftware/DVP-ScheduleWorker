/**
 * Created by Pawan on 7/15/2016.
 */
var schedule = require('node-schedule');
var restify = require('restify');
var uuid = require('node-uuid');
var config = require('config');
var CroneHandler=require('./CronObjectHandler.js');

var jwt = require('restify-jwt');
var secret = require('dvp-common/Authentication/Secret.js');
var authorization = require('dvp-common/Authentication/Authorization.js');
var messageFormatter = require('dvp-common/CommonMessageGenerator/ClientMessageJsonFormatter.js');
var logger = require('dvp-common/LogHandler/CommonLogHandler.js').logger;
var Jobs =[];
restify.CORS.ALLOW_HEADERS.push('authorization');


var RestServer = restify.createServer({
    name: "myapp",
    version: '1.0.0'
},function(req,res)
{

});
RestServer.use(restify.CORS());
RestServer.use(restify.fullResponse());
RestServer.pre(restify.pre.userAgentConnection());
RestServer.use(jwt({secret: secret.Secret}));
var version=config.Host.version;

RestServer.listen(8080, function () {
    console.log('%s listening at %s', RestServer.name, RestServer.url);
    CroneHandler.RecoverJobs(Jobs);


});
RestServer.use(restify.bodyParser());
RestServer.use(restify.acceptParser(RestServer.acceptable));
RestServer.use(restify.queryParser());





RestServer.post('/DVP/API/'+version+'/Cron',authorization({resource:"template", action:"write"}), function (req,res,next) {
    console.log("HIT");
    var reqId = uuid.v1();
    req.body.UniqueId=reqId;
    var company = req.user.company;
    var tenant=req.user.tenant;


    console.log(req.body);

    CroneHandler.CroneDataRecorder(req.body,company,tenant, function (error,result) {

        console.log("---------------------- length start -------------------"+Jobs);
        if(error)
        {
            var jsonString = messageFormatter.FormatMessage(error, "ERROR", false, undefined);
            logger.debug('[DVP-CronScheduler.New Cron] - [%s] - Error',reqId,jsonString);
            res.end(jsonString);
        }
        else
        {
            var job = schedule.scheduleJob(req.body.CronePattern, function(){
                CroneHandler.CronCallbackHandler(reqId,result.Company,result.Tenant);
                Jobs[reqId] =job;

                job.on('canceled', function() {
                    CroneHandler.JobRemover(reqId,company,tenant, function (errRemv,resRemv)
                    {
                        if(errRemv)
                        {
                            var jsonString = messageFormatter.FormatMessage(errRemv, "ERROR", false, undefined);
                            logger.debug('[DVP-CronScheduler.New canceled] - [%s] - Cancelled job succeeded ',reqId,jsonString);
                            res.end(jsonString);
                        }
                        else
                        {
                            var jsonString = messageFormatter.FormatMessage(undefined, "SUCCESS", true, resRemv);
                            logger.debug('[DVP-CronScheduler.Cron canceled] - [%s] - Cancelled job removing failed',reqId,jsonString);
                            res.end(jsonString);
                        }
                    });
                });

                
            });




            var jsonString = messageFormatter.FormatMessage(undefined, "SUCCESS", true, reqId);
            logger.debug('[DVP-CronScheduler.New Cron] - [%s] - Successfully saved',reqId,jsonString);
            res.end(jsonString);

        }

    });


});

RestServer.del('/DVP/API/'+version+'/Cron/:id',authorization({resource:"template", action:"write"}), function (req,res,next) {

    var reqId = uuid.v1();

    var croneId=req.params.id;

    var company = req.user.company;
    var tenant=req.user.tenant;

    CroneHandler.JobRemover(croneId,company,tenant, function (errRemv,resRemv) {

        if(errRemv )
        {
            var jsonString = messageFormatter.FormatMessage(errRemv, "ERROR", false, undefined);
            logger.debug('[DVP-CronScheduler.New Cron] - [%s] - Error in removing',reqId,jsonString);
            res.end(jsonString);
        }
        else
        {
            var jsonString = messageFormatter.FormatMessage(undefined, "SUCCESS", true, resRemv);
            logger.debug('[DVP-CronScheduler.New Cron] - [%s] - Successfully removed',reqId,jsonString);
            res.end(jsonString);
        }

        res.end();


    });

    return next();
});

RestServer.put('/DVP/API/'+version+'/Cron/:id',authorization({resource:"template", action:"write"}), function (req,res,next) {

    var reqId = uuid.v1();

    var croneId=req.params.id;

    var company = req.user.company;
    var tenant=req.user.tenant;

    CroneHandler.CroneObjectUpdater(croneId,company,tenant,req.body, function (err,response) {
        if(err)
        {
            var jsonString = messageFormatter.FormatMessage(err, "ERROR", false, undefined);
            logger.debug('[DVP-CronScheduler.update Cron] - [%s] - Updation error',reqId,jsonString);
            res.end(jsonString);
        }
        else
        {
            var jsonString = messageFormatter.FormatMessage(undefined, "SUCCESS", true, response);
            logger.debug('[DVP-CronScheduler.update Cron] - [%s] - Updation success',reqId,jsonString);
            res.end(jsonString);
        }


    });

    return next();
});

RestServer.get('/DVP/API/'+version+'/Cron/:id',authorization({resource:"template", action:"read"}), function (req,res,next) {

    var reqId = uuid.v1();

    var croneId=req.params.id;

    var company = req.user.company;
    var tenant=req.user.tenant;

    CroneHandler.PickCronById(croneId,company,tenant, function (err,response) {
        if(err)
        {
            var jsonString = messageFormatter.FormatMessage(err, "ERROR", false, undefined);
            logger.debug('[DVP-CronScheduler.Pick Cron] - [%s] - Picking cron error',reqId,jsonString);
            res.end(jsonString);
        }
        else
        {
            var jsonString = messageFormatter.FormatMessage(undefined, "SUCCESS", true, response);
            logger.debug('[DVP-CronScheduler.Pick Cron] - [%s] - Picking cron success',reqId,jsonString);
            res.end(jsonString);
        }


    });

    return next();
});

RestServer.get('/DVP/API/'+version+'/Crons',authorization({resource:"template", action:"read"}), function (req,res,next) {

    var reqId = uuid.v1();

    var croneId=req.params.id;

    var company = req.user.company;
    var tenant=req.user.tenant;

    CroneHandler.PickAllCrons(company,tenant, function (err,response) {
        if(err)
        {
            var jsonString = messageFormatter.FormatMessage(err, "ERROR", false, undefined);
            logger.debug('[DVP-CronScheduler.Pick Crons] - [%s] - Picking cron error',reqId,jsonString);
            res.end(jsonString);
        }
        else
        {
            var jsonString = messageFormatter.FormatMessage(undefined, "SUCCESS", true, response);
            logger.debug('[DVP-CronScheduler.Pick Crons] - [%s] - Picking crons success',reqId,jsonString);
            res.end(jsonString);
        }


    });

    return next();
});


RestServer.post('/DVP/API/'+version+'/Cron/test', function (req,res,next) {

    console.log(req.body.Message);
    res.end();


    return next();
});