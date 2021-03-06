// Promise and Event Helper

function EventListener() {}
EventListener.prototype.trigger = function(type) {
    var args = Array.prototype.slice.call(arguments, 1);
    var onhandler = this['on' + type];
    this.__event_handlers = (this.__event_handlers || {});
    var handlers = (this.__event_handlers[type] || []);
    var event = new Event(type, this.target, args);
    if (!!onhandler) {
        onhandler.apply(this.target||this, args);
    }
    if (handlers.length > 0) {
        for (var i=0; i < handlers.length; i++) {
            handlers[i].apply(this.target||this, args);
        }
    }
    if (!onhandler && handlers.length === 0) {
        if (typeof this.__eventqueue === 'undefined') {
            this.__eventqueue = {};
        }
        if (typeof this.__eventqueue[type] === 'undefined') {
            this.__eventqueue[type] = [];
        }
        this.__eventqueue[type].push(args);
    }
};
EventListener.prototype.on = function(eventname, handler) {
    var handlers = this.__event_handlers = (this.__event_handlers || {});
    handlers[eventname] = (handlers[eventname] || []);
    handlers[eventname].push(handler);
    while (this.__eventqueue && this.__eventqueue[eventname] && this.__eventqueue[eventname].length > 0) {
        var args = this.__eventqueue[eventname].pop(0);
        args.splice(0, 0, eventname);
        this.trigger.apply(this, args);
    }
    return this;
};
EventListener.prototype.onerror = function() {
    console.error('Unhandled error', arguments[0]);
};

function Event(eventname, target, data) {
    this.type = eventname;
    this.target = target;
    this.data = data;
};

function Promise(target) {
    this.target = target;
    this._status = 'waiting';
};
Promise.prototype = new EventListener();

Promise.prototype.then = function(onsuccess, onerror) {
    if (typeof this.result === 'undefined') {
        if (typeof onerror === 'function') {
            if (this._status === 'error') {
                onerror.call(this, this._error);
            } else {
                this.onerror = onerror;
            }
        }
        if (this._status === 'fulfilled') {
            onsuccess.call(this, this.result);
        } else {
            return this.on('success', onsuccess);
        }
    } else {
        onsuccess(this.result);
    }
};
Promise.prototype.ok = function(result) {
    if (this._status === 'waiting') {
        this.result = result;
        this._status = 'fulfilled';
        this.trigger('success', result);
    } else {
        throw "promise already " + this._status;
    }
};
Promise.prototype.error = function(e) {
    if (this._status === 'waiting') {
        this._error = e;
        this._status = 'error';
        return this.trigger('error', e);
    } else {
        throw "promise already " + this._status;
    }
};

Promise.chain = function(promises) {
    var self = new Promise();
    var waiting = promises.length;
    var i;
    var results = [];
    for (i = 0; i < promises.length; i++) {
        if (promises[i]._status !== 'waiting') {
            waiting = waiting - 1;
            results[i] = promises[i].result;
            self.trigger('onedone', i, promises[i], promises[i].result);
        } else {
            create_result_handler(i, promises[i])
        }
    }
    if (waiting === 0) {
        self.ok(results);
    }

    return self;

    function create_result_handler(i, promise) {
        function one_done(result) {
            results[i] = result;
            waiting = waiting - 1;
            self.trigger('onedone', i, promises[i], result, waiting);
            if (waiting === 0 && self._status === 'waiting') {
                self.ok(results);
            }
        }

        function one_error(e) {
            waiting = waiting - 1;
            self.error(e);
        }

        promise.then(one_done, one_error);
    }
};

exports.EventListener = EventListener;
exports.Promise = Promise;
