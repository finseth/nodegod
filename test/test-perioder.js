// test-perioder.js
// © Harald Rudell 2013 MIT License

var perioder = require('../lib/perioder')

// https://github.com/haraldrudell/mochawrapper
var assert = require('mochawrapper')

exports['Perioder:'] = {
	'Exports': function () {
		assert.exportsTest(perioder, 1)
	},
	'TimeEmitter GetState Cancel': function () {
		var ignoreProperties = ['domain', '_events', '_maxListeners']

		var t = new perioder.TimeEmitter() // timer for beginning of the month
		assert.ok(t)
		var keys = []
		Object.keys(t).forEach(function (p) {
			if (!~ignoreProperties.indexOf(p)) keys.push(p)
		})
		assert.equal(keys.length, 2, 'List is: ' + keys)
		assert.equal(typeof t.cancel, 'function')
		assert.equal(typeof t.getState, 'function')

		var actual = t.getState()
		assert.ok(actual)
		assert.ok(actual.timer)

		t.cancel()
		var actual2 = t.getState()
		assert.equal(actual2.timer, false)
	},
	'Fire': function (done) {
		var isDone
		var t = new perioder.TimeEmitter({
			schedule: 'second',
			every: 0.001,	// then every ms
		}).on('time', time)

		function time() {
			t.cancel()
			if (!isDone) {
				isDone = true
				done()
			}
		}
	},
	'TimeEmitter Every NaN': function () {
		var t = new perioder.TimeEmitter({
			every: 'abc',	// then every 10 seconds
		})
		t.cancel()
	},
	'TimeEmitter Minute Hour Day Year': function () {
		var t = new perioder.TimeEmitter({
			schedule: 'minute',
		})
		t.cancel()
		var t = new perioder.TimeEmitter({
			schedule: 'hour',
		})
		t.cancel()
		var t = new perioder.TimeEmitter({
			schedule: 'day',
		})
		t.cancel()
		var t = new perioder.TimeEmitter({
			schedule: 'year',
		})
		t.cancel()
	},
}