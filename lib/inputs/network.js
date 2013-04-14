var debug = require('debug')('inputs:network')
  , Emitter = require('emitter')
  , now = require('now')
  , buf = require('./buffer')
  , types = require('./types')
  , unhide = require('./util').unhide
  , qstr = require('./util').qstr
  , str = types.toString
  , diff = require('../support/diff')
  , physics = require('../sim/physics')
  , interpolate = require('../sim/interpolate')
  , World = require('../world');

Emitter(exports);

var buffered = []
  , messages = []
  , length = 0
  , net = []
  , loc = [];

// ack is the last acknowledged frame
// it's as far as we can forward and
// know that we'll stay in sync
// TODO what about on new game when the
// world resets it's frame?
var ack = -1;

// used to skip enqueing input during the replay
var replaying = false;

exports.reset = function(all){
  debug('reset %s',all ? '(all)' : '')
  ack = -1;
  if( all ){
    net.length = 0;
    loc.length = 0;
    buffered.length = 0;
    length = 0;
  }
}

exports.info = function(){
  return {
    ack: ack,
    replaying: replaying,
    buffered: buffered.length,
    length: length,
    net: qstr(net),
    loc: qstr(loc),
  }
}

exports.send = function(frame,inputs){
  // skip empty inputs
  if( !inputs.length ){
    return;
  }

  debug('send %s',frame, inputs)
  var msg = buf.build(frame,inputs)

  // 255 byte limit because of 8bit length header
  if( msg.byteLength > 255 ){
    // TODO split into more messages
    throw new Error('invalid msg length: '+buf.byteLength);
  }

  buffered.push(msg);
  length += msg.byteLength;
}

exports.flush = function(){
  if( length ){
    var msg = buf.wrap(buffered,length)
    exports.emit('message',msg)
    buffered.length = 0;
    length = 0;
    return true;

  }
  return false;
}

exports.onmessage = function(buffer){
  // unwrap the arraybuffer into its messages
  if( buf.unwrap(buffer,messages) ){
    debug('onmessage %s messages',messages.length)
    for(var i=0; i<messages.length; i++){
      var inputs = buf.parse(messages[i]);
      var frame = inputs[0];

      // skip if frame is before ack
      if( frame < ack ){
        console.warn('got input in the wrong order (%s < %s). something wrong with netchan? or game has restarted?',frame,ack,str(inputs.slice(1)))
        continue;
      }

      // enqueue each input unless it's
      // an EMIT. in that case just emit it.
      for(var j=1; j<inputs.length; j++){
        var inp = inputs[j];
        if( types.validate(inp) ){
          if( inp[0] === types.EMIT ){
            exports.emit(inp[1],inp[2]);
          } else {
            enqueue(net,frame,inp)
          }
        } else {
          console.warn('received invalid input',inp)
        }
      }

      // update ack
      ack = frame;
    }
    debug('onmessage end ack: %s',ack)

    // reset messages when done
    messages.length = 0;
  }
}

exports.enqueue = function(frame,input){
  replaying || enqueue(loc,frame,input)
}

exports.forward = function(sync,max){
  var a = sync.world.frame
    , b = Math.min(max,ack);

  // did we even start yet?
  if( b === -1 ){
    return;
  }

  // debug('forward %s -> %s (max: %s ack: %s)',a,b,max,ack);

  dequeue(loc,sync.world)
  dequeue(net,sync.world)
  for(var i=a; i<b; i++){
    sync.update()
    dequeue(loc,sync.world)
    dequeue(net,sync.world)
  }
}

// used for replay, keeps the
// "before" states of puck and paddles
var temp = new World('temp');

// from = sync.world
// to = game.world
// frames = number of frames to interpolate over
exports.replay = function(from,to,frames){
  var a = from.frame
    , b = to.frame;

  // debug('replay %s -> %s',a,b);

  // keep a copy of the pucks and paddles
  // for interpolation
  temp.pucks.copy(to.pucks);
  temp.paddles.copy(to.paddles);

  // copy to revert the state
  to.copy(from);

  // verify that they match after copy()
  // verify(from,to) // NOTE: very heavy

  // extrapolate to match the previous state
  replaying = true;
  extrapolate(to,b-a)
  replaying = false;

  // add interpolation between the temp
  // and the post-replay-world.
  // interpolate(temp,to,frames)
}

function enqueue(queue,frame,input){
  debug('enqueue %s %s %s',queue === loc ? '(loc)' : '(net)', frame, str(input))

  // verify that the queue is in order (frame > last frame in queue)
  var last = queue[queue.length-2];
  if( frame < last ){
    console.error('enqueue received an input too early. %s < %s', frame, last)
    console.log('  in queue %s:',queue === loc ? '(loc)' : '(net)',qstr(queue))
    return;
  }
  queue.push(frame,input)
}

function dequeue(queue,world){
  // verify that the frame has not passed the first frame in queue
  if( queue[0] < world.frame ){
    console.error('dequeue cannot pass the first frame in queue. %s < %s', queue[0], world.frame)
    console.log('  in queue %s:',queue === loc ? '(loc)' : '(net)',qstr(queue))
    throw new Error()
    return;
  }

  // execute inputs in queue matching the frame
  while(queue[0]===world.frame){
    var frame = queue.shift()
      , input = queue.shift();
    types.execute(world,input)
  }
}


// to be used by replay() to avoid making copies of
// the queues
function peek(queue,world,start){
  for(var i=start||0; i<queue.length; i+=2){
    var frame = queue[i]
      , input = queue[i+1];

    // stop if frame doesn't match
    if( frame !== world.frame ){
      return i;
    }

    types.execute(world,input)
  }
  return i;
}

function extrapolate(world,steps){
  var timestep = 1/60; // TODO no hard codin...
  var l = 0;
  var n = 0;
  for(var i=0; i<steps; i++){
    // apply inputs from queue
    l = peek(loc,world,l)
    n = peek(net,world,n)

    // apply the physics only
    physics.update(world,timestep)
  }
}

// a, b = world
function verify(a,b){
  debug('verify')
  if( a.code() !== b.code() ){

    var ja = JSON.stringify(a,unhide,2);
    var jb = JSON.stringify(b,unhide,2);
    console.log(diff.createPatch('diff for frame '+a.frame,ja,jb,'game','sync'))

    // alertOnce('hash codes does not match after copy. determinism is not guaranteed.')
    // err(1301,'hash codes does not match')
  }
}