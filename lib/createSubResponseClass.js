'use strict';

var util = require('util');
var PassThrough = require('stream').PassThrough;

function createSubResponseClass(options) {
    options = options || {};

    /**
     * A base Response class for sub-responses
     * @class SubResponse
     * @param {object} parentRes The top level response object
     * @param {object} options Configuration options
     *     @param {string} options.id An optional identifier for this sub-response object
     *     @param {string} options.name A generic name for the response (used for perf tracking)
     * @constructor
     */
    function SubResponse(parentRes, options) {
        SubResponse.super_.apply(this);
        options = options || {};
        this.parentRes = parentRes;
        this.locals = {};
        this.id = options.id;
        this.name = options.name; // Helps with debugging
        this.req = parentRes.req;
        this.timeout = null;
        this.timedOut = false;
        this.statusMessage = null;
    }

    /**
     * Pipe the response to another stream
     * @method pipe
     * @param {object} stream The stream to pipe to
     */
    util.inherits(SubResponse, PassThrough);

    SubResponse.prototype.statusCode = 200;

    /**
     * End the response
     * @method end
     */
    SubResponse.prototype.end = function end() {
        // If timedOut then we know the sub-response has already ended
        if (this.timedOut) {
            this.emit('error', new Error('Sub-Response completed after timeout.'));
            return;
        }
        if (this.timeout) {
            clearTimeout(this.timeout);
        }
        SubResponse.super_.prototype.end.apply(this, arguments);
    };

    /**
     * Write a string to the response
     * @method write
     * @param {string} str
     */
    SubResponse.prototype.write = function write(str) {
        if (this.timedOut) {
            return;
        }
        SubResponse.super_.prototype.write.apply(this, arguments);
    };

    /**
     * Writes and ends the response
     * @method send
     * @param {number|string} status status code or the response body
     * @param {string} body response body
     */
    SubResponse.prototype.send = function send(status, body) {
        var responseBody = body,
            responseStatus = status;
        if (1 === arguments.length) {
            if ('number' !== typeof status) {
                responseBody = status;
                responseStatus = null;
            }
        }
        if (responseStatus) {
            this.status(responseStatus);
        }
        if (this.statusCode >= 400) {
            this.statusMessage = responseBody;
        } else if (responseBody) {
            this.write(responseBody);
        }
        this.end();
    };

    /**
     * Sets the response status code
     * @param code the status code
     * @returns {SubResponse}
     */
    SubResponse.prototype.status = function status(code) {
        if (this.timedOut) {
            return this;
        }
        this.statusCode = code;
        return this;
    };

    /**
     * Renders a template and writes it unless a callback is specified.
     * @method render
     * @param {string} view
     * @param {object} options
     * @param {function} fn
     */
    SubResponse.prototype.render = function (view, options, fn) {
        if (this.timedOut) {
            if (!fn) {
                this.end();
            }
            return;
        }
        var self = this;
        this.parentRes.locals = Object.assign(this.parentRes.locals, this.locals);
        this.parentRes.render(view, options, function (err, html) {
            if (fn) {
                fn(err, html);
                return;
            }
            if (err) {
                throw err;
            }
            self.write(html);
            self.end();
        });
    };

    /**
     * get the html of response, listen to the events and trigger the callback with rendered markup
     * @method getHtml
     * @param {function} callback
     * @returns {SubResponse} base-response
     */
    SubResponse.prototype.getHtml = function (callback) {
        var self = this,
            markup = '';

        self.on('data', function (chunk) {
            markup += chunk.toString();
        });

        self.on('end', function () {
            // Handle cases where response has their own status code
            if (self.statusCode >= 400) {
                callback(new Error('Response failed: ' + (self.statusMessage || 'Unknown Reason')), markup);
                return;
            }
            callback(null, markup);
        });

        self.resume();
        return self;
    };

    /**
     * Set the timeout for the sub response. Response will be ended and have statusCode 522.
     * @method setTimeout
     * @param timeout Length of timeout in milliseconds
     * @return {number}
     */
    SubResponse.prototype.setTimeout = function (timeout) {
        var self = this;
        this.timeout = setTimeout(function () {
            self.send(522, 'Timeout: response took longer than ' + timeout + 'ms');
            self.timedOut = true;
        }, timeout);
        return this.timeout;
    };

    options.proxies && options.proxies.forEach(function (fn) {
        SubResponse.prototype[fn] = function () {
            if (!this.parentRes[fn]) {
                throw new Error(fn + ' is not a valid function on SubResponse');
            }
            return this.parentRes[fn].apply(this.parentRes, arguments);
        };
    });

    return SubResponse;
}

module.exports = createSubResponseClass;
