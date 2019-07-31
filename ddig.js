var debug = require('debug')('ddig');
debug('Entry: [%s]', __filename);

// Import IP validation library
const isIp = require('is-ip');

// Import DNS library
const dns = require('native-dns-multisocket');

// Use 'moment' to do time difference calculations
const moment = require('moment');

// Default Options
var options = {
    'request': {
        'port': 53,
        'type': 'udp',
        'timeout': 2500,
        'try_edns': false,
        'cache': false
    },
    'question': {
        'type': 'A'
    }
};

module.exports = {
    // resolveDomain() iterates through the resolvers performing a lookup of a single domain
    // Returns json object
    resolveDomain(domain, resolvers) {
        debug('resolveDomain() triggered for [%s]', domain);

        // Iterate through resolvers
        for (var index = 0; index < resolvers.length; index++) {
            debug('resolving [%s] using %s (%s)', domain, resolvers[index].nameServer, resolvers[index].provider);

            // Verify the `nameServer` value is a valid IP address
            if (isIp(resolvers[index].nameServer) === false) {
                debug('Skipping the resolver [%s] because it is not a valid IP address', resolvers[index].nameServer);
            } else {
                // Create DNS Question
                var question = dns.Question({
                    name: domain,
                    type: options.question.type,
                });

                // Create DNS Request to ask the Question
                var req = dns.Request({
                    question: question,
                    server: {
                        address: resolvers[index].nameServer,
                        port: options.request.port,
                        type: options.request.type
                    },
                    timeout: options.request.timeout,
                    cache: options.request.cache,
                    try_edns: options.request.try_edns
                });

                // Hook the timeout event
                req.on('timeout', function () {
                    console.log('The %sms timeout elapsed before %s [%s] responded', options.request.timeout, resolvers[index].nameServer, resolvers[index].provider);
                });


                req.on('message', function (err, answer) {
                    if (err) {
                        debug('Error received: %O', err);
                    } else{
                        debug('The resolver [%s] provided the answer: %O', resolvers[index].nameServer, answer.answer);
                        answer.answer.forEach(function (a) {
                            debug(a.data);
                        });

                        // Create lookup result object
                        var lookupResult = {
                            'domain' : domain,
                            'ipAddress' : [JSON.stringify(answer.answer)],
                            'resolver' : resolvers[index].nameServer,
                            'provider' : resolvers[index].provider
                        };

                        // Return the result
                        return(lookupResult);
                    }
                });

                req.on('end', function () {
                    debug('Finished processing DNS request');
                });

                req.send();
            }

        }
    },

    // resolveBulk() performs a lookup of each domain against each resolver
    // Returns json object with results via callback()
    resolveBulk(domains, resolvers, callback) {
        const startTime = moment();
        debug('resolveBulk() received the following domains: %O .... and resolvers: %O', domains, resolvers);

        // Initialise response object
        var response = {
            'duration' : 'unknown',
            'lookups' : []
        };

        for (var iDomain = 0; iDomain < domains.length; iDomain++) {
            var result = exports.resolveDomain(domains[iDomain], resolvers);
            if (result) {
                response.lookups.push(result);
            }
        }

        // Record the timestamp and difference with the starting timestamp
        const endTime = moment();
        response.duration = moment(endTime).diff(startTime);

        // Pass response object to callback function
        debug ('resolveBulk() generated the results: %O', response);
        callback(response);
    }
};
