module.exports.updateMessageContent = function (task_id, task_title, task_description, task_due_date, JSON_channel_ts) {
    var template = `{
        "blocks": [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "Task Assignment",
                    "emoji": true
                }
            },
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
                        "text": ">You can ignore this, it's just for reference: \`${JSON_channel_ts}\`."
                    }
                ]
            },
            {
                "type": "divider"
            },
            {
                "type": "actions",
                "block_id": "TaskDone_TaskNotDone_BlockID",
                "elements": [
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "Task Done",
                            "emoji": true
                        },
                        "value": "TaskDone",
                        "action_id": "TaskDone_ActionID"
                    },
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "Task Not Done By Due Date",
                            "emoji": true
                        },
                        "value": "TaskNotDone",
                        "action_id": "TaskNotDone_ActionID"
                    }
                ]
            }
        ]
    }`;
    return template;
};

module.exports.createRequestMessageForApprovers = async function (inputData, slackApp) {
    //the slackApp parameter is used to pass through Slack's Web APIs so that I can post the message into the channel without sending the msg back.
    var inputData_parsed = JSON.parse(inputData);
    var requesterID = inputData_parsed.requesterID;
    var requestID = inputData_parsed.requestID;
    var JSON_ts = inputData_parsed.JSON_ts;
    var task_description = inputData_parsed.task_description;
    var productName = inputData_parsed.productName;
    var productCost = inputData_parsed.productCost;
    var transactionType_asText = inputData_parsed.transactionType_asText;
    var paymentMethod = inputData_parsed.paymentMethod;
    var paymentToVendorOrCustomer = inputData_parsed.paymentToVendorOrCustomer;
    var paymentToVendorOrCustomer_name = inputData_parsed.paymentToVendorOrCustomer_name;
    var makePaymentByDate = inputData_parsed.makePaymentByDate;
    var imageLinksThatWereSubmitted = inputData_parsed.imageLinksThatWereSubmitted;

    var template = `{
        "blocks": [
            {
                "type": "image",
                "block_id": "image_BlockID",
                "image_url": "https://slack-requestapp.herokuapp.com/static/whiteLine_600_50.png",
                "alt_text": "A plain white image that's used to split messages."
            },
            {
                "type": "section",
                "block_id": "approvers_requesterNotification_BlockID",
                "text": {
                    "type": "mrkdwn",
                    "text": "New Expense request from <@${requesterID}>"
                }
            },
            {
                "type": "section",
                "block_id": "approvers_requestID_BlockID",
                "text": {
                    "type": "mrkdwn",
                    "text": "*Request ID:* ${requestID}"
                }
            },
            {
                "type": "section",
                "block_id": "approvers_JSONts_BlockID",
                "text": {
                    "type": "mrkdwn",
                    "text": "*Timestamp of JSON version of message:* ${JSON_ts}"
                }
            },
            {
                "type": "section",
                "block_id": "approvers_requestDescription_BlockID",
                "text": {
                    "type": "mrkdwn",
                    "text": "*Description (also part of Memo on Quickbooks Online):*\\n${task_description}"
                }
            },
            {
                "type": "section",
                "block_id": "approvers_requestInformation_BlockID",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": ">*Product Name:*\\n>${productName}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": ">*Product Cost:*\\n>$${productCost}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": ">*Expense Type/Category:*\\n>${transactionType_asText}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": ">*Payment Method:*\\n>${paymentMethod}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": ">*Vendor or Customer:*\\n>${paymentToVendorOrCustomer}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": ">*Vendor or Customer Name:*\\n>${paymentToVendorOrCustomer_name}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": ">*Payment should be made by:*\\n>${makePaymentByDate}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": ">*Any images that may have been attached:*\\n>${imageLinksThatWereSubmitted}"
                    }
                ]
            },
            {
                "type": "section",
                "block_id": "expenseRequestStatus_BlockID",
                "text": {
                    "type": "mrkdwn",
                    "text": "*Current Request Status:*\\nNo Decision Yet"
                }
            },
            {
                "type": "actions",
                "block_id": "approvers_ApproveDeny_BTN_BlockID",
                "elements": [
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "emoji": true,
                            "text": "Approve"
                        },
                        "confirm": {
                            "title": {
                                "type": "plain_text",
                                "text": "Are you sure you want to approve this request?"
                            },
                            "text": {
                                "type": "mrkdwn",
                                "text": "Please make sure that someone else hasn't already approved this request. If someone has, make sure it hasn't been logged in QuickBooks Online, or else there will be two expenses in QuickBooks Online for the same expense request."
                            },
                            "confirm": {
                                "type": "plain_text",
                                "text": "Approve it!"
                            },
                            "deny": {
                                "type": "plain_text",
                                "text": "Go back, let me check."
                            }
                        },
                        "style": "primary",
                        "value": "Approve",
                        "action_id": "approve_approvers_ApproveDeny_BTN_ActionID"
                    },
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "emoji": true,
                            "text": "Deny"
                        },
                        "style": "danger",
                        "value": "Deny",
                        "action_id": "deny_approvers_ApproveDeny_BTN_ActionID"
                    }
                ]
            }
        ]
    }`;
    var templateParsed = JSON.stringify(JSON.parse(template).blocks);
    console.log(templateParsed);
    //for production
    var postMessageResult = slackApp.client.chat.postMessage({
        channel: process.env.requests_googleforms_approvers, 
        text: "This is a placeholder for the blocks that define the message. This is a request",
        blocks: templateParsed
    });
    // //for testing
    // var postMessageResult = slackApp.client.chat.postMessage({
    //     channel: process.env.infoUserID,
    //     text: "This is a placeholder for the blocks that define the message. This is a request",
    //     blocks: templateParsed
    // });

    return postMessageResult;
}

// //export the modal view
// module.exports = {
//     updateMessage: taskeeUpdateMessage
// };