/**

Copyright 2023 Asaf Yurdakul and Mert Software & Electronic A.Ş, Bursa Turkiye.

Licensed under the GNU General Public License, Version 3.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    https://www.gnu.org/licenses/gpl-3.0.html

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

 **/

module.exports = function(RED) {
    "use strict";
    var settings = RED.settings;
    var events = require("events");
    const { SerialPort } = require('serialport');
    var bufMaxSize = 32768;  // Max serial buffer size, for inputs...
    const serialReconnectTime = settings.serialReconnectTime || 15000;
	var oldValues = [];	
	
	  // Configuration Node
    function SerialPortNode(n) {
        RED.nodes.createNode(this,n);
        this.serialport = n.serialport;
        this.newline = n.newline; /* overloaded: split character, timeout, or character count */
        this.addchar = n.addchar || "";
        this.serialbaud = parseInt(n.serialbaud) || 19200;
        this.databits = parseInt(n.databits) || 8;
        this.parity = n.parity || "none";
        this.stopbits = parseInt(n.stopbits) || 1;
        this.dtr = n.dtr || "none";
        this.rts = n.rts || "none";
        this.cts = n.cts || "none";
        this.dsr = n.dsr || "none";
        this.bin = n.bin || "false";
        this.out = n.out || "char";
        this.waitfor = n.waitfor || "";
        this.responsetimeout = n.responsetimeout || 10000;
    }
    RED.nodes.registerType("iobox-port",SerialPortNode);
		
	
	function parseValues(msgout, parsePorts, onlychanged, singleoutput ) {

		if(!Array.isArray(parsePorts)) {
			parsePorts = parsePorts.split(',');
		}
		var strArray = msgout.split('&');		
		var resultParse;
		
		if(!singleoutput) {
			resultParse = new Array(parsePorts.length);
						
			if(!Array.isArray(oldValues)) {				
				oldValues = new Array(parsePorts.length);				
			}			
			if( oldValues.length == 0) {
				oldValues = new Array(parsePorts.length);
			}
			
			var indexResult = 0;
		}
		else {
			resultParse = {};
			if(Array.isArray(oldValues)) {	
				oldValues = {};
			}
		}
		
		for (let index = 0; index < parsePorts.length; index++) {
			const element = parsePorts[index];

			for (var i = 0; i < strArray.length; i++) {
				const item = strArray[i];

				var strArrayEqual = item.split('=');

				if (element.startsWith('INF')) {
					if (strArrayEqual[0] == 'INF') {
						var m = element.replace('INF', '');	
						
						if(!singleoutput) {						
							if ( oldValues[indexResult] == undefined || 
								( (oldValues[indexResult].payload !== strArrayEqual[1][12 - Number(m)]) ||
								  !onlychanged ) )
							{								
								resultParse[indexResult] = { payload : strArrayEqual[1][12 - Number(m)], port : element };
								oldValues[indexResult] = resultParse[indexResult];								
							}
							indexResult++;
						}
						else {	
							if(oldValues["input" + m] !== strArrayEqual[1][12 - Number(m)] || !onlychanged )
							{
								resultParse["input" + m] =  strArrayEqual[1][12 - Number(m)];
								oldValues["input" + m]  = resultParse["input" + m] ;							
							}
						}
								
						break;
					}
				}
				if (element.startsWith('OUT')) {
					if (strArrayEqual[0] == 'OUT') {
						var m = element.replace('OUT', '');	
						
						if(!singleoutput) {
							if ( oldValues[indexResult] == undefined || 
								( (oldValues[indexResult].payload !== strArrayEqual[1][12 - Number(m)]) ||
								  !onlychanged ) )
							{
								resultParse[indexResult] = { payload : strArrayEqual[1][12 - Number(m)], port : element };
								oldValues[indexResult] = resultParse[indexResult];
							}
							indexResult++;
						}
						else {
							if(oldValues["out" + m] !== strArrayEqual[1][12 - Number(m)] || !onlychanged )
							{
								resultParse['out' + m] =  strArrayEqual[1][12 - Number(m)];
								oldValues['out' + m] = resultParse['out' + m];
							}
						}
						
								
						break;
					}
				}
				else if (strArrayEqual[0] == element) {
					
					if(!singleoutput) {
						if ( oldValues[indexResult] == undefined || 
							( (oldValues[indexResult].payload !==  strArrayEqual[1]) ||
							  !onlychanged) )
						{	
							resultParse[indexResult] = { payload : strArrayEqual[1] , port : element };
							oldValues[indexResult] = resultParse[indexResult];
						}
						indexResult++;
					}
					else {
						var m = element.replace('CNT','counter');
						m = m.replace('CYC','cycle');
							
						if(oldValues[m] !== strArrayEqual[1] || !onlychanged ){
							resultParse[m] =  strArrayEqual[1];
							oldValues[m] = resultParse[m];
						}
					}

					break;
				}
			}
		}

		if(singleoutput) {
			/*
			resultParse = resultParse.filter(function( element ) {
			   return element !== undefined;
			});
			*/
			resultParse = { payload : resultParse }
		}        					
		return resultParse;
		
	}
	
	function IoBox(n) {
		RED.nodes.createNode(this,n);
        this.serial = n.serial;
        this.serialConfig = RED.nodes.getNode(this.serial);
			
        if (this.serialConfig) {
            var node = this;
            node.status({fill:"grey",shape:"dot",text:"node-red:common.status.not-connected"});
            node.port = serialPool.get(this.serialConfig);
	
            this.port.on('data', function(msgout) {				
                //parsing operation
				var result = parseValues(msgout.payload , n.ports, n.onlychanged, n.singleoutput );
				if(n.singleoutput) {
					//console.log(result.payload);
					if(Object.keys(result.payload).length !== 0) {
						node.send(result);
					}
				}
				else {
					node.send(result);
				}
            });
            this.port.on('ready', function() {
                node.status({fill:"green",shape:"dot",text:"node-red:common.status.connected"});
            });
            this.port.on('closed', function() {
                node.status({fill:"red",shape:"ring",text:"node-red:common.status.not-connected"});
            });
        }
        else {
            this.error(RED._("serial.errors.missing-conf"), {});
        }

		node.on("input",function(msg) {
            if (msg.hasOwnProperty("baudrate")) {
                var baud = parseInt(msg.baudrate);
                if (isNaN(baud)) {
                    node.error(RED._("serial.errors.badbaudrate"),msg);
                } else {
                    node.port.update({baudRate: baud},function(err,res) {
                    if (err) {
                        var errmsg = err.toString().replace("Serialport","Serialport "+node.port.serial.path);
                        node.error(errmsg,msg);
                        }
                    });
                }
            }
			// do nothing unless we have a payload
            if (!msg.hasOwnProperty("payload")) { 
				return; 
			} 
			
		
			if(msg.payload.out1 == undefined && msg.payload.out2 == undefined &&
			   msg.payload.out3 == undefined && msg.payload.out4 == undefined) 
			{
				console.log("return");
				return;
			}
			else { 
				var outs = "";
				var delay = 0;
				if(msg.payload.out1 !== undefined) { 
					setTimeout(function() {
						outs = "CMD+OUT1="+msg.payload.out1+'\r\n';
						node.port.write(outs,function(err,res) {
							if (err) {
								var errmsg = err.toString().replace("Serialport","Serialport "+node.port.serial.path);
								node.error(errmsg,msg);
							}
						});
					}, delay);	
					delay +=50;
				}
			    if(msg.payload.out2 !== undefined) {
					setTimeout(function() {
						outs = "CMD+OUT2="+msg.payload.out2+'\r\n';		
						node.port.write(outs,function(err,res) {
							if (err) {
								var errmsg = err.toString().replace("Serialport","Serialport "+node.port.serial.path);
								node.error(errmsg,msg);
							}
						});							
					}, delay);	
					delay +=50;
				}
				if(msg.payload.out3 !== undefined) {
					setTimeout(function() {
						outs = "CMD+OUT3="+msg.payload.out3+'\r\n';					
						node.port.write(outs,function(err,res) {
							if (err) {
								var errmsg = err.toString().replace("Serialport","Serialport "+node.port.serial.path);
								node.error(errmsg,msg);
							}
						});
					}, delay);	
					delay +=50;						
				}
				if(msg.payload.out4 !== undefined) {
					setTimeout(function() {
						outs = "CMD+OUT4="+msg.payload.out4+'\r\n';					
						node.port.write(outs,function(err,res) {
							if (err) {
								var errmsg = err.toString().replace("Serialport","Serialport "+node.port.serial.path);
								node.error(errmsg,msg);
							}
						});	
					}, delay);		
				}				
			}
        });
			
        this.on("close", function(done) {
            if (this.serialConfig) {
                serialPool.close(this.serialConfig.serialport,done);
            }
            else {
                done();
            }
        });
    }
    RED.nodes.registerType("iobox",IoBox);
	
	
	
	
	var serialPool = (function() {
        var connections = {};
        return {
            get:function(serialConfig) {
                // make local copy of configuration -- perhaps not needed?
                var port = serialConfig.serialport,
                    baud = serialConfig.serialbaud,
                    databits = serialConfig.databits,
                    parity = serialConfig.parity,
                    stopbits = serialConfig.stopbits,
                    dtr = serialConfig.dtr,
                    rts = serialConfig.rts,
                    cts = serialConfig.cts,
                    dsr = serialConfig.dsr,
                    newline = serialConfig.newline,
                    spliton = serialConfig.out,
                    waitfor = serialConfig.waitfor,
                    binoutput = serialConfig.bin,
                    addchar = serialConfig.addchar,
                    responsetimeout = serialConfig.responsetimeout;
                var id = port;
                // just return the connection object if already have one
                // key is the port (file path)
                if (connections[id]) { return connections[id]; }

                // State variables to be used by the on('data') handler
                var i = 0; // position in the buffer
                // .newline is misleading as its meaning depends on the split input policy:
                //   "char"  : a msg will be sent after a character with value .newline is received
                //   "time"  : a msg will be sent after .newline milliseconds
                //   "count" : a msg will be sent after .newline characters
                // if we use "count", we already know how big the buffer will be
                var bufSize = (spliton === "count") ? Number(newline): bufMaxSize;

                waitfor = waitfor.replace("\\n","\n").replace("\\r","\r").replace("\\t","\t").replace("\\e","\e").replace("\\f","\f").replace("\\0","\0"); // jshint ignore:line
                if (waitfor.substr(0,2) == "0x") { waitfor = parseInt(waitfor,16); }
                if (waitfor.length === 1) { waitfor = waitfor.charCodeAt(0); }
                var active = (waitfor === "") ? true : false;
                var buf = new Buffer.alloc(bufSize);

                var splitc; // split character
                // Parse the split character onto a 1-char buffer we can immediately compare against
                if (newline.substr(0,2) == "0x") {
                    splitc = new Buffer.from([newline]);
                }
                else {
                    splitc = new Buffer.from(newline.replace("\\n","\n").replace("\\r","\r").replace("\\t","\t").replace("\\e","\e").replace("\\f","\f").replace("\\0","\0")); // jshint ignore:line
                }
                if (addchar === true) { addchar = splitc; }
                addchar = addchar.replace("\\n","\n").replace("\\r","\r").replace("\\t","\t").replace("\\e","\e").replace("\\f","\f").replace("\\0","\0"); // jshint ignore:line
                if (addchar.substr(0,2) == "0x") { addchar = new Buffer.from([addchar]); }
                connections[id] = (function() {
                    var obj = {
                        _emitter: new events.EventEmitter(),
                        serial: null,
                        _closing: false,
                        tout: null,
                        queue: [],
                        on: function(a,b) { this._emitter.on(a,b); },
                        close: function(cb) { this.serial.close(cb); },
                        encodePayload: function (payload) {
                            if (!Buffer.isBuffer(payload)) {
                                if (typeof payload === "object") {
                                    payload = JSON.stringify(payload);
                                }
                                else {
                                    payload = payload.toString();
                                }
                                if (addchar !== "") { payload += addchar; }
                            }
                            else if (addchar !== "") {
                                payload = Buffer.concat([payload,Buffer.from(addchar)]);
                            }
                            return payload;
                        },
                        write: function(m,cb) { this.serial.write(m,cb); },
                        update: function(m,cb) { this.serial.update(m,cb); },
                        enqueue: function(msg,sender,cb) {
                            var payload = this.encodePayload(msg.payload);
                            var qobj = {
                                sender: sender,
                                msg: msg,
                                payload: payload,
                                cb: cb,
                            }
                            this.queue.push(qobj);
                            // If we're enqueing the first message in line,
                            // we shall send it right away
                            if (this.queue.length === 1) {
                                this.writehead();
                            }
                        },
                        writehead: function() {
                            if (!this.queue.length) { return; }
                            var qobj = this.queue[0];
                            this.write(qobj.payload,qobj.cb);
                            var msg = qobj.msg;
                            var timeout = msg.timeout || responsetimeout;
                            this.tout = setTimeout(function () {
                                this.tout = null;
                                var msgout = obj.dequeue() || {};
                                msgout.port = port;
                                // if we have some leftover stuff, just send it
                                if (i !== 0) {
                                    var m = buf.slice(0,i);
                                    m = Buffer.from(m);
                                    i = 0;
                                    if (binoutput !== "bin") { m = m.toString(); }
                                    msgout.payload = m;
                                }
                                /* Notify the sender that a timeout occurred */
                                obj._emitter.emit('timeout',msgout,qobj.sender);
                            }, timeout);
                        },
                        dequeue: function() {
                            // if we are trying to dequeue stuff from an
                            // empty queue, that's an unsolicited message
                            if (!this.queue.length) { return null; }
                            var msg = Object.assign({}, this.queue[0].msg);
                            msg = Object.assign(msg, {
                                request_payload: msg.payload,
                                request_msgid: msg._msgid,
                            });
                            delete msg.payload;
                            if (this.tout) {
                                clearTimeout(obj.tout);
                                obj.tout = null;
                            }
                            this.queue.shift();
                            this.writehead();
                            return msg;
                        },
                    }
                    //newline = newline.replace("\\n","\n").replace("\\r","\r");
                    var olderr = "";
                    var setupSerial = function() {
                        obj.serial = new SerialPort({
                            path: port,
                            baudRate: baud,
                            dataBits: databits,
                            parity: parity,
                            stopBits: stopbits,
                            //parser: serialp.parsers.raw,
                            autoOpen: true
                        }, function(err, results) {
                            if (err) {
                                if (err.toString() !== olderr) {
                                    olderr = err.toString();
                                    RED.log.error("[serialconfig:"+serialConfig.id+"] "+RED._("serial.errors.error",{port:port,error:olderr}), {});
                                }
                                obj.tout = setTimeout(function() {
                                    setupSerial();
                                }, serialReconnectTime);
                            }
                        });
                        obj.serial.on('error', function(err) {
                            RED.log.error("[serialconfig:"+serialConfig.id+"] "+RED._("serial.errors.error",{port:port,error:err.toString()}), {});
                            obj._emitter.emit('closed');
                            if (obj.tout) { clearTimeout(obj.tout); }
                            obj.tout = setTimeout(function() {
                                setupSerial();
                            }, serialReconnectTime);
                        });
                        obj.serial.on('close', function() {
                            if (!obj._closing) {
                                if (olderr !== "unexpected") {
                                    olderr = "unexpected";
                                    RED.log.error("[serialconfig:"+serialConfig.id+"] "+RED._("serial.errors.unexpected-close",{port:port}), {});
                                }
                                obj._emitter.emit('closed');
                                if (obj.tout) { clearTimeout(obj.tout); }
                                obj.tout = setTimeout(function() {
                                    setupSerial();
                                }, serialReconnectTime);
                            }
                        });
                        obj.serial.on('open',function() {
                            olderr = "";
                            RED.log.info("[serialconfig:"+serialConfig.id+"] "+RED._("serial.onopen",{port:port,baud:baud,config: databits+""+parity.charAt(0).toUpperCase()+stopbits}));
                            // Set flow control pins if necessary. Must be set all in same command.
                            var flags = {};
                            if (dtr != "none") { flags.dtr = (dtr!="low"); }
                            if (rts != "none") { flags.rts = (rts!="low"); }
                            if (cts != "none") { flags.cts = (cts!="low"); }
                            if (dsr != "none") { flags.dsr = (dsr!="low"); }
                            if (dtr != "none" || rts != "none" || cts != "none" || dsr != "none") { obj.serial.set(flags); }
                            if (obj.tout) { clearTimeout(obj.tout); obj.tout = null; }
                            //obj.serial.flush();
                            obj._emitter.emit('ready');
                        });

                        obj.serial.on('data',function(d) {
                            function emitData(data) {
                                if (active === true) {
                                    var m = Buffer.from(data);
                                    var last_sender = null;
                                    if (obj.queue.length) { last_sender = obj.queue[0].sender; }
                                    if (binoutput !== "bin") { m = m.toString(); }
                                    var msgout = obj.dequeue() || {};
                                    msgout.payload = m;
                                    msgout.port = port;
                                    obj._emitter.emit('data', msgout, last_sender);
                                }
                                active = (waitfor === "") ? true : false;
                            }

                            for (var z=0; z<d.length; z++) {
                                var c = d[z];
                                if (c === waitfor) { active = true; }
                                if (!active) { continue; }
                                // handle the trivial case first -- single char buffer
                                if ((newline === 0)||(newline === "")) {
                                    emitData(new Buffer.from([c]));
                                    continue;
                                }

                                // save incoming data into local buffer
                                buf[i] = c;
                                i += 1;

                                // do the timer thing
                                if (spliton === "time" || spliton === "interbyte") {
                                    // start the timeout at the first character in case of regular timeout
                                    // restart it at the last character of the this event in case of interbyte timeout
                                    if ((spliton === "time" && i === 1) ||
                                        (spliton === "interbyte" && z === d.length-1)) {
                                        // if we had a response timeout set, clear it:
                                        // we'll emit at least 1 character at some point anyway
                                        if (obj.tout) {
                                            clearTimeout(obj.tout);
                                            obj.tout = null;
                                        }
                                        obj.tout = setTimeout(function () {
                                            obj.tout = null;
                                            emitData(buf.slice(0, i));
                                            i=0;
                                        }, newline);
                                    }
                                }
                                // count bytes into a buffer...
                                else if (spliton === "count") {
                                    newline = serialConfig.newline;
                                    if ( i >= parseInt(newline)) {
                                        emitData(buf.slice(0,i));
                                        i=0;
                                    }
                                }
                                // look to match char...
                                else if (spliton === "char") {
                                    if ((c === splitc[0]) || (i === bufMaxSize)) {
                                        emitData(buf.slice(0,i));
                                        i=0;
                                    }
                                }
                            }
                        });
                        // obj.serial.on("disconnect",function() {
                        //     RED.log.error(RED._("serial.errors.disconnected",{port:port}));
                        // });
                    }
                    setupSerial();
                    return obj;
                }());
                return connections[id];
            },
            close: function(port,done) {
                if (connections[port]) {
                    if (connections[port].tout != null) {
                        clearTimeout(connections[port].tout);
                    }
                    connections[port]._closing = true;
                    try {
                        connections[port].close(function() {
                            RED.log.info(RED._("serial.errors.closed",{port:port}), {});
                            done();
                        });
                    }
                    catch(err) { }
                    delete connections[port];
                }
                else {
                    done();
                }
            }
        }
    }());
	
 	RED.httpAdmin.get("/serialports", RED.auth.needsPermission('serial.read'), function(req,res) {
        SerialPort.list().then(
            ports => {
                const a = ports.map(p => p.path);
                res.json(a);
            },
            err => {
                res.json([RED._("serial.errors.list")]);
            }
        )
    }); 
}