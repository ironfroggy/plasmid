define(function(require, exports, module) {

    var promise = require('promise')
    ;

    function Results(source, filter) {
        Array.call(this, []);
        this.source = source;
        this.filter = filter;
    }

    Results.prototype = new Array();

    /* Refresh the changes */

    Results.prototype.refresh = function(filter, cb) {
        var self = this;
        var p = new promise.Promise(this);
        var results = [0, 0];
        var cb = cb || function(p, results){ return results; };
        if (!!filter) {
            for (key in this.filter) {
                if (!filter.hasOwnProperty(key)) {
                    filter[key] = this.filter[key];
                }
            }
        } else {
            var filter = this.filter;
        }
        this.source.walk(filter)
        .on('each', function(obj) {
            console.log('refreshing...', results[1]+1, obj.key, obj.value);
            results.push(obj);
            results[1]++;
        })
        .then(function(){
            var cb_results = cb(p, results.slice(2));
            if (p._status === 'waiting') {
                cb_results.splice(0, 0, results[0], results[1]);
                self.filter = filter;
                Array.prototype.splice.apply(self, cb_results);
                p.ok();
            }
        });
        return p;
    };

    /* Change the result set window */

    Results.prototype.setWindow = function(start, stop) {
        this.filter.start = start;
        this.filter.stop = stop;
        return this.refresh();
    };

    /* Change the size of the result set, but not the starting position */
    
    Results.prototype.addLimit = function(n) {
        this.filter.stop = this.filter.stop + n;
        return this.refresh();
    };

    /* Shift the result set forward one page */

    Results.prototype.next = function() {
        var start = this.filter.start;
        var stop = this.filter.stop;
        var filter = this.filter;
        var new_stop = stop + (stop - start);
        var new_start = stop;

        return this.refresh({start: new_start, stop: new_stop}, function(p, results) {
            if (results.length === 0) {
                p.error('NoSuchPage');
            }
            return results;
        });
    }

    /* Shift the result set backward one page */

    Results.prototype.previous = function() {
        var start = this.filter.start;
        var stop = this.filter.stop;
        var new_start = start - (stop - start);
        var new_stop = start;

        if (new_start >= 0) {
            this.filter.start = new_start;
            this.filter.stop = new_stop;
            return this.refresh();
        } else {
            var p = new promise.Promise();
            p.error("NoSuchPage");
            return p;
        }
    }

    exports.Results = Results;

});
