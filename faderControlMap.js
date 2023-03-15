var XT = require('./index');


XT.start(function(msg) {
    console.log('Midi Init: ' + msg);
},{port:1});



XT.controlMap({
  'fader': function(name, state) { console.log(name,state); },
});
