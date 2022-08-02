module.exports.updateMessageContent = function (task_id, task_title, task_description, task_due_date, JSON_channel_ts) {
    var template = `{
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
                "block_id": "task_id_BlockID",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": ">RequestID: \`${task_id}\`"
                    }
                ]
            },
            {
                "type": "context",
                "block_id": "task_title_BlockID",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": ">The name of the task: \`${task_title}\`."
                    }
                ]
            },
            {
                "type": "context",
                "block_id": "task_description_BlockID",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": ">The description of the task: \`${task_description}\`"
                    }
                ]
            },
            {
                "type": "context",
                "block_id": "task_due_date_BlockID",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": ">The assigned due date is \`${task_due_date}\`."
                    }
                ]
            },
            {
                "type": "context",
                "block_id": "JSON_channel_ts_BlockID",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": ">You can ignore this, it's just for reference: \`${task_due_date}\`."
                    }
                ]
            },
            {
                "type": "divider"
            },
            {
                "type": "actions",
                "block_id": "Update_Status_BlockID",
                "elements": [
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "Update Status",
                            "emoji": true
                        },
                        "value": "UpdateStatus",
                        "action_id": "Update_Status_ActionID"
                    }
                ]
            }
        ]
    }`;
    console.log(template);
    return template;
};


// //export the modal view
// module.exports = {
//     updateMessage: taskeeUpdateMessage
// };