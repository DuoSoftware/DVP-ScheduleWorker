/**
 * Created by Pawan on 7/15/2016.
 */
var DbConn = require('dvp-dbmodels');
var cronJob=require('cron').CronJob;
var httpReq = require('request');
var util = require('util');
var format=require('stringformat');
var config = require('config');
var async= require('async');
var schedule = require('node-schedule');
var authToken = config.Token;

var parser = require('cron-parser');


var redis=require('ioredis');


var redisip = config.Redis.ip;
var redisport = config.Redis.port;
var redispass = config.Redis.password;
var redismode = config.Redis.mode;
var redisdb = config.Redis.db;



var redisSetting =  {
    port:redisport,
    host:redisip,
    family: 4,
    password: redispass,
    db: redisdb,
    retryStrategy: function (times) {
        var delay = Math.min(times * 50, 2000);
        return delay;
    },
    reconnectOnError: function (err) {

        return true;
    }
};

if(redismode == 'sentinel'){

    if(config.Redis.sentinels && config.Redis.sentinels.hosts && config.Redis.sentinels.port && config.Redis.sentinels.name){
        var sentinelHosts = config.Redis.sentinels.hosts.split(',');
        if(Array.isArray(sentinelHosts) && sentinelHosts.length > 2){
            var sentinelConnections = [];

            sentinelHosts.forEach(function(item){

                sentinelConnections.push({host: item, port:config.Redis.sentinels.port})

            })

            redisSetting = {
                sentinels:sentinelConnections,
                name: config.Redis.sentinels.name,
                password: redispass,
                db: redisdb
            }

        }else{

            console.log("No enough sentinel servers found .........");
        }

    }
}

var redisClient = undefined;

if(redismode != "cluster") {
    redisClient = new redis(redisSetting);
}else{

    var redisHosts = redisip.split(",");
    if(Array.isArray(redisHosts)){


        redisSetting = [];
        redisHosts.forEach(function(item){
            redisSetting.push({
                host: item,
                port: redisport,
                family: 4,
                password: redispass,
                db: redisdb});
        });

        var redisClient = new redis.Cluster([redisSetting]);

    }else{

        redisClient = new redis(redisSetting);
    }


}


redisClient.on("error", function (err) {
    console.log("Redis connection error  " + err);
});

redisClient.on("connect", function (err) {
});









/*var port = config.Redis.port || 3000;
var ip = config.Redis.ip;
var password = config.Redis.password;




var client = redis.createClient(port,ip);
client.auth(password, function (error) {
    console.log("Redis Auth Error " + error);
});

client.on("error", function (err) {
    console.log("Error " + err);


});*/



function CroneDataRecorder(cronObj,company,tenant,callback)
{

    DbConn.Cron.find({where:[{Reference: cronObj.Reference.toString()},{Company: company},{Tenant:tenant}]}).then(function (resCheckAvailable) {

        if(!resCheckAvailable)
        {
            var CronObj = DbConn.Cron
                .build(
                    {
                        UniqueId: cronObj.UniqueId,
                        Description: cronObj.Description,
                        CronePattern: cronObj.CronePattern,
                        CallbackURL: cronObj.CallbackURL,
                        CallbackData: cronObj.CallbackData,
                        Company:company,
                        Tenant:tenant,
                        Reference:cronObj.Reference,
                        Timezone:cronObj.Timezone


                    }
                );
            CronObj.save().then(function (result)
            {
                /*var jobRecStatus=JobDetailsRecorder(cronObj.UniqueId,company,tenant);
                result.CachedStatus=jobRecStatus;*/
                callback(undefined,result);
            }).catch(function (error) {
                callback(error,undefined);
            });
        }
        else
        {
            callback(new Error("Cron in use"),undefined);
        }

    }).catch(function (errCheckAvailable) {
        callback(errCheckAvailable,undefined);
    })




};

function CronCallbackHandler(croneUuid,company,tenant,callback)
{
    DbConn.Cron.find({where:{UniqueId:croneUuid}}).then(function (result) {

        if(!result)
        {
            console.log("No record found");
            callback(new Error("No record found"),undefined);

        }
        else
        {
            console.log("Calling callback service : " + result.CallbackURL + " for cron pattern : " + result.CronePattern);
            var croneCallbacks =
                {
                    url: result.CallbackURL,
                    method: "POST",
                    headers: {
                        'authorization': "bearer "+authToken,
                        'companyinfo': format("{0}:{1}", tenant, company),
                        'content-type': 'application/json'
                    }};

            if(result.CallbackData)
            {
                croneCallbacks.body = result.CallbackData;
            }


            httpReq(croneCallbacks, function (error, response, data) {

                if(error)
                {
                    console.log("ERROR sending request "+error);
                    callback(error,undefined);
                }
                else if (!error && response != undefined ) {

                    console.log("resp "+response);
                    callback(undefined,response);
                    //console.log("Sent "+JSON.parse(data)+" To "+result.CallbackURL);

                }
                else
                {
                    callback(new Error("Error in operation"),undefined);
                }
            });
        }

    }).catch(function (error) {
        console.log(error);
        callback(error,undefined);
    })
};

function JobDetailsRecorder(croneUuid,company,tenent)
{

    var jobKey = "CRON:"+croneUuid+":"+company+":"+tenent;

    redisClient.set(jobKey,croneUuid, function (error,result) {

        if(error)
        {
            return false;
        }
        else
        {
            return true;
        }
    });
};

function JobDetailsPicker(callback)
{

    var searchKey = "CRON:*";

    redisClient.keys(searchKey, function (error,result) {

        if(error)
        {
            callback(error,undefined);
        }
        else
        {

            callback(undefined,result);



        }
    });
};

function JobRecordPicker(jobId,callback)
{
    DbConn.Cron.find({where:{UniqueId:jobId}}).then(function (result) {

        if(result)
        {
            callback(undefined,result);
        }
        else
        {

            var ErrorObj =
                {
                    message:"No job record found",
                    stack:undefined
                }
            callback(ErrorObj,undefined);
        }


    }).catch(function (error) {

        callback(error,undefined);
    });
};

function PickJobRecordByReference(ref,company,tenant,callback)
{
    DbConn.Cron.find({where:[{Reference:ref},{Company: company},{Tenant:tenant}]}).then(function (result) {

        if(result)
        {
            callback(undefined,result);
        }
        else
        {
            var ErrorObj =
                {
                    message:"No job record found",
                    stack:undefined
                }
            callback(ErrorObj,undefined);
        }


    }).catch(function (error) {

        callback(error,undefined);
    });
};

function RecoverJobs(Jobs)
{
    var JobkeyArray=[];

    JobDetailsPicker(function (errJobs,resJobKeys) {

        if(errJobs)
        {
            console.log(errJobs);
        }
        else
        {
            console.log("job count "+resJobKeys.length);
            resJobKeys.forEach(function (key) {


                JobkeyArray.push(function createContact(callback)
                {
                    var cronId=key.split(":")[1];
                    JobRecordPicker(cronId, function (error,result) {

                        if(result)
                        {

                            var pattern="";
                            var checkDate=false;
                            var expiredDate=false;

                            if(isNaN(Date.parse(result.CronePattern)))
                            {
                                pattern=result.CronePattern;
                                checkDate=false;
                            }
                            else
                            {
                                pattern= new Date(result.CronePattern);
                                if (pattern<new Date())
                                {
                                    expiredDate=true;
                                    console.log("Invalid Key");
                                    JobRemover(cronId,result.Company,result.Tenant, function (errRemove,resRemove) {
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
                                else
                                {
                                    checkDate=true;
                                }


                            }

                            if(!expiredDate)
                            {

                                var job=new cronJob(pattern, function() {
                                    CronCallbackHandler(cronId,result.Company,result.Tenant, function (errCallback,resCallback) {
                                        if(errCallback)
                                        {
                                            console.log(errCallback);
                                        }
                                    });

                                    if(!isNaN(Date.parse(result.CronePattern)))
                                    {
                                        delete Jobs[cronId];

                                        JobRemover(cronId,result.Company,result.Tenant, function (errRemove,resRemove) {

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

                                }, null, false,result.Timezone);

                                Jobs[cronId] =job;
                                job.start();
                            }



                            /*var checkDate = new Date(result.CronePattern);

                             if(checkDate)
                             {
                             pattern=checkDate;
                             }
                             else
                             {
                             pattern=result.CronePattern;
                             }


                             var job=new cronJob(pattern, function() {
                             CronCallbackHandler(cronId,result.Company,result.Tenant);

                             if(checkDate)
                             {
                             delete Jobs[reqId];

                             JobCacheRemover(cronId,result.Company,result.Tenant, function (errCache,resChache) {

                             if(errCache)
                             {
                             console.log("Error in object cache removing");
                             }
                             else
                             {
                             console.log("Object cache removed successfully");
                             }
                             });
                             }

                             }, null, false);

                             Jobs[cronId] =job;
                             job.start();*/

                            /*
                             var job = schedule.scheduleJob(result.CronePattern, function(){
                             CronCallbackHandler(cronId,result.Company,result.Tenant);
                             Jobs[cronId] =job;

                             });*/
                        }

                        callback(error,Jobs);

                    });


                });

            });
            async.parallel(JobkeyArray, function (errBulkSend,resSend) {

                if(errBulkSend)
                {
                    console.log(errBulkSend);
                    //res.end(errBulkSend.toString());
                }


            });
        }

    });
};

function JobCacheRemover(croneUuid,company,tenant,callback)
{
    var jobKey = "CRON:"+croneUuid+":"+company+":"+tenant;
    redisClient.del(jobKey, function (err,res) {
        callback(err,res);
    });
}

function JobObjectRemover(croneUuid,company,tenant,callback)
{
    DbConn.Cron.destroy({where:[{UniqueId:croneUuid},{Company:company},{Tenant:tenant}]}).then(function (result) {
        console.log("Job object record removed from DB");
        callback(result,undefined);
    }).catch(function (error) {
        console.log("Job object record removing error ");
        callback(undefined,error);

    });


};

function JobRemover(croneUuid,company,tenant,callback)
{

    JobObjectRemover(croneUuid,company,tenant, function (errRemObj,resRemObj) {

        if(errRemObj)
        {
            callback(errRemObj,undefined);
        }
        else
        {
            callback(undefined,resRemObj);
        }
       /* JobCacheRemover(croneUuid,company,tenant, function (errRemCahe,resCache) {

            if(errRemCahe)
            {
                callback(errRemCahe,undefined);
            }
            else
            {
                callback(undefined,resCache);
            }


        });*/
    });
};

function CroneObjectUpdater(croneUuid,company,tenant,cronData,callback)
{
    if(cronData.croneUuid)
    {
        delete cronData.UniqueId
    }
    if(cronData.CronePattern && !cronData.checkDate)
    {
        delete cronData.CronePattern;
    }
    if(cronData.Company)
    {
        delete cronData.Company;
    }
    if(cronData.Tenant)
    {
        delete cronData.Tenant;
    }
    if(cronData.Reference)
    {
        delete cronData.Reference;
    }



    DbConn.Cron.find({where:[{UniqueId:croneUuid},{Company:company},{Tenant:tenant}]}).then(function (result) {

        if(result)
        {
            result.updateAttributes(cronData).then(function (resUpdate) {
                callback(undefined,resUpdate);

            }).catch(function (errUpdate) {
                callback(errUpdate,undefined);
            })
        }
        else
        {
            callback(new Error("no record found"),undefined);
        }

    }).catch(function (error) {
        callback(error,undefined);
    })
};

function PickAllCrons(company,tenant,callback)
{
    DbConn.Cron.findAll({where:[{Company:company},{Tenant:tenant}]}).then(function (result) {
        callback(undefined,result);
    }).catch(function (error) {
        callback(error,undefined);
    });
};

function PickCronById(croneUuid,company,tenant,callback)
{
    DbConn.Cron.find({where:[{UniqueId:croneUuid},{Company:company},{Tenant:tenant}]}).then(function (result) {
        callback(undefined,result);
    }).catch(function (error) {
        callback(error,undefined);
    });
};


var publishToCreateJobs = function(pushObj,company,tenant)
{
    var jobQueue=tenant+":"+company+":cron:jobqueue";
    redisClient.rpush(jobQueue,JSON.stringify(pushObj));
}
var publishToRemoveJobs = function(jobId,company,tenant)
{
    var remJobQueue=tenant+":"+company+":cron:removequeue";
    redisClient.publish(remJobQueue,jobId);
};

function PickJobsByIds(ids,company,tenant,callback)
{
    var queryObj = {
        Company: company,
        Tenant:tenant,
        $or:[]
    }

    ids.forEach(function (item) {
        queryObj.$or.push({UniqueId:{$eq:item}});
    })

    DbConn.Cron.findAll({where:queryObj}).then(function (result) {

        if(result)
        {
            callback(undefined,result);
        }
        else
        {
            var ErrorObj =
                {
                    message:"No job record found",
                    stack:undefined
                }
            callback(ErrorObj,undefined);
        }


    }).catch(function (error) {

        callback(error,undefined);
    });
};

function restartCronJob(cronId,company,tenant)
{
    PickCronById(cronId,company,tenant,function (e,r) {
        if(e)
        {
            var jsonString = messageFormatter.FormatMessage(e, "ERROR", false, undefined);
            logger.debug('[DVP-CronScheduler.restartCronJob] - [%s] - Error in searching cron record',cronId,jsonString);
        }
        else
        {
            var expiredDate =false;
            var pattern ="";
            try {
                var isValidPattern = parser.parseExpression(r.CronePattern);
                if(isValidPattern)
                {
                    pattern=r.CronePattern;

                }
                //console.log(interval);
            }
            catch(e)
            {
                pattern= new Date(r.CronePattern);
                if (pattern<new Date())
                {
                    expiredDate=true;
                    var jsonString = messageFormatter.FormatMessage(new Error("Expired date/time"), "ERROR", false, undefined);
                    logger.debug('[DVP-CronScheduler.restartCronJob] - [%s] - Invalid date/time',cronId,jsonString);

                }
                else
                {
                    expiredDate=false;
                }

            }

            if(!expiredDate)
            {
                var datObj ={
                    CronePattern:pattern,
                    Timezone:r.Timezone,
                    UniqueId:r.UniqueId,
                    callback:{CallbackURL:r.CallbackURL,CallbackData:r.CallbackData,company:company,tenant:tenant,pattern:r.CronePattern}

                }
                publishToCreateJobs(datObj,company,tenant);
            }
        }
    })
}

function removeStoredCronId (workerId,cronId)
{
    redisClient.lrem(workerId,0,cronId);
}



module.exports.CroneDataRecorder = CroneDataRecorder;
module.exports.CronCallbackHandler = CronCallbackHandler;
module.exports.JobDetailsPicker = JobDetailsPicker;
module.exports.RecoverJobs = RecoverJobs;
module.exports.JobRemover = JobRemover;
module.exports.CroneObjectUpdater = CroneObjectUpdater;
module.exports.PickAllCrons = PickAllCrons;
module.exports.PickCronById = PickCronById;
module.exports.JobCacheRemover = JobCacheRemover;
module.exports.PickJobRecordByReference = PickJobRecordByReference;
module.exports.publishToCreateJobs = publishToCreateJobs;
module.exports.publishToRemoveJobs = publishToRemoveJobs;
module.exports.PickJobsByIds = PickJobsByIds;
module.exports.restartCronJob = restartCronJob;
module.exports.removeStoredCronId = removeStoredCronId;
