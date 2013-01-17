define(function(require, exports, module) {

    plasmid = require('plasmid');
    appname = "APPNAME";
    plasmid_api = window.location.protocol + '//' + window.location.host + '/v1/';
    credentials = new plasmid.Credentials({api: plasmid_api});

    bootstrap_credentials = new plasmid.Credentials({
        access: "guest-creator",
        secret: "knock-knock"
    });

    appdb = new plasmid.Database({
        name: appname,
        api: plasmid_api,
        schema: {
            version: 1,
            stores: {
                // define stores here
            }
        },
        credentials: credentials
    });

    exports.cred = credentials;
    exports.bootcred = bootstrap_credentials;
    exports.db = appdb;
    
    appdb.on('opensuccess', function() {
        // Do we already have credentials?
        var self = this;
        this.meta.get('credentials').then(function(saved_cred){
            credentials.access = saved_cred.access;
            credentials.secret = saved_cred.secret;

            appdb.trigger('credentialsready', credentials);
        }).on('missing', function(){
            // Use the bootstrap creds to create new tokens
            credentials.credentials = bootstrap_credentials;
            credentials.create('guest').then(function(){
                self.meta.put('credentials', {
                    access: this.access,
                    secret: this.secret,
                });
                appdb.trigger('credentialsready', credentials);
            });
        });
    });

});