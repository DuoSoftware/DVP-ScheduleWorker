/**
 * Created by Pawan on 7/15/2016.
 */
var schedule = require('node-schedule');
var cronJob=require('cron').CronJob;
var restify = require('restify');
var uuid = require('node-uuid');
var config = require('config');
var CroneHandler=require('./CronObjectHandler.js');
var parser = require('cron-parser');

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

RestServer.listen(config.Host.port, function () {
    console.log('%s listening at %s', RestServer.name, RestServer.url);
    //CroneHandler.RecoverJobs(Jobs);




});

RestServer.use(restify.bodyParser());
RestServer.use(restify.acceptParser(RestServer.acceptable));
RestServer.use(restify.queryParser());






// Should pick referenceID from request as reqId, then store data with reqId. when new request from same referenceID cron object in DB should updated and current cron should removed and re started
RestServer.post('/DVP/API/'+version+'/Cron',authorization({resource:"template", action:"write"}), function (req,res,next) {

    console.log("HIT");

    var reqId = uuid.v1();
    req.body.UniqueId=reqId;
    var company = req.user.company;
    var tenant=req.user.tenant;
    var pattern="";
    var checkDate=false;
    var expiredDate=false;


    try {
        var isValidPattern = parser.parseExpression(req.body.CronePattern);
        if(isValidPattern)
        {
            pattern=req.body.CronePattern;
            checkDate=false;
        }
        //console.log(interval);
    }
    catch(e)
    {
        pattern= new Date(req.body.CronePattern);
        if (pattern<new Date())
        {
            expiredDate=true;
            var jsonString = messageFormatter.FormatMessage(new Error("Expired date/time"), "ERROR", false, undefined);
            logger.debug('[DVP-CronScheduler.New Cron] - [%s] - Invalid date/time',reqId,jsonString);
            res.end(jsonString);
        }
        else
        {
            checkDate=true;
        }

    }



    if(!expiredDate)
    {
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


                var cronObj=req.body;
                var pushObj ={
                    CronePattern:pattern,
                    Timezone:cronObj.Timezone,
                    UniqueId:cronObj.UniqueId,
                    callback:{CallbackURL:cronObj.CallbackURL,CallbackData:cronObj.CallbackData,company:company,tenant:tenant,pattern:pattern},
                    checkDate:checkDate


                }

                CroneHandler.publishToCreateJobs(pushObj,company,tenant);
                /*var job=new cronJob(pattern, function() {
                    CroneHandler.CronCallbackHandler(reqId,result.Company,result.Tenant, function (err,response) {

                        if(err)
                        {
                            console.log(err);
                        }
                        else
                        {
                            if(checkDate)
                            {
                                delete Jobs[reqId];

                                CroneHandler.JobRemover(reqId,company,tenant, function (errRemove,resRemove) {
                                    if(errRemove)
                                    {
                                        console.log("Error in object cache removing");
                                    }
                                    else
                                    {
                                        console.log("Object cache removed successfully");
                                    }
                                });

                            }
                        }

                    });


                }, null, false,req.body.Timezone);*/





                /*Jobs[reqId] =job;
                job.start();*/







                var jsonString = messageFormatter.FormatMessage(undefined, "SUCCESS", true, reqId);
                logger.debug('[DVP-CronScheduler.New Cron] - [%s] - Successfully saved',reqId,jsonString);
                res.end(jsonString);

            }

        });
    }



    return next();
});

RestServer.del('/DVP/API/'+version+'/Cron/:id',authorization({resource:"template", action:"write"}), function (req,res,next) {

    var reqId = uuid.v1();

    var croneId=req.params.id;

    var company = req.user.company;
    var tenant=req.user.tenant;


    CroneHandler.JobRemover(croneId,company,tenant, function (errRemv,resRemv) {

        /*delete Jobs[reqId];*/
        CroneHandler.publishToRemoveJobs(croneId,company,tenant);

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




    });

    return next();
});

RestServer.del('/DVP/API/'+version+'/Cron/Reference/:id',authorization({resource:"template", action:"write"}), function (req,res,next) {

    var reqId = uuid.v1();

    var croneId=req.params.id;

    var company = req.user.company;
    var tenant=req.user.tenant;

    console.log("Reference ID: "+croneId);

    CroneHandler.PickJobRecordByReference(croneId,company,tenant, function (errData,resData) {

        if(errData)
        {
            var jsonString = messageFormatter.FormatMessage(errData, "ERROR", false, undefined);
            logger.error('[DVP-CronScheduler.Delete Cron by ref] - [%s] - Error in searching cron',reqId,jsonString);
            res.end(jsonString);
        }
        else
        {
            CroneHandler.JobRemover(resData.UniqueId,company,tenant, function (errRemv,resRemv) {
                CroneHandler.publishToRemoveJobs(resData.UniqueId,company,tenant);

                if(errRemv )
                {

                    var jsonString = messageFormatter.FormatMessage(errRemv, "ERROR", false, undefined);
                    logger.error('[DVP-CronScheduler.Delete Cron by ref] - [%s] - Error in removing',reqId,jsonString);
                    res.end(jsonString);
                }
                else
                {

                    var jsonString = messageFormatter.FormatMessage(undefined, "SUCCESS", true, resRemv);
                    logger.debug('[DVP-CronScheduler.Delete Cron by ref] - [%s] - Successfully removed',reqId,jsonString);
                    res.end(jsonString);
                }



            });

        }

    });


    return next();
});


RestServer.put('/DVP/API/'+version+'/Cron/:id',authorization({resource:"template", action:"write"}), function (req,res,next) {

    var reqId = uuid.v1();

    var croneId=req.params.id;

    var company = req.user.company;
    var tenant=req.user.tenant;

    CroneHandler.publishToRemoveJobs(croneId,company,tenant);
    var pattern="";
    var checkDate=false;
    var expiredDate=false;
    req.body.checkDate=checkDate;

    if(req.body.CronePattern)
    {
        try {
            var isValidPattern = parser.parseExpression(req.body.CronePattern);
            if(isValidPattern)
            {
                pattern=req.body.CronePattern;
                checkDate=false;
                req.body.checkDate=checkDate;
            }
            //console.log(interval);
        }
        catch(e)
        {
            pattern= new Date(req.body.CronePattern);
            if (pattern<new Date())
            {
                expiredDate=true;
                var jsonString = messageFormatter.FormatMessage(new Error("Expired date/time"), "ERROR", false, undefined);
                logger.debug('[DVP-CronScheduler.New Cron] - [%s] - Invalid date/time',reqId,jsonString);
                res.end(jsonString);
            }
            else
            {
                checkDate=true;
                req.body.checkDate=checkDate;
            }

        }
    }






    CroneHandler.CroneObjectUpdater(croneId,company,tenant,req.body, function (err,response) {
        if(err)
        {
            var jsonString = messageFormatter.FormatMessage(err, "ERROR", false, undefined);
            logger.debug('[DVP-CronScheduler.update Cron] - [%s] - Updation error',reqId,jsonString);
            res.end(jsonString);
        }
        else
        {

            var cronObj=req.body;
            var pushObj ={
                CronePattern:cronObj.CronePattern,
                Timezone:cronObj.Timezone,
                UniqueId:cronObj.UniqueId,
                callback:{CallbackURL:cronObj.CallbackURL,CallbackData:cronObj.CallbackData,company:company,tenant:tenant,pattern:cronObj.CronePattern}



            }

            CroneHandler.publishToCreateJobs(pushObj,company,tenant);


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

RestServer.post('/DVP/API/'+version+'/Cron/:id/Action/:action',authorization({resource:"template", action:"write"}), function (req,res,next){

    var croneId=req.params.id;

    var company = req.user.company;
    var tenant=req.user.tenant;
    var action=req.params.action;

    /*if(Jobs[croneId])
    {*/
    if(action=="stop")
    {
        //Jobs[croneId].stop();
        CroneHandler.publishToRemoveJobs(croneId,company,tenant);
        var jsonString = messageFormatter.FormatMessage(undefined, "SUCCESS", true, croneId);
        logger.debug('[DVP-CronScheduler.New Cron] - [%s] - Job successfully '+action+"ed",croneId,jsonString);
        res.end(jsonString);

    }
    else if(action=="start")
    {
        //Jobs[croneId].start()
        CroneHandler.restartCronJob(croneId,company,tenant);
        var jsonString = messageFormatter.FormatMessage(undefined, "SUCCESS", true, croneId);
        logger.debug('[DVP-CronScheduler.New Cron] - [%s] - Job successfully '+action+"ed",croneId,jsonString);
        res.end(jsonString);
    }
    else if(action=="destroy")
    {
        /*Jobs[croneId].stop();
        delete Jobs[croneId];*/
        CroneHandler.publishToRemoveJobs(croneId,company,tenant);
        CroneHandler.JobRemover(croneId,company,tenant, function (errRemove,resRemove) {

            if(errRemove)
            {
                var jsonString = messageFormatter.FormatMessage(err, "ERROR", false, undefined);
                logger.debug('[DVP-CronScheduler.Cron Actions] - [%s] - Cron Action failed',croneId,jsonString);
                res.end(jsonString);
            }
            else
            {
                var jsonString = messageFormatter.FormatMessage(undefined, "SUCCESS", true, resRemove);
                logger.debug('[DVP-CronScheduler.Cron Actions] - [%s] - Cron Action succeeded',croneId,jsonString);
                res.end(jsonString);
            }
        });
    }
    else
    {
        var jsonString = messageFormatter.FormatMessage(new Error("Invalid Action found"), "ERROR", false, undefined);
        logger.debug('[DVP-CronScheduler.New Cron] - [%s] - Invalid Action found : '+action,croneId,jsonString);
        res.end(jsonString);
    }
    /* }*/

    /*else
    {
        var jsonString = messageFormatter.FormatMessage(new Error("Invalid Reference"), "ERROR", false, croneId);
        logger.debug('[DVP-CronScheduler.New Cron] - [%s] - Invalid Reference',croneId,jsonString);
        res.end(jsonString);
    }*/


    return next();

});

RestServer.post('/DVP/API/'+version+'/Cron/Reference/:id/Action/:action',authorization({resource:"template", action:"write"}), function (req,res,next){

    var croneId="";

    var company = req.user.company;
    var tenant=req.user.tenant;
    var action=req.params.action;

    CroneHandler.PickJobRecordByReference(req.params.id,company,tenant, function (errData,resData) {

        if(errData)
        {
            var jsonString = messageFormatter.FormatMessage(errData, "ERROR", false, undefined);
            logger.debug('[DVP-CronScheduler.Cron Actions] - [%s] - Cron Action failed',croneId,jsonString);
            res.end(jsonString);
        }
        else
        {
            if(resData)
            {
                croneId=resData.UniqueId;

                if(Jobs[croneId])
                {
                    if(action=="stop")
                    {
                        //Jobs[croneId].stop();
                        CroneHandler.publishToRemoveJobs(croneId,company,tenant);
                        var jsonString = messageFormatter.FormatMessage(undefined, "SUCCESS", true, croneId);
                        logger.debug('[DVP-CronScheduler.New Cron] - [%s] - Job successfully '+action+"ed",croneId,jsonString);
                        res.end(jsonString);


                    }
                    else if(action=="start")
                    {
                        //Jobs[croneId].start();
                        CroneHandler.restartCronJob(croneId,company,tenant);
                        var jsonString = messageFormatter.FormatMessage(undefined, "SUCCESS", true, croneId);
                        logger.debug('[DVP-CronScheduler.New Cron] - [%s] - Job successfully '+action+"ed",croneId,jsonString);
                        res.end(jsonString);
                    }
                    else if(action=="destroy")
                    {
                        /*Jobs[croneId].stop();
                        delete Jobs[croneId];*/
                        CroneHandler.publishToRemoveJobs(croneId,company,tenant);
                        CroneHandler.JobRemover(croneId,company,tenant, function (errRemove,resRemove) {

                            if(errRemove)
                            {
                                var jsonString = messageFormatter.FormatMessage(err, "ERROR", false, undefined);
                                logger.debug('[DVP-CronScheduler.Cron Actions] - [%s] - Cron Action failed',croneId,jsonString);
                                res.end(jsonString);
                            }
                            else
                            {
                                var jsonString = messageFormatter.FormatMessage(undefined, "SUCCESS", true, resRemove);
                                logger.debug('[DVP-CronScheduler.Cron Actions] - [%s] - Cron date removing succeeded',croneId,jsonString);
                                res.end(jsonString);
                            }
                        });
                    }

                    else
                    {
                        var jsonString = messageFormatter.FormatMessage(new Error("Invalid Action found"), "ERROR", false, croneId);
                        logger.debug('[DVP-CronScheduler.New Cron] - [%s] - Invalid Action found',croneId,jsonString);
                        res.end(jsonString);
                    }
                }
                else
                {
                    var jsonString = messageFormatter.FormatMessage(new Error("Invalid Reference"), "ERROR", false, croneId);
                    logger.debug('[DVP-CronScheduler.New Cron] - [%s] - Invalid Reference',croneId,jsonString);
                    res.end(jsonString);
                }



            }
            else
            {
                var jsonString = messageFormatter.FormatMessage(new Error("No job data found"), "ERROR", false, croneId);
                logger.debug('[DVP-CronScheduler.New Cron] - [%s] - No job data found',croneId,jsonString);
                res.end(jsonString);
            }


        }
    });



    return next();

});

RestServer.post('/DVP/API/'+version+'/Crons/Recover',authorization({resource:"template", action:"write"}), function (req,res,next){

    var Ids =[];
    var workerId="";
    var company = req.user.company;
    var tenant=req.user.tenant;
    var reqId = uuid.v1();


    if(req.body && req.body.Ids)
    {
        Ids=req.body.Ids;
    }
    if(req.body && req.body.workerId)
    {
        Ids=req.body.workerId;
    }

    console.log(Ids);

    if(Ids.length>0)
    {
        CroneHandler.PickJobsByIds(Ids,company,tenant, function (errData,resData) {

            if(errData)
            {
                var jsonString = messageFormatter.FormatMessage(errData, "ERROR", false, undefined);
                logger.error('[DVP-CronScheduler.Cron Actions] - [%s] - Cron data not found',reqId,jsonString);
                res.end(jsonString);
            }
            else
            {
                var result =[];
                resData.forEach(function (item) {
                    var isExpired=false;

                    item.checkDate=false;
                    try
                    {
                        var isValidPattern = parser.parseExpression(item.CronePattern);
                        if(!isValidPattern)
                        {
                            var jsonString = messageFormatter.FormatMessage(undefined, "INFO", true, "Valid pattern found");
                            logger.info('[DVP-ScheduledJobManager.Cron validation] -  INFO ',jsonString);
                            item.checkDate=false;
                            removeStoredCronId(workerId,0,item.UniqueId);
                        }
                    }
                    catch (e) {

                        var pattern= new Date(item.CronePattern);
                        if (pattern<new Date())
                        {
                            isExpired=true;
                            removeStoredCronId(workerId,0,item.UniqueId);
                        }
                        else
                        {
                            item.checkDate=false;
                        }
                    }

                    if(!isExpired)
                    {
                        result.push(item);
                    }
                    else
                    {

                        CroneHandler.JobCacheRemover(item.UniqueId,company,tenant,function (e,r) {
                            console.log(e);
                            console.log(r);
                        });
                    }
                });






                var jsonString = messageFormatter.FormatMessage(undefined, "SUCCESS", true, result);
                logger.debug('[DVP-CronScheduler.Cron Actions] - [%s] - Crondata found',reqId,jsonString);
                res.end(jsonString);


            }
        });
    }
    else
    {
        var jsonString = messageFormatter.FormatMessage(new Error("No Job Ids received"), "ERROR", false, croneId);
        logger.debug('[DVP-CronScheduler.New Cron] - [%s] - No Job Ids received',reqId,jsonString);
        res.end(jsonString);
    }






    return next();

});


RestServer.post('/DVP/API/'+version+'/Cron/test', function (req,res,next) {

    console.log(req.body);
    console.log(req.body.iss);
    res.end();


    return next();
});