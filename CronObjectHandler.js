/**
 * Created by Pawan on 7/15/2016.
 */
var DbConn = require('dvp-dbmodels');
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


var client = redis.createClient(port,ip);
client.auth(password, function (error) {
    console.log("Redis Auth Error " + error);
});

client.on("error", function (err) {
    console.log("Error " + err);


});



function CroneDataRecorder(croneObj,company,tenant,callback)
{

    DbConn.Cron.find({where:[{Reference: croneObj.Reference},{Company: company},{Tenant:tenant}]}).then(function (resCheckAvailable) {

        if(!resCheckAvailable)
        {
            var CronObj = DbConn.Cron
                .build(
                {
                    UniqueId: croneObj.UniqueId,
                    Description: croneObj.Description,
                    CronePattern: croneObj.CronePattern,
                    CallbackURL: croneObj.CallbackURL,
                    CallbackData: croneObj.CallbackData,
                    Company:company,
                    Tenant:tenant,
                    Reference:croneObj.Reference


                }
            );
            CronObj.save().then(function (result)
            {
                var jobRecStatus=JobDetailsRecorder(croneObj.UniqueId,company,tenant);
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

function CronCallbackHandler(croneUuid,company,tenant)
{
    DbConn.Cron.find({where:{UniqueId:croneUuid}}).then(function (result) {

        if(!result)
        {
            console.log("No record found");

        }
        else
        {
            var replyObj =
            {
                Message:result.CallbackData
            }



            var croneCallbacks = {url: result.CallbackURL, method: "POST", json: replyObj,headers: {
                authorization: "bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdWtpdGhhIiwianRpIjoiMTdmZTE4M2QtM2QyNC00NjQwLTg1NTgtNWFkNGQ5YzVlMzE1Iiwic3ViIjoiNTZhOWU3NTlmYjA3MTkwN2EwMDAwMDAxMjVkOWU4MGI1YzdjNGY5ODQ2NmY5MjExNzk2ZWJmNDMiLCJleHAiOjE4OTMzMDI3NTMsInRlbmFudCI6LTEsImNvbXBhbnkiOi0xLCJzY29wZSI6W3sicmVzb3VyY2UiOiJhbGwiLCJhY3Rpb25zIjoiYWxsIn1dLCJpYXQiOjE0NjEyOTkxNTN9.YiocvxO_cVDzH5r67-ulcDdBkjjJJDir2AeSe3jGYeA",
                companyinfo: format("{0}:{1}", tenant, company)
            }};
            httpReq(croneCallbacks, function (error, response, data) {

                if(error)
                {
                    console.log("ERROR sending request "+error);
                }
                else if (!error && response != undefined ) {

                    console.log("resp "+response);
                    //console.log("Sent "+JSON.parse(data)+" To "+result.CallbackURL);

                }
                else
                {
                    console.log("Nooooooo");
                }
            });
        }

    }).catch(function (error) {
        console.log(error);
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
            if(result.length>0)
            {
                callback(undefined,result);
            }
            else
            {
                callback(new Error('No cached records found'),undefined);
            }

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
}


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
                            var job = schedule.scheduleJob(result.CronePattern, function(){
                                CronCallbackHandler(cronId,result.Company,result.Tenant);
                                Jobs[cronId] =job;

                            });
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
}

function JobCacheRemover(croneUuid,company,tenant,callback)
{
    var jobKey = "CRON:"+croneUuid+":"+company+":"+tenent;
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

    JobObjectRemover(croneUuid, function (errRemObj,resRemObj) {

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
}

module.exports.CroneDataRecorder = CroneDataRecorder;
module.exports.CronCallbackHandler = CronCallbackHandler;
module.exports.JobDetailsPicker = JobDetailsPicker;
module.exports.RecoverJobs = RecoverJobs;
module.exports.JobRemover = JobRemover;
module.exports.CroneObjectUpdater = CroneObjectUpdater;
module.exports.PickAllCrons = PickAllCrons;
module.exports.PickCronById = PickCronById;
