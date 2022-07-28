var requestAppModalView = { //view created using Slack's interactive Block Kit Builder
    "type": "modal",
    "callback_id": "create-google-cal-task",
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
            "text": "Select the user that the task will be assigned to. Only the first selected user will receive the task."
        }
        },
        {
            "type": "input",
            "block_id": "requesteeSelectBlock_BlockID",
            "element": {
            "type": "multi_users_select",
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
            "text": "Label",
            "emoji": true
            }
        },
        {
            "type": "input",
            "block_id": "TaskTitle_BlockID",
            "element": {
                "type": "plain_text_input",
                "action_id": "TaskTitle_ActionID"
            },
            "label": {
                "type": "plain_text",
                "text": "Title of Task",
                "emoji": true
            }
        },
        {
            "type": "input",
            "block_id": "TaskDescription_BlockID",
            "element": {
                "type": "plain_text_input",
                "action_id": "TaskDescription_ActionID"
            },
            "label": {
                "type": "plain_text",
                "text": "Describe the Task. ",
                "emoji": true
            }
        },
        {
			"type": "input",
            "block_id": "TaskDueDate_BlockID",
			"element": {
				"type": "datepicker",
				"initial_date": "2022-07-28",
				"placeholder": {
					"type": "plain_text",
					"text": "Select a date",
					"emoji": true
				},
				"action_id": "TaskDueDate_ActionID"
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