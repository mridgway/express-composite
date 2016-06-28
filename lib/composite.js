/*global setImmediate */
'use strict';

var SubResponse = require('./BaseSubResponse');

/**
 * A container for execution of sub-responses. Allows generation of a SubResponse object
 * and deferred execution of a controller.
 *
 * @class Composite
 * @param {object} req
 * @param {object} res
 * @param {object} options
 *     @param {object} options.responseType A constructor to use to instantiate a sub-response
 *     @param {object} options.responseOptions Passed to the responseClass when instantiated
 *     @param {function} options.controller
 *     @param {number} options.timeout
 *     @param {object} options.locals An object to be set on the response's locals
 * @constructor
 */
function Composite(req, res, options) {
    this.req = req;
    this.res = res;
    options = options || {};
    var ResponseType = options.responseType || SubResponse;
    options.responseOptions = options.responseOptions || {};
    this.controller = options.controller;
    this.timeout = options.timeout;

    if (options.id) {
        options.responseOptions.id = options.id;
    }
    if (options.name) {
        options.responseOptions.name = options.name;
    }

    // Create a sub response object to be passed into the composited controller
    this.subResponse = new ResponseType(res, options.responseOptions);
    this.subResponse.locals = options.locals || {};
    this.subResponse.pause();

    // Create a sub request object to be passed into the composited controller
    this.subRequest = Object.create(req);
    this.subRequest.res = this.subResponse;
}

/**
 * Returns the response object
 * @method getResponse
 * @returns {object}
 */
Composite.prototype.getResponse = function () {
    return this.subResponse;
};

/**
 * Returns the request object
 * @method getRequest
 * @returns {object}
 */
Composite.prototype.getRequest = function () {
    return this.subRequest;
};

/**
 * Allows setting of the configuration post-instantiation
 * @method setConfig
 * @param {object} config
 */
Composite.prototype.setConfig = function (config) {
    this.config = config;
};

/**
 * Allows setting of the locals post-instantiation
 * @method setLocals
 * @param {object} locals
 */
Composite.prototype.setLocals = function (locals) {
    this.subResponse.locals = locals;
};

/**
 * Executes the controller if one is set and returns the sub-response
 * @method execute
 * @param {function} next A callback to be passed to the controller in case of errors
 * @returns {*}
 */
Composite.prototype.execute = function (next) {
    var self = this,
        callback;

    if (self.controller) {
        // Set the timeout of the sub response
        if (self.timeout) {
            self.subResponse.setTimeout(self.timeout);
        }

        // controller callback
        callback = function (err) {
            // Only gets called if there is an error generally
            if (err) {
                var statusCode = self.subResponse.statusCode;
                if (statusCode < 400) {
                    statusCode = 500;
                }
                if (next) {
                    setImmediate(next, err, self);
                } else {
                    self.subResponse.send(statusCode, err);
                }
            }
        };

        // Call the controller
        self.controller.apply(self.controller, [self.subRequest, self.subResponse, callback]);
    }
    return self.subResponse;
};

module.exports = {

    Composite: Composite,

    /**
     * Factory method for creation of composites
     * @param req
     * @param res
     * @param options
     * @returns {Composite}
     */
    createComposite: function (req, res, options) {
        return new Composite(req, res, options);
    },

    /**
     * Executes a single controller and returns a buffered SubResponse that will
     * be written to by the controller.
     * @param req
     * @param res
     * @param options The composite configuration
     * @param next
     */
    executeController: function (req, res, options, next) {
        var composite = new Composite(req, res, options);
        return composite.execute(next);
    }

};
