var system = client.registerSystem(0,0);

system.initialize = function() {
	this.listenForEvent("minecraft:client_entered_world", (eventData) => this.onEntered(eventData));
}

system.onEntered = function(eventData) {
    this.broadcastEvent("othello:setup", eventData);
}