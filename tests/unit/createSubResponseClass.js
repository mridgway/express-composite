/*globals describe,it,beforeEach */
"use strict";

var expect = require('chai').expect;
var createSubResponseClass = require('../../').createSubResponseClass;

describe('SubResponse', function () {
    var parentRes,
        subResponse;

    beforeEach(function () {
        var SubResponse = createSubResponseClass({
            proxies: ['header']
        });
        parentRes = {
            buffer: '',
            ended: false,
            locals: { test1: 'test' },
            renderCalled: false,
            headers: {},
            req: {},
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
        subResponse = new SubResponse(parentRes);
    });

    describe('#render', function () {
        it('should provide default callback that writes to itself', function () {
            subResponse.render('test', {});
            subResponse.getHtml(function (err, markup) {
                expect(markup).to.equal('test');
            });
        });

        it('should merge locals', function (done) {
            subResponse.locals = {test2: 'test'};
            subResponse.render('test', {}, function () {
                expect(parentRes.locals).to.deep.equal({
                    test1: 'test',
                    test2: 'test'
                });
                done();
            });

        });
    });

    describe('proxies', function () {
        it('should proxy some functions to parent response', function () {
            subResponse.header('test', 'test');
            expect(parentRes.headers.test).to.equal('test');
        });

        it('should error on invalid proxy function', function () {
            expect(function () {
                subResponse.expose('test', 'test');
            }).to.throw(Error);
        });
    });
});
