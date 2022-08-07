var requestAppModalView = { //view created using Slack's interactive Block Kit Builder
    "type": "modal",
    "callback_id": "create-google-cal-task-callback",
    "title": {
      "type": "plain_text",
      "text": "Slack-RequestApp",
      "emoji": true
    },
    "submit": {
      "type": "plain_text",
      "text": "Submit",
      "emoji": true
    },
    "close": {
      "type": "plain_text",
      "text": "Cancel",
      "emoji": true
    },
    "blocks": [
        {
        "type": "section",
        "text": {
            "type": "mrkdwn",
            "text": "This is used to assign a user a task that need to be completed. The request will be pushed to the Google Calendar of the email address specified below."
        }
        },
        {
            "type": "input",
            "block_id": "requesteeSelectBlock_BlockID",
            "element": {
                "type": "users_select",
                "placeholder": {
                    "type": "plain_text",
                    "text": "Select One User",
                    "emoji": true
                },
                "action_id": "requesteeSelectBlock_ActionID",
            },
            "label": {
                "type": "plain_text",
                "text": "User who will be assigned task:",
                "emoji": true
            }
        },
        {
            "type": "input",
            "block_id": "requesteeEmailAddress_BlockID",
            "element": {
                "type": "plain_text_input",
                "placeholder": {
                    "type": "plain_text",
                    "text": "Enter Email Address",
                    "emoji": true
                },
                "action_id": "requesteeEmailAddress_ActionID",
            },
            "label": {
                "type": "plain_text",
                "text": "Enter their email address, preferably a work address:",
                "emoji": true
            }
        },
        {
			"type": "context",
			"elements": [
				{
					"type": "plain_text",
					"text": "Try and use the same email address as you did before, if this isn't the first time you're assigning this user a task.",
					"emoji": true
				}
			]
		},
        {
            "type": "input",
            "block_id": "taskTitle_BlockID",
            "element": {
                "type": "plain_text_input",
                "placeholder": {
					"type": "plain_text",
					"text": "Enter the title of the task.",
					"emoji": true
				},
                "action_id": "taskTitle_ActionID"
            },
            "label": {
                "type": "plain_text",
                "text": "Title of Task",
                "emoji": true
            }
        },
        {
            "type": "input",
            "block_id": "taskDescription_BlockID",
            "element": {
                "type": "plain_text_input",
                "placeholder": {
					"type": "plain_text",
					"text": "Enter a description for this task. You should provide context, and describe what is required.",
					"emoji": true
				},
                "multiline": true,
                "action_id": "taskDescription_ActionID"
            },
            "label": {
                "type": "plain_text",
                "text": "Describe the Task. ",
                "emoji": true
            }
        },
        {
			"type": "input",
            "block_id": "taskDueDate_BlockID",
			"element": {
				"type": "datepicker",
				"placeholder": {
					"type": "plain_text",
					"text": "Select a date",
					"emoji": true
				},
				"action_id": "taskDueDate_ActionID"
			},
			"label": {
				"type": "plain_text",
				"text": "When does the task need to be completed by? The task will be due at 12 or 1 AM on this date, depending on Daylight Savings Time.",
				"emoji": true
			}
		}
    ]
};

//export the modal view
module.exports = {
    modalForm: requestAppModalView
};