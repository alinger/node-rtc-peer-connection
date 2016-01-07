var isNode = typeof module !== 'undefined';
if (isNode) {
  // Create new global vars.
  WebSocket = require('ws');
  RTCPeerConnection = require('../lib/RTCPeerConnection');
  RTCSessionDescription = require('../lib/RTCSessionDescription');
  RTCIceCandidate = require('../lib/RTCIceCandidate');
}

// Firefox 42 support
if ('mozRTCPeerConnection' in this) {
  RTCPeerConnection = mozRTCPeerConnection;
  RTCSessionDescription = mozRTCSessionDescription;
  RTCIceCandidate = mozRTCIceCandidate;
}

// Opera 35 support
if ('webkitRTCPeerConnection' in this) {
  RTCPeerConnection = webkitRTCPeerConnection;
}

var iceServers = {
  iceServers: [
      "stun.l.google.com:19302",
      //"stun1.l.google.com:19302",
      //"stun2.l.google.com:19302",
      //"stun3.l.google.com:19302",
      //"stun4.l.google.com:19302",
      //"stun.ekiga.net",
      //"stun.ideasip.com",
      //"stun.schlund.de",
      //"stun.stunprotocol.org:3478",
      //"stun.voiparound.com",
      //"stun.voipbuster.com",
      //"stun.voipstunt.com",
      //"stun.voxgratia.org",
      //"stun.services.mozilla.com"
  ].map(function (url) {
    return {
      urls: 'stun:' + url,
    };
  }),
};

//function uuid () {
  //// http://stackoverflow.com/a/2117523/1027966
  //return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    //var r = crypto.getRandomValues(new Uint8Array(1))[0]%16|0;
    //var v = c == 'x' ? r : (r & 0x3 | 0x8);
    //return v.toString(16);
  //});
//};

RTC.prototype.buildWS = function (url) {
  var rtc = this;
  if (this.ws) {
    return;
  }
  var ws = new WebSocket(url);
  ws.onopen = function () {
    if (!isNode) {
      window.addEventListener('beforeunload', function () {
        ws.close();
      });
      rtc.call();
    }
  };
  ws.addEventListener('message', function (m) {
    //console.log(m);
    this.handleEvent(m);
  }.bind(this));
  return ws;
};

RTC.prototype.handleEvent = function (e) {
  //console.log(e.type, e);
  if (e.type === 'message' && e.data) {
    var msg = JSON.parse(e.data);
    this.onmessage(msg);
  } else if (e.type === 'negotiationneeded') {
    //console.log('negotiationneeded');
    this.onnegotiationneeded(e.target);
  } else if (e.type === 'icecandidate' && e.candidate) {
    this.ws.send(JSON.stringify(e.candidate));
  // a dc was established from the other side
  } else if (e.type === 'datachannel') {
    this.dc = e.channel;
  }
};

RTC.prototype.onmessage = function (msg) {
  var peer = this.peers.length ? this.peers[0] : this.createPeer();
  if (msg.sdp) {
    //console.log(msg);
    var sd = new RTCSessionDescription(msg);
    if (msg.type === 'offer') {
      peer.setRemoteDescription(sd).then(function () {
        return peer.createAnswer();
      }).then(function (answer) {
        return peer.setLocalDescription(answer);
      }).then(function () {
        this.ws.send(JSON.stringify(peer.localDescription));
      }.bind(this)).catch(this.logErr);
    } else if (msg.type === 'answer') {
      peer.setRemoteDescription(sd).catch(this.logErr);
    }
  } else if (msg.candidate) {
    var ic = new RTCIceCandidate(msg);
    peer.addIceCandidate(ic).catch(this.logErr);
  }
};

RTC.prototype.onnegotiationneeded = function (peer) {
  peer.createOffer().then(function (offer) {
    //console.log(offer.sdp.split('\r\n'));
    return peer.setLocalDescription(offer);
  }).then(function () {
    this.ws.send(JSON.stringify(peer.localDescription));
  }.bind(this)).catch(this.logErr);
};

RTC.prototype.createPeer = function () {
  var peer = new RTCPeerConnection(iceServers);
  peer.addEventListener('icecandidate', this);
  // triggered if/when peer.createDataChannel is called
  peer.addEventListener('negotiationneeded', this);
  peer.addEventListener('datachannel', this);
  peer.addEventListener('iceconnectionstatechange', this);
  this.peers.push(peer);
  return peer;
};

RTC.prototype.logErr = function (err) {
  console.error(err);
};

RTC.prototype.call = function () {
  var peer = this.peers.length ? this.peers[0] : this.createPeer();
  var dc = peer.createDataChannel('hello');
  dc.onopen = console.log.bind(console, 'open');
  this.dc = dc;
  return dc;
};


function RTC (server) {
  //this.uuid = uuid();
  this.peers = [];

  this.ws = this.buildWS(server);
};

// main
var a = new RTC('ws://localhost:8081');
