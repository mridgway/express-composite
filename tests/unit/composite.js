/*globals describe,it,beforeEach */
"use strict";

var expect = require('chai').expect,
    SubResponse = require('../../').BaseSubResponse,
    composite = require('../../').composite;

describe('composite', function () {
    var parentReq,
        parentRes,
        logs;

    beforeEach(function () {
        logs = [];
        parentReq = {
            context : {
                ynet: "0"
            },
            getBucket: function () {
                return parentReq.context.bucket;
            }
        };
        parentRes = {
            buffer: '',
            ended: false,
            locals: { test1: 'test' },
            renderCalled: false,
            headers: {},
            req: parentReq,
            header: function (val, key) {
                this.headers[key] = val;
            },

            end: function () {
                this.ended = true;
            },
            write: function (str) {
                this.buffer += str;
            },
            render: function (view, options, fn) {
                this.renderCalled = [view, options, fn];
                fn(null, 'test');
            }
        };
    });

    describe('#Composite', function () {
        describe('#getResponse', function () {
            it('should return the sub response', function () {
                var c = composite.createComposite({}, parentRes, {}, function () {});
                expect(c.getResponse()).to.be.instanceof(SubResponse);
            });
        });
        describe('#setLocals', function () {
            it('should change the locals object before execution', function (done) {
                var initialLocals = {
                        test: 'not this'
                    },
                    expectedConfig = {
                        test: 'test'
                    },
                    expectedLocals = {
                        test: 'test'
                    },
                    controller = function (req, res, next) {
                        expect(res).to.be.instanceof(Object, 'res was not passed in correctly');
                        expect(res.locals).to.equal(expectedLocals, 'req.locals was not set correctly');
                        next();
                        done();
                    },
                    next = function () {},
                    c = composite.createComposite(parentReq, parentRes, {
                        controller: controller,
                        config: expectedConfig,
                        locals: initialLocals
                    });
                c.setLocals(expectedLocals);
                c.execute(next);
            });
        });
        describe('#setConfig', function () {
            it('should change the config object before execution', function (done) {
                var initialConfig = {
                        test: 'not this'
                    },
                    expectedConfig = {
                        test: 'test'
                    },
                    controller = function (req, res,  next) {
                        expect(res).to.be.instanceof(Object, 'res was not passed in correctly');
                        next();
                        done();
                    },
                    next = function () {},
                    c = composite.createComposite(parentReq, parentRes, {
                        controller: controller,
                        config: initialConfig
                    });
                c.setConfig(expectedConfig);
                c.execute(next);
            });
        });
        describe('#execute', function () {
            it('should call the controller if passed in', function (done) {
                var expectedConfig = {
                        test: 'test'
                    },
                    expectedLocals = {
                        test: 'test'
                    },
                    controller = function (req, res, next) {
                        expect(res).to.be.instanceof(Object, 'res was not passed in correctly');
                        expect(res.locals).to.equal(expectedLocals, 'req.locals was not set correctly');
                        next();
                        done();
                    },
                    next = function () {},
                    c = composite.createComposite(parentReq, parentRes, {
                        controller: controller,
                        config: expectedConfig,
                        locals: expectedLocals
                    });
                c.execute(next);
            });
            it('should trigger error on sub response', function (done) {
                var logs = [],
                    expectedReq = {
                        context: {},
                        error: function () {
                            logs.push(arguments);
                        },
                        getBucket: function () {
                            return expectedReq.context.bucket;
                        }
                    },
                    expectedErr = {
                        message: 'test'
                    },
                    controller = function (req, res, next) {
                        next(expectedErr);
                    },
                    c = composite.createComposite(expectedReq, parentRes, {
                        controller: controller
                    });
                c.execute(function (err) {
                    expect(err).to.equal(expectedErr);
                    done();
                });
                c.subResponse.getHtml(function (err) {
                    expect(err).to.be.an('object');
                    expect(logs.length).to.equal(1);
                });
            });
            it('should allow handling of sub response in error case', function (done) {
                var errorMsg = 'ERROR MESSAGE',
                    expectedReq = {
                        context: {},
                        error: function () {},
                        getBucket: function () {
                            return expectedReq.context.bucket;
                        }
                    },
                    controller = function (req, res, next) {
                        next(errorMsg);
                    },
                    c = composite.createComposite(expectedReq, parentRes, {
                        controller: controller
                    }),
                    subResponse;

                subResponse = c.execute(function (err) {
                    var message = 'DISPLAY MY OWN ERROR MESSAGE';
                    expect(err).to.equal(errorMsg);
                    subResponse.send(message);
                    subResponse.getHtml(function (err, html) {
                        expect(html).to.equal(message);
                        done();
                    });
                });
            });
        });
    });

    describe('#createComposite', function () {
        it('should return a Composite instance', function () {
            var c = composite.createComposite({}, parentRes, {}, function () {});
            expect(c).to.be.an.instanceof(composite.Composite);
        });
    });

    describe('#executeController', function () {
        it('should return a SubResponse object', function () {
            var subResponse = composite.executeController({}, parentRes, {}, function () {});
            expect(subResponse).to.be.instanceof(SubResponse);
        });
        it('should return a paused SubResponse', function (done) {
            var subResponse = composite.executeController({}, parentRes, {}, function () {}),
                dummy;
            subResponse.on('end', function () {
                done();
            });
            dummy = expect(subResponse._readableState.flowing).to.be.false;
            subResponse.end();
            subResponse.resume();
        });
        it('should call the controller', function (done) {
            composite.executeController(parentReq, parentRes, {
                controller: function (req, res, next) {
                    var dummy;
                    expect(req).to.be.instanceof(Object, 'req was not passed in correctly');
                    expect(res).to.be.instanceof(Object, 'res was not passed in correctly');
                    dummy = expect(next).to.be.a.function;
                    done();
                },
                config: {}
            }, function () {});
        });
    });
});
