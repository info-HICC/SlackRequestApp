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

var requestApp_CreateRequestModalView = {
	"type": "modal",
    "callback_id": "createExpenseRequest-callback",
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
			"type": "divider"
		},
		{
			"type": "context",
			"elements": [
				{
					"type": "mrkdwn",
					"text": "Enter a short description about what this request is for. Avoid using quotation marks, if possible. Use alternatives like parentheses, or brackets. "
				}
			]
		},
		{
			"type": "input",
            "block_id": "Description_BlockID",
			"element": {
				"type": "plain_text_input",
				"multiline": true,
				"action_id": "Description_ActionID"
			},
			"label": {
				"type": "plain_text",
				"text": "Enter Description",
				"emoji": true
			}
		},
		{
			"type": "divider"
		},
		{
			"type": "divider"
		},
		{
			"type": "context",
			"elements": [
				{
					"type": "mrkdwn",
					"text": "Enter the cost of the request. Use numbers so that it's easier to read. \nThere is no strict format, but try to express dollar amounts as you would normally like: \"$1.00\" or \"$10\"."
				}
			]
		},
		{
			"type": "input",
            "block_id": "Cost_BlockID",
			"element": {
				"type": "plain_text_input",
				"action_id": "Cost_ActionID"
			},
			"label": {
				"type": "plain_text",
				"text": "Enter Cost",
				"emoji": true
			}
		},
		{
			"type": "divider"
		},
		{
			"type": "divider"
		},
		{
			"type": "context",
			"elements": [
				{
					"type": "mrkdwn",
					"text": "What date must the payment be made by, if approved?"
				}
			]
		},
		{
			"type": "input",
            "block_id": "paymentDueByDate_BlockID",
			"element": {
				"type": "datepicker",
				"placeholder": {
					"type": "plain_text",
					"text": "Select a date",
					"emoji": true
				},
				"action_id": "paymentDueByDate_ActionID"
			},
			"label": {
				"type": "plain_text",
				"text": "Select Date",
				"emoji": true
			}
		},
		{
			"type": "divider"
		},
		{
			"type": "divider"
		},
		{
			"type": "section",
			"text": {
				"type": "mrkdwn",
				"text": "Add any optional images by linking to a Google Drive Image or Folder"
			}
		},
		{
			"type": "context",
			"elements": [
				{
					"type": "mrkdwn",
					"text": "Please make sure that your image links are viewable publicly (meaning not signed into a Google Account). Suggestion is to use Google Drive, but make sure the image is set to be viewable by anyone with link; you can find a guide for Google Drive Sharing here: \n[https://slack-requestapp.herokuapp.com/slack/help/GoogleDriveImagePerms]"
				}
			]
		},
		{
			"type": "input",
            "block_id": "imageLink_BlockID",
			"optional": true,
			"element": {
				"type": "plain_text_input",
				"placeholder": {
					"type": "plain_text",
					"text": "Paste Link to Image or Folder",
					"emoji": true
				},
				"action_id": "imageLink_ActionID"
			},
			"label": {
				"type": "plain_text",
				"text": "Paste Google Drive Link",
				"emoji": true
			}
		}
	]
};

//export the modal view
module.exports = {
    modalForm: requestAppModalView,
    createRequestView: requestApp_CreateRequestModalView
};