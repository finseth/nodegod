// uimanager.js
// manages the ui process lifecycle and connects it with appconduit
// © Harald Rudell 2012 MIT License

var appconduit = require('./appconduit')
var streamlabeller = require('./streamlabeller')
// http://nodejs.org/api/child_process.html
var child_process = require('child_process')
// http://nodejs.org/api/path.html
var path = require('path')

;[
launchUi, getUiRelauncher
].forEach(function (f) {exports[f.name] = f})

var time3Seconds = 3e3
var maxBadLaunches = 10

var minChildDurationForRelaunch = time3Seconds
var timeToSigkill = time3Seconds
var spawnOptions = {
	detached: true,
	stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
}

var relauncherFn
var killFnMap = {}
var log = console.log

/*
Launch and relaunch the webserver process
opts: object
.spawn: object file, args
.log: rotated streamlabeller
.launchTime: timeval for initial process launch
.restartIntercept for testing

*/
function launchUi(opts) {
	if (!opts) opts = {}
	var currentUiPid
	var remainingLaunches = maxBadLaunches

	log = opts.rlog.pLog
	relauncherFn = restart
	appconduit.setLaunchData({masterLaunch: opts.launchTime, rlog: opts.rlog})
	launchWebProcess()

	function launchWebProcess() {
		var child
		var pid
		var uiLaunch

		try {
			// kill all known ui instances
			for (var aPid in killFnMap) killFnMap[aPid]()

			// launch child process connected to appconduit
			child = child_process.spawn(opts.spawn.file, opts.spawn.args, spawnOptions)
				.once('exit', uiExit)
				.on('message', appconduit.receiveFromUi)
				.once('disconnect', appconduit.uiDisconnect)
			// child.send is a function if this node.js supports ipc
			if (!child.send) throw new Error('ipc not available try node 0.8.9 or later')
			streamlabeller.logChild(child, 'ui', opts.rlog.write)
			appconduit.uiConnect(child.send.bind(child))
			pid = currentUiPid = child.pid
			uiLaunch = Date.now()
			killFnMap[pid] = killUi
			log('ui:', pid, 'launched at', new Date(uiLaunch).toISOString())
			remainingLaunches = maxBadLaunches
		} catch (e) {
			log(arguments.callee.name, 'Exception:', e.message)
			if (--remainingLaunches > 0) restart(e, arguments.callee.name)
		}

		var killTimer
		var didKill
		function killUi() {
			try {
				delete killFnMap[pid]
				didKill = true
				child.disconnect()

				// attempt graceful kill (ctrl-Break)
				killTimer = setTimeout(sigResult, timeToSigkill)
				process.kill(pid, 'SIGINT')
			} catch (e) {
				log(arguments.callee.name, 'Exception:', e.message)
				restart(e, arguments.callee.name)
			}

			function sigResult() {
				try {
					killTimer = null
					// now the evil sigterm
					process.kill(pid)
				} catch (e) {
					log(arguments.callee.name, 'Exception:', e.message)
					restart(e, arguments.callee.name)
				}
			}
		}

		function uiExit(exitCode) {
			try {
				delete killFnMap[pid]
				child.removeListener('exit', uiExit)
				if (killTimer) {
					clearTimeout(killTimer)
					killTimer = null
				}
				log('ui:', pid, didKill ? 'exited' : 'crashed', 'exit code:', exitCode)

				// relaunch child as appropriate
				if (!didKill) {
					var elapsed = Date.now() - uiLaunch
					if (elapsed >= minChildDurationForRelaunch) process.nextTick(launchWebProcess)
					else log('ui:', pid, 'fatal: child is crahsed after only', elapsed / 1e3, 's')
				}
			} catch (e) {
				log(arguments.callee.name, 'Exception:', e.message)
				restart(e, arguments.callee.name)
			}
		}
	}

	function restart(e, fName) {
		if (typeof opts.restartIntercept === 'function') opts.restartIntercept(e, fName)
		else process.nextTick(launchWebProcess)
	}
}

function getUiRelauncher() {
	return uiRelauncher
}

function uiRelauncher(getKillMap, timeToSigkill0) {
	if (timeToSigkill0 != null) timeToSigkill = timeToSigkill0
	if (!getKillMap) {
		if (typeof relauncherFn == 'function') relauncherFn()
	} else return killFnMap
}