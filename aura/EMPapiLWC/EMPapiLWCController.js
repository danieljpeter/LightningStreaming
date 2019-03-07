({
    onInit : function(cmp, event, helper) {
        //Get the empApi component
        var empApi = cmp.find('empApi');
        empApi.setDebugFlag(true);

        //Register error listener and pass in handleError function
        var handleError = function (error) {
            console.log('empApi error', error);
        };
        empApi.onError(handleError);

        var replayId = -1; //new events
        var channel = '/event/Hello_World__e';

        /*

        for change data capture:
        '/data/Hello_World__ChangeEvent';

        for PushTopic (Streaming)
        '/topic/HelloWorldTopic';

        for Streaming Channel (generic)
        '/u/HelloWorldEvent';

        */

        //function that runs when event is fired
        var handleEventReceived = function (eventObj) {
            var messages = cmp.get('v.messages');
            messages.push(eventObj.data.payload.Message__c);
            cmp.set('v.messages', messages);
        };
        empApi.subscribe(channel, replayId, handleEventReceived).then(function(value) {
            console.log('Subscribed to channel: ' + channel);
        });
    }
})