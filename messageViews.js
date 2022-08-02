var taskeeUpdateMessage = {
	"blocks": [
		{
			"type": "context",
			"elements": [
				{
					"type": "plain_text",
					"text": "Here are the contents of a task that was assigned to you.",
					"emoji": true
				}
			]
		},
		{
			"type": "divider"
		},
		{
			"type": "context",
			"elements": [
				{
					"type": "mrkdwn",
					"text": "*Cat* has approved this message."
				},
				{
					"type": "mrkdwn",
					"text": "*Cat* has approved this message."
				}
			]
		},
		{
			"type": "divider"
		},
		{
			"type": "actions",
			"elements": [
				{
					"type": "button",
					"text": {
						"type": "plain_text",
						"text": "Click when done",
						"emoji": true
					},
					"value": "click_me_123",
					"action_id": "actionId-0"
				}
			]
		}
	]
};

//export the modal view
module.exports = {
    updateMessage: taskeeUpdateMessage
};