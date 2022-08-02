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
					"text": message_template
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
            "block_id": "TaskDoneOrNotDone_BlockID",
			"elements": [
				{
					"type": "button",
					"text": {
						"type": "plain_text",
						"text": "Click when done",
						"emoji": true
					},
					"value": "TaskCompleted",
					"action_id": "TaskDone_ActionID"
				},
                {
					"type": "button",
					"text": {
						"type": "plain_text",
						"text": "Click if task cannot be completed on time",
						"emoji": true
					},
					"value": "TaskNotCompleted",
					"action_id": "TaskNotDone_ActionID"
				}
			]
		}
	]
};
// var taskeeUpdateMessageAsString = JSON.stringify(taskeeUpdateMessage.blocks);

//export the modal view
module.exports = {
    updateMessage: taskeeUpdateMessage
};