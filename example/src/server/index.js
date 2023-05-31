import '@soundworks/helpers/polyfills.js';
import { Server } from '@soundworks/core/server.js';

import { loadConfig } from '../utils/load-config.js';
import '../utils/catch-unhandled-errors.js';
import globalsSchema from './schemas/globals.js';

import XT from '../../../index.js';

// - General documentation: https://soundworks.dev/
// - API documentation:     https://soundworks.dev/api
// - Issue Tracker:         https://github.com/collective-soundworks/soundworks/issues
// - Wizard & Tools:        `npx soundworks`

const config = loadConfig(process.env.ENV, import.meta.url);

console.log(`
--------------------------------------------------------
- launching "${config.app.name}" in "${process.env.ENV || 'default'}" environment
- [pid: ${process.pid}]
--------------------------------------------------------
`);

function updatePage(sens) {

    const keys = Object.keys(midiConfig);
    const filteredKeys = keys.filter(e => { return e !== 'MAIN' });
    const lastIndex = parseInt(filteredKeys.slice(-1)[0] - 1);

    switch (sens) {
        case 'up':

            if (page < Math.floor(lastIndex/8)) {
                page += 1;
                // console.log(`page ${page}`);
                setFaderView();

            } else {
                // console.log("cant go up than this")
            }
        break;
        case 'down':
            if (page > 0) {

                page -= 1;
                // console.log(`page ${page}`);
                setFaderView();

            } else {
                // console.log("cant go less than 0")
            }
        break;
        default:
    }
}

function onFaderMove( name, state ) {
  // change way to understand MAIN !
  const chName = ['CH1','CH2','CH3','CH4','CH5','CH6','CH7','CH8'];

  let absFaderNumber = chName.indexOf(name) + 1 + page * 8;
  let relFaderNumber = chName.indexOf(name) + 1;

  if (midiConfig[absFaderNumber] !== undefined) {
    XT.setFaderRelease(`CH${relFaderNumber}`, true);
    if (midiConfig[absFaderNumber].type === "linear") {
      const range = midiConfig[absFaderNumber].range;
      const sens = (range[1] > range[0]) ? 1 : -1;
      const raw = state / (device.fader.length - 1);
      const amplitude = Math.abs(range[1] - range[0]);
      const value = range[0] + sens * (raw * amplitude);
      if (typeof state === 'number') {
        midiConfig[absFaderNumber].value = value;
      }
    } else if (midiConfig[absFaderNumber].type === "volume") {
      const value = device.fader[state];
      if (typeof state === 'number') {
        midiConfig[absFaderNumber].value = value;
      }
    }
    const value = midiConfig[absFaderNumber].value;
    const patch = midiConfig[absFaderNumber].patch;
    let update = {};
    update[patch] = value;
    globals.set(update);


  } else {
    XT.setFaderRelease(`CH${relFaderNumber}`, false);
    XT.setFader(`CH${relFaderNumber}`,0);
  }

}




function computeFaderValue(i) {
  let value;
  switch (midiConfig[i].type) {
    case 'linear': {
      const input = midiConfig[i].value;
      const range = midiConfig[i].range;
      const sens = (range[1] > range[0]) ? 1 : -1;
      const amplitude = Math.abs(range[1] - range[0]);
      const raw = sens * (input - range[0]) / amplitude;
      value = raw * (device.fader.length - 1);
      break;
    }
    case 'volume': {
      const input = midiConfig[i].value;
      const valueInList = device.fader.reduce((a, b) => {
        return Math.abs(b - input) < Math.abs(a - input) ? b : a;
      });
      value = device.fader.findIndex( (e) => e === valueInList );
      break;
    }
    default:
      break;
  }
  return value;
}

function setFaderView() {
  const keys = Object.keys(midiConfig);
  const filteredKeys = keys.filter(e => { return e !== 'MAIN' });
  const lastIndex = parseInt(filteredKeys.slice(-1)[0]);

  const iMax = Math.ceil(lastIndex/8) * 8;

  // reset sub-view
  bankFaderValue = [];
  bankFaderName = [];

  // special case for Main fader
  if (midiConfig['MAIN'] !== undefined) {
    XT.setFader('MAIN', computeFaderValue('MAIN'));
  } else {
    XT.setFader('MAIN', 0);
  }

  // normal case
  for (let i=1;i<=iMax;i++) {
      if (i > (page*8) && i <= ((page+1)*8)) {
          if (midiConfig[i] !== undefined) {

            // fader has a value
            const faderIndex = (i - 1) % 8 + 1;
            const destination = midiConfig[i].patch;
            const value = midiConfig[i].value
            const name = midiConfig[i].name;

            // set value
            XT.setFader(`CH${faderIndex}`, computeFaderValue(i));

            // subview for displayed faders
            bankFaderValue.push(value);
            bankFaderName.push(name);

          } else {
            // fader has no value
            const faderIndex = (i - 1) % 8 + 1;

            XT.setFader(`CH${faderIndex}`, 0);

            bankFaderName.push('');
            bankFaderValue.push('');
          }
      }
  }
  // update display
  XT.setFaderDisplay(bankFaderName,'top');
  XT.setFaderDisplay(bankFaderValue,'bottom');
}

function updateFaderView(i) {
  const value = midiConfig[i].value;

  // compute relative index
  let relIndex = (i - 1) % 8 + 1;
  if ( relIndex + (page*8) === parseFloat(i) ) {
    // ok
  } else {
    relIndex = null;
  }

  if (relIndex) {
    // set value
    XT.setFader(`CH${relIndex}`, computeFaderValue(i));

    // update sub view
    bankFaderValue[relIndex-1] = value;

    // set display
    XT.setFaderDisplay(bankFaderValue,'bottom');
  }

  if (i === 'MAIN') {
    XT.setFader('MAIN', computeFaderValue(i));
  }

}



/**
 * Create the soundworks server
 */
const server = new Server(config);
// configure the server for usage within this application template
server.useDefaultApplicationTemplate();

/**
 * Register plugins and schemas
 */
// server.pluginManager.register('my-plugin', plugin);
// server.stateManager.registerSchema('my-schema', definition);

/**
 * Launch application (init plugins, http server, etc.)
 */
await server.start();

server.stateManager.registerSchema('globals', globalsSchema);

const globals = await server.stateManager.create('globals');

const midiConfig = {
  '1': { patch:"fader1", name:"1", type:'volume' },
  '7': { patch:"fader2", name:"7", type:'linear', range: [0, 127] },
  '9': { patch:"fader3", name:"9", type:'volume' },
  '24': { patch:"fader4", name:"24", type:'volume' },
}

// Init XT lib
const midiDevice = "iConnectMIDI2+ DIN 1"
const port = XT.getPorts().findIndex( (e) => e === midiDevice );
if (port !== -1) {
  XT.start(function(msg) {
    console.log('Midi Init:', midiDevice);
    // console.log('Midi Init: ' + msg);
  },{port:port});
} else {
  console.log("[midi.mixer] - Cannot find midi device !");
  throw new Error("Can't find midi device - abort.");
}

import device from '../../../Controllers/studer.js'

let page = 0;
let bankFaderName = [];
let bankFaderValue = [];

// init fader mode
XT.setFaderMode('CH1', 'position', device.fader.length, true);
XT.setFaderMode('CH2', 'position', device.fader.length, true);
XT.setFaderMode('CH3', 'position', device.fader.length, true);
XT.setFaderMode('CH4', 'position', device.fader.length, true);
XT.setFaderMode('CH5', 'position', device.fader.length, true);
XT.setFaderMode('CH6', 'position', device.fader.length, true);
XT.setFaderMode('CH7', 'position', device.fader.length, true);
XT.setFaderMode('CH8', 'position', device.fader.length, true);
XT.setFaderMode('MAIN', 'position', device.fader.length, true);

// init fader values
for (let i in midiConfig) {
  switch (midiConfig[i].type) {
    case 'linear':
      midiConfig[i].value = midiConfig[i].range[0];
      break;
    case 'volume':
      midiConfig[i].value = device.fader[0];
      break;
    default:
      break;
  }
}

setFaderView();

globals.onUpdate(async (values) => {
  for (let i in midiConfig) {
    const key = Object.keys(values)[0];
    if (midiConfig[i].patch === key) {
      midiConfig[i].value = values[key];
      console.log("updateView should not be called when fader is moved!");
      updateFaderView(i);
    }
  }
});

XT.controlMap({
  'button': {
    'down': {
      'FADER BANK RIGHT': function() { updatePage("up"); },
      'FADER BANK LEFT': function() { updatePage("down"); },
    },
  },
  'fader': onFaderMove,
});
