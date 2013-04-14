var debug = require('debug')('inputs:core')
  , Emitter = require('emitter')
  , network = require('./network')
  , types = require('./types')
  , buf = require('./buffer')
  , str = types.toString;

var buffer = [] // keeps the recorded inputs
  , slice = [].slice;

Emitter(exports);

exports.types = types;
exports.network = network;

exports.reset = function(){
  buffer.length = 0;
  buf.reset()
  network.reset()
}

exports.record = function(){
  debug('record',str(arguments))

  // validate input
  if( types.validate(arguments) ){
    // push the input into a temporary buffer
    buffer.push(slice.call(arguments))
  } else {
    console.warn('recorded invalid input:',arguments);
  }
}

exports.process = function(world){
  // send to network
  world.multiplayer && network.send(world.frame,buffer)

  // execute and enqueue the inputs
  for(var i=0; i<buffer.length; i++){
    // skip EMITs and PING/PONG, they should
    // only be sent over the network
    var type = buffer[i][0];
    if( type === types.EMIT ) continue;
    if( type === types.PING ) continue;
    if( type === types.PONG ) continue;

    // enqueue for network replay
    // (do this first in case execute clears the buffer)
    world.multiplayer && network.enqueue(world.frame,buffer[i])

    // execute inputs locally
    types.execute(world,buffer[i]);
  }

  // reset buffer
  buffer.length = 0;
}

exports.info = function(ctx){
  var info = network.info();
  info.recorded = buffer.length;
  return info;
}
