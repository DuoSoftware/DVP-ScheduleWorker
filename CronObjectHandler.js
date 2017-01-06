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


var redis=require('redis');

var port = config.Redis.port || 3000;
var ip = config.Redis.ip;
var password = config.Redis.password;

var authToken = config.Token;


var client = redis.createClient(port,ip);
client.auth(password, function (error) {
    console.log("Redis Auth Error " + error);
});

client.on("error", function (err) {
    console.log("Error " + err);


});



function CroneDataRecorder(cronObj,company,tenant,callback)
{

    DbConn.Cron.find({where:[{Reference: cronObj.Reference},{Company: company},{Tenant:tenant}]}).then(function (resCheckAvailable) {

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
                var jobRecStatus=JobDetailsRecorder(cronObj.UniqueId,company,tenant);
                result.CachedStatus=jobRecStatus;
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

    client.set(jobKey,croneUuid, function (error,result) {

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

    client.keys(searchKey, function (error,result) {

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
            callback(new Error('No job record found'),undefined);
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
            callback(new Error('No job record found'),undefined);
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
    client.del(jobKey, function (err,res) {
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

        JobCacheRemover(croneUuid,company,tenant, function (errRemCahe,resCache) {

            if(errRemCahe)
            {
                callback(errRemCahe,undefined);
            }
            else
            {
                callback(undefined,resCache);
            }


        });
    });
};

function CroneObjectUpdater(croneUuid,company,tenant,cronData,callback)
{
    if(cronData.croneUuid)
    {
        delete cronData.UniqueId
    }
    if(cronData.CronePattern)
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
