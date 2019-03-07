import {LightningElement, api, wire, track} from 'lwc';
import { loadScript, loadStyle } from 'lightning/platformResourceLoader';
import getUserSession from '@salesforce/apex/Utils.getUserSession';
import COMETD from '@salesforce/resourceUrl/cometd';
import JQUERY from '@salesforce/resourceUrl/jquery';
import JQUERY_COMETD from '@salesforce/resourceUrl/jquery_cometd';
import JSON2 from '@salesforce/resourceUrl/json2';

export default class Purelwcstreaming extends LightningElement {
    @track messages = [];

    addMessage(message) {
        this.messages.push(message);
    }
    connectedCallback() {
        var sessionId;

        getUserSession()
            .then(result => {
                sessionId = result;

                Promise.all([
                    loadScript(this, COMETD + '/cometd/cometd.js'),
                    loadScript(this, JQUERY),
                    loadScript(this, JSON2)
                ])
                .then(() => {
                   Promise.all([
                        loadScript(this, JQUERY_COMETD)
                    ])
                    .then(() => {
                        this.afterScriptsLoaded(sessionId);
                    })
                    .catch(error => {
                        console.log('error loading resources 2', error);
                    });
                })
                .catch(error => {
                    console.log('error loading resources 1', error);
                });

        })
        .catch(error => {
            console.log('this.error', this.error);
        });
    }

    afterScriptsLoaded(sessionId) {

        console.log('cometd', $.cometd);
        const cometd = $.cometd;

        let subscribedToChannel;
        let isExtensionEnabled;
        let metaConnectListener;
        let metaDisconnectListener;
        let metaHandshakeListener;
        let metaSubscribeListener;
        let metaUnSubscribeListener
        let metaUnSucessfulListener;
        let REPLAY_FROM = 'replayFrom';
        let REPLAY_FROM_KEY = 'replay';


        const replayId = -1; //new events
        const channel = '/event/Hello_World__e';



        var hThis = this;

        var cometdReplayExtension = function() {
            var REPLAY_FROM_KEY = "replay";

            var _cometd;
            var _extensionEnabled;
            var _replay;
            var _channel;

            this.setExtensionEnabled = function(extensionEnabled) {
                _extensionEnabled = extensionEnabled;
            }

            this.setReplay = function (replay) {
                _replay = parseInt(replay, 10);
            }

            this.setChannel = function(channel) {
                _channel = channel;
            }

            this.registered = function(name, cometd) {
                _cometd = cometd;
            };

            this.incoming = function(message) {
                if (message.channel === '/meta/handshake') {
                    if (message.ext && message.ext[REPLAY_FROM_KEY] == true) {
                        _extensionEnabled = true;
                    }
                } else if (message.channel === _channel && message.data && message.data.event && message.data.event.replayId) {
                    _replay = message.data.event.replayId;
                }
            }

            this.outgoing = function(message) {
                if (message.channel === '/meta/subscribe') {
                    if (_extensionEnabled) {
                        if (!message.ext) { message.ext = {}; }

                        var replayFromMap = {};
                        replayFromMap[_channel] = _replay;

                        // add "ext : { "replay" : { CHANNEL : REPLAY_VALUE }}" to subscribe message
                        message.ext[REPLAY_FROM_KEY] = replayFromMap;
                    }
                }
            };
        };

        function subscribe(channel) {
            // Subscribe to a topic. JSON-encoded update will be returned in the callback
            return cometd.subscribe(channel, function (message) {
                console.log('subscribe', message);
                console.log('message.data.payload.Message__c', message.data.payload.Message__c);
                hThis.addMessage(message.data.payload.Message__c);
            });
        }

        // ensure extension isn't already registered
        if (cometd.getExtension(REPLAY_FROM) != null) {
            cometd.unregisterExtension(REPLAY_FROM, replayExtension);
        }

        // register Durable PushTopic Streaming replayFrom extension
        let replayExtension = new cometdReplayExtension();
        replayExtension.setChannel(channel);
        replayExtension.setReplay(replayId);
        if(isExtensionEnabled) {
            replayExtension.setExtensionEnabled(isExtensionEnabled);
        }
        cometd.registerExtension(REPLAY_FROM, replayExtension);

        // unsubscribe if you have already subscribed
        if(subscribedToChannel) {
            cometd.unsubscribe(subscribedToChannel, null, function(unsubscribeReply) {
                subscribedToChannel = subscribe(channel);
            });
        }


        let _connected = false;
        if(!metaConnectListener) {
            metaConnectListener = cometd.addListener('/meta/connect', function(message) {
                if (cometd.isDisconnected()) {
                    console.log('message', message);
                    return;
                }

                let wasConnected = _connected;
                _connected = message.successful;

                if (!wasConnected && _connected) {
                    console.log('DEBUG: Connection Successful', message);
                } else if (wasConnected && !_connected) {
                    console.log('DEBUG: Disconnected from the server', message);
                }
            });
        }

        if(!metaDisconnectListener) {
            metaDisconnectListener = cometd.addListener('/meta/disconnect', function(message) {
                console.log('DEBUG: /meta/disconnect message', message);
            });
        }

        if(!metaHandshakeListener) {
            metaHandshakeListener = cometd.addListener('/meta/handshake', function(message) {
                if (message.successful) {
                    console.log('DEBUG: Handshake Successful', message);
                    if (message.ext && message.ext[REPLAY_FROM_KEY] == true) {
                        isExtensionEnabled = true;
                    }
                    subscribedToChannel = subscribe(channel);
                } else
                    console.log('DEBUG: Handshake Unsuccessful', message);
            });
        }



        if(!metaSubscribeListener) {
            metaSubscribeListener = cometd.addListener('/meta/subscribe', function(message) {
                if (message.successful) {
                    console.log('DEBUG: Subscribe Successful :' + channel, message);
                } else {
                    console.log('DEBUG: Subscribe Unsuccessful :' + channel, message);
                }
            });
        }


        if(!metaUnSubscribeListener) {
            metaUnSubscribeListener = cometd.addListener('/meta/unsubscribe', function(message) {
                if (message.successful) {
                    console.log('DEBUG: Subscribe Successful', message);
                } else {
                    console.log('DEBUG: Subscribe Unsuccessful', message);
                }
            });
        }

        // notifies any failures
        if(!metaUnSucessfulListener) {
            metaUnSucessfulListener = cometd.addListener('/meta/unsuccessful', function(message) {
                console.log('DEBUG: /meta/unsuccessful Error', message);
            });
        }

        cometd.websocketEnabled = false;

        // Connect to the CometD endpoint
        cometd.configure({
            url: '/cometd/45.0',
            requestHeaders: { Authorization: 'OAuth ' + sessionId}
        });

        cometd.handshake();

        function disconnect() {
            if (cometd) {
                cometd.removeListener(metaConnectListener);
                cometd.removeListener(metaDisconnectListener);
                cometd.removeListener(metaHandshakeListener);
                cometd.removeListener(metaSubscribeListener);
                cometd.removeListener(metaUnSubscribeListener);
                cometd.unsubscribe(subscribedToChannel);
                cometd.disconnect();
            }
        }
        window.onbeforeunload = disconnect;
    }

}