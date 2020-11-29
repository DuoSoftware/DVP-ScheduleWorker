module.exports = {
    "DB": {
        "Type": "SYS_DATABASE_TYPE",
        "User": "SYS_DATABASE_POSTGRES_USER",
        "Password": "SYS_DATABASE_POSTGRES_PASSWORD",
        "Port": "SYS_SQL_PORT",
        "Host": "SYS_DATABASE_HOST",
        "Database": "SYS_DATABASE_NAME"
    },



    "Redis":
    {
        "mode": "SYS_REDIS_MODE",
        "ip": "SYS_REDIS_HOST",
        "port": "SYS_REDIS_PORT",
        "user": "SYS_REDIS_USER",
        "db": "SYS_REDIS_DB",
        "password": "SYS_REDIS_PASSWORD",
        "sentinels": {
            "hosts": "SYS_REDIS_SENTINEL_HOSTS",
            "port": "SYS_REDIS_SENTINEL_PORT",
            "name": "SYS_REDIS_SENTINEL_NAME"
        }

    },

    "Security":
    {

        "ip": "SYS_REDIS_HOST",
        "port": "SYS_REDIS_PORT",
        "user": "SYS_REDIS_USER",
        "password": "SYS_REDIS_PASSWORD",
        "mode": "SYS_REDIS_MODE",
        "sentinels": {
            "hosts": "SYS_REDIS_SENTINEL_HOSTS",
            "port": "SYS_REDIS_SENTINEL_PORT",
            "name": "SYS_REDIS_SENTINEL_NAME"
        }

    },

    "Host":
    {
        "domain": "HOST_NAME",
        "port": "HOST_SCHEDULEWORKER_PORT",
        "version": "HOST_VERSION"
    },
    "Token": "HOST_TOKEN"
};

//NODE_CONFIG_DIR
