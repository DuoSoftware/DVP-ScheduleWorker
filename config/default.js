module.exports = {
    "DB": {
        "Type":"postgres",
        "User":"",
        "Password":"",
        "Port":5432,
        "Host":"",
        "Database":""
    },
    "Host":
    {
        "domain": "127.0.0.1",
        "port": "8080",
        "version":"1.0.0.0",
        "hostpath":"./config",
        "logfilepath": ""
    },
    "Redis":
    {
        "ip": "",
        "port": 6389,
        "user": "",
        "password": "",
         "mode": "sentinel",
            "sentinels":{
                "hosts": "",
                "port":16389,
                "name":"redis-cluster"
            }

    },


    "Security":
    {
        "ip" : "",
        "port": 6389,
        "user": "",
        "password": "",
         "mode": "sentinel",
            "sentinels":{
                "hosts": "",
                "port":16389,
                "name":"redis-cluster"
            }
    },

    "Token": "",
    "JobQueue":{
        "name":"1:103:cron:jobqueue"
    },
    "JobRemQueue":{
        "name":"1:103:cron:removequeue"
    }





};
